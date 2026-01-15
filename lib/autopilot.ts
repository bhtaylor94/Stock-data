import type { StrategyId, PresetId } from '@/strategies/registry';
import type { Signal } from '@/strategies/signalTypes';
import { STRATEGY_REGISTRY } from '@/strategies/registry';
import { evaluateStrategySignal } from '@/strategies/engine';
import { loadSuggestions, upsertSuggestion, type TrackedSuggestion } from '@/lib/trackerStore';
import { loadAutomationConfig, isLiveArmed } from '@/lib/automationStore';
import { placeMarketEquityOrder } from '@/lib/liveOrders';

export type AutopilotAction = {
  symbol: string;
  strategyId: StrategyId;
  presetId: PresetId;
  action: 'TRACK_PAPER' | 'PLACE_LIVE_ORDER' | 'SKIP';
  reason: string;
  signal?: Signal;
  orderId?: string;
  trackedId?: string;
};

function nowIso(): string {
  return new Date().toISOString();
}

function shouldSkipForCooldown(strategyId: StrategyId, symbol: string, cooldownMinutes: number, existing: TrackedSuggestion[]): boolean {
  const ms = cooldownMinutes * 60 * 1000;
  const last = existing.find(
    (s) =>
      s.ticker === symbol &&
      (s.setup === strategyId || s.strategy === strategyId || s.strategy.includes(String(strategyId)))
  );
  if (!last) return false;
  const t = new Date(last.updatedAt || last.createdAt).getTime();
  return Number.isFinite(t) && Date.now() - t < ms;
}

function isAlreadyActive(strategyId: StrategyId, symbol: string, existing: TrackedSuggestion[]): boolean {
  return existing.some(
    (s) =>
      s.ticker === symbol &&
      s.status === 'ACTIVE' &&
      (s.setup === strategyId || s.strategy === strategyId || s.strategy.includes(String(strategyId)))
  );
}

function signalToTrackedSuggestion(signal: Signal, presetId: PresetId): TrackedSuggestion | null {
  const entry = Number(signal.tradePlan?.entry);
  const stop = Number(signal.tradePlan?.stop);
  const target = Number(signal.tradePlan?.target);
  if (!Number.isFinite(entry) || !Number.isFinite(stop) || !Number.isFinite(target)) return null;

  const id = `${signal.symbol}-${signal.strategyId}-${Date.now()}`;
  return {
    id,
    ticker: signal.symbol,
    type: signal.action === 'BUY' ? 'STOCK_BUY' : signal.action === 'SELL' ? 'STOCK_SELL' : 'NO_TRADE',
    strategy: signal.strategyName,
    setup: signal.strategyId,
    regime: (STRATEGY_REGISTRY.find((s) => s.id === signal.strategyId)?.marketRegimes || [])[0],
    entryPrice: entry,
    targetPrice: target,
    stopLoss: stop,
    confidence: Number(signal.confidence || 0),
    reasoning: Array.isArray(signal.why) ? signal.why.slice(0, 3) : [],
    status: 'ACTIVE',
    createdAt: nowIso(),
    updatedAt: nowIso(),
    evidencePacket: {
      kind: 'autopilot_signal_v1',
      capturedAt: nowIso(),
      presetId,
      signal,
    },
  };
}

export async function runAutopilotTick(opts?: { dryRun?: boolean }): Promise<{ ok: boolean; actions: AutopilotAction[]; meta: any }> {
  const cfg = await loadAutomationConfig();
  const dryRun = Boolean(opts?.dryRun);
  const actions: AutopilotAction[] = [];

  if (!cfg.autopilot.enabled || cfg.autopilot.mode === 'OFF') {
    return {
      ok: true,
      actions,
      meta: { reason: 'autopilot_disabled', config: cfg.autopilot },
    };
  }

  const existing = await loadSuggestions();
  const maxNew = Math.max(0, Math.min(25, Number(cfg.autopilot.maxNewPositionsPerTick || 0)));
  const cooldownMin = Math.max(0, Math.min(7 * 24 * 60, Number(cfg.autopilot.cooldownMinutes || 0)));

  // Safety gate for LIVE
  if (cfg.autopilot.mode === 'LIVE') {
    const envGate = process.env.ALLOW_LIVE_AUTOPILOT === 'true';
    if (!envGate) {
      return {
        ok: false,
        actions: [{ symbol: '', strategyId: 'trend_rider', presetId: cfg.autopilot.presetId, action: 'SKIP', reason: 'LIVE blocked: set ALLOW_LIVE_AUTOPILOT=true in env.' } as any],
        meta: { reason: 'live_env_block', allow: false },
      };
    }
    if (!isLiveArmed(cfg)) {
      return {
        ok: false,
        actions: [{ symbol: '', strategyId: 'trend_rider', presetId: cfg.autopilot.presetId, action: 'SKIP', reason: 'LIVE blocked: not armed (arm window expired).' } as any],
        meta: { reason: 'live_not_armed' },
      };
    }
  }

  const symbols = (cfg.autopilot.symbols || []).map((s) => String(s).trim().toUpperCase()).filter(Boolean);
  const presetId = cfg.autopilot.presetId;
  const globalMinConf = Number(cfg.autopilot.minConfidence || 0);

  // Evaluate across enabled strategies
  const enabledStrategies: StrategyId[] = STRATEGY_REGISTRY
    .map((s) => s.id)
    .filter((id) => {
      const sc = cfg.strategies?.[id];
      return sc ? Boolean(sc.enabled) : true;
    });

  // Gather signals
  const signals: Signal[] = [];
  for (const symbol of symbols) {
    for (const strategyId of enabledStrategies) {
      // skip active/cooldown
      if (isAlreadyActive(strategyId, symbol, existing)) {
        actions.push({ symbol, strategyId, presetId, action: 'SKIP', reason: 'Already ACTIVE for this strategy/symbol.' });
        continue;
      }
      if (shouldSkipForCooldown(strategyId, symbol, cooldownMin, existing)) {
        actions.push({ symbol, strategyId, presetId, action: 'SKIP', reason: 'Cooldown window active for this strategy/symbol.' });
        continue;
      }

      const sc = cfg.strategies?.[strategyId] || null;
      const minConf = Number(sc?.minConfidence ?? globalMinConf);
      const r = await evaluateStrategySignal({ symbol, strategyId, presetId, mode: cfg.autopilot.mode === 'LIVE' ? 'live' : 'paper' });
      const sig = r.ok ? r.signal : null;
      if (!sig || sig.action === 'NO_TRADE') {
        continue;
      }
      if (Number(sig.confidence || 0) < minConf) {
        continue;
      }
      signals.push(sig);
    }
  }

  // Sort by confidence, apply maxNew
  signals.sort((a, b) => Number(b.confidence || 0) - Number(a.confidence || 0));
  const take = maxNew ? signals.slice(0, maxNew) : [];

  for (const sig of take) {
    const strategyId = sig.strategyId as StrategyId;
    const symbol = sig.symbol;
    if (cfg.autopilot.mode === 'PAPER') {
      const tracked = signalToTrackedSuggestion(sig, presetId);
      if (!tracked) {
        actions.push({ symbol, strategyId, presetId, action: 'SKIP', reason: 'Missing tradePlan prices', signal: sig });
        continue;
      }
      if (!dryRun) {
        await upsertSuggestion(tracked);
      }
      actions.push({ symbol, strategyId, presetId, action: 'TRACK_PAPER', reason: dryRun ? 'dry_run' : 'tracked', signal: sig, trackedId: tracked.id });
    } else if (cfg.autopilot.mode === 'LIVE') {
      // Place order + also track
      const instruction = sig.action === 'BUY' ? 'BUY' : 'SELL';
      const qty = Math.max(1, Math.min(1000, Number(cfg.autopilot.defaultQuantity || 1)));
      let orderId: string | undefined;

      if (!dryRun) {
        const placed = await placeMarketEquityOrder(symbol, qty, instruction);
        orderId = placed.orderId;
      }

      const tracked = signalToTrackedSuggestion(sig, presetId);
      if (tracked && !dryRun) {
        tracked.evidencePacket = { ...(tracked.evidencePacket || {}), orderId };
        await upsertSuggestion(tracked);
      }

      actions.push({ symbol, strategyId, presetId, action: 'PLACE_LIVE_ORDER', reason: dryRun ? 'dry_run' : 'order_placed', signal: sig, orderId, trackedId: tracked?.id });
    }
  }

  return {
    ok: true,
    actions,
    meta: {
      evaluatedSymbols: symbols.length,
      evaluatedStrategies: enabledStrategies.length,
      candidates: signals.length,
      executed: take.length,
      mode: cfg.autopilot.mode,
      dryRun,
      presetId,
      minConfidence: globalMinConf,
    },
  };
}
