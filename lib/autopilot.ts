import type { StrategyId, PresetId } from '@/strategies/registry';
import type { Signal } from '@/strategies/signalTypes';
import { STRATEGY_REGISTRY } from '@/strategies/registry';
import { evaluateStrategySignal } from '@/strategies/engine';
import { loadSuggestions, upsertSuggestion, type TrackedSuggestion } from '@/lib/trackerStore';
import { loadAutomationConfig, isLiveArmed } from '@/lib/automationStore';
import { placeMarketEquityOrder, placeMarketOptionOrder } from '@/lib/liveOrders';
import { selectOptionContractForSignal } from '@/lib/options/contractSelector';
import { appendAutomationRun } from '@/lib/automationRunsStore';
import { addPendingApproval, makePendingId, nowIso as nowIsoPA } from '@/lib/pendingApprovalsStore';
import { detectMarketRegime } from '@/lib/regimeDetector';
import { makeDedupKey, recordSignalFire, shouldSuppressSignal } from '@/lib/automationDedupStore';
import { runTradeLifecycleSweep } from '@/lib/tradeLifecycle';
import { loadAlertsStore, appendAlertEvent, shouldEmitAlert } from '@/lib/alertsStore';
import { sendWebhookIfConfigured } from '@/lib/alertWebhook';

export type AutopilotAction = {
  symbol: string;
  strategyId: StrategyId;
  presetId: PresetId;
  action: 'TRACK_PAPER' | 'PLACE_LIVE_ORDER' | 'QUEUE_LIVE_APPROVAL' | 'SKIP';
  reason: string;
  signal?: Signal;
  orderId?: string;
  trackedId?: string;
  pendingId?: string;
};

function nowIso(): string {
  return new Date().toISOString();
}

async function emitAlert(mode: "PAPER" | "LIVE" | "LIVE_CONFIRM", ev: {
  type: string;
  title: string;
  message: string;
  severity: "info" | "warn" | "error";
  symbol?: string;
  strategyId?: string;
  confidence?: number;
  action?: "BUY" | "SELL" | "NO_TRADE";
  meta?: Record<string, any>;
}): Promise<void> {
  try {
    const store = await loadAlertsStore();
    const cfg = store.config;
    if (!shouldEmitAlert(cfg, mode, ev.symbol, ev.strategyId, ev.confidence)) return;
    const payload = {
      id: `alert_${Date.now()}_${Math.random().toString(16).slice(2)}`,
      createdAt: new Date().toISOString(),
      ...ev,
    };
    await appendAlertEvent(payload as any);
    await sendWebhookIfConfigured(cfg as any, payload as any);
  } catch {
    // best-effort
  }
}

function nyDateKey(d: Date): string {
  // YYYY-MM-DD in America/New_York
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
    .formatToParts(d)
    .reduce<Record<string, string>>((acc, p) => {
      if (p.type !== 'literal') acc[p.type] = p.value;
      return acc;
    }, {});
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function nyMinutesSinceMidnight(d: Date): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
    .formatToParts(d)
    .reduce<Record<string, string>>((acc, p) => {
      if (p.type !== 'literal') acc[p.type] = p.value;
      return acc;
    }, {});
  const hh = Number(parts.hour);
  const mm = Number(parts.minute);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return -1;
  return hh * 60 + mm;
}

function parseHHMMToMinutes(v: string): number {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(String(v || '').trim());
  if (!m) return -1;
  return Number(m[1]) * 60 + Number(m[2]);
}

function isWithinNoTradeWindows(nowNYMin: number, windows: { startHHMM: string; endHHMM: string }[]): boolean {
  for (const w of windows || []) {
    const a = parseHHMMToMinutes(w.startHHMM);
    const b = parseHHMMToMinutes(w.endHHMM);
    if (a < 0 || b < 0) continue;
    if (a <= nowNYMin && nowNYMin < b) return true;
  }
  return false;
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

function countActivePositions(existing: TrackedSuggestion[]): { total: number; bySymbol: Record<string, number> } {
  const bySymbol: Record<string, number> = {};
  let total = 0;
  for (const s of existing) {
    if (s.status !== 'ACTIVE') continue;
    total += 1;
    const k = String(s.ticker || '').toUpperCase();
    if (!k) continue;
    bySymbol[k] = (bySymbol[k] || 0) + 1;
  }
  return { total, bySymbol };
}

function countTradesToday(existing: TrackedSuggestion[], now: Date): number {
  const key = nyDateKey(now);
  let n = 0;
  for (const s of existing) {
    const kind = (s as any)?.evidencePacket?.kind;
    if (kind !== 'autopilot_signal_v1') continue;
    const created = new Date(s.createdAt || s.updatedAt || 0);
    if (Number.isNaN(created.getTime())) continue;
    if (nyDateKey(created) === key) n += 1;
  }
  return n;
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
  const startedAt = nowIso();
  const dryRun = Boolean(opts?.dryRun);
  const actions: AutopilotAction[] = [];
  let cfg = await loadAutomationConfig();
  let ok = true;
  let meta: any = null;
  let errorMsg = '';

  try {
    if (!cfg.autopilot.enabled || cfg.autopilot.mode === 'OFF') {
      meta = { reason: 'autopilot_disabled', config: cfg.autopilot };
      if (!dryRun) {
        await emitAlert("PAPER", {
          type: "AUTOPILOT_HALTED",
          title: "Autopilot halted (new entries)",
          message: String((cfg.autopilot as any).haltReason || ""),
          severity: "warn",
          meta: { mode: cfg.autopilot.mode, haltSetAt: (cfg.autopilot as any).haltSetAt || null },
        });
      }
      return { ok: true, actions, meta };
    }

    // Trade lifecycle manager: update ACTIVE tracked trades (target/stop/time-stop/trailing)
    // This runs before generating new signals so risk caps reflect any closures.
    let lifecycle: any = null;
    if ((cfg.autopilot as any).manageOpenTradesEnabled) {
      lifecycle = await runTradeLifecycleSweep({
        dryRun,
        autopilotOnly: true,
        timeStopDays: Number((cfg.autopilot as any).timeStopDays ?? 10),
        enableTrailing: Boolean((cfg.autopilot as any).enableTrailingStop ?? true),
        trailAfterR: Number((cfg.autopilot as any).trailAfterR ?? 1),
        trailLockInR: Number((cfg.autopilot as any).trailLockInR ?? 0.1),
      });
    }

    // Kill switch: halt NEW entries, but still allow lifecycle exits to run.
    if (Boolean((cfg.autopilot as any).haltNewEntries)) {
      meta = {
        reason: 'halt_new_entries',
        halt: {
          enabled: true,
          setAt: (cfg.autopilot as any).haltSetAt || null,
          message: (cfg.autopilot as any).haltReason || '',
        },
        lifecycle,
      };
      if (!dryRun) {
        await emitAlert("PAPER", {
          type: "AUTOPILOT_HALTED",
          title: "Autopilot halted (new entries)",
          message: String((cfg.autopilot as any).haltReason || ""),
          severity: "warn",
          meta: { mode: cfg.autopilot.mode, haltSetAt: (cfg.autopilot as any).haltSetAt || null },
        });
      }
      return { ok: true, actions, meta };
    }

    const existing = await loadSuggestions();
    const maxNew = Math.max(0, Math.min(25, Number(cfg.autopilot.maxNewPositionsPerTick || 0)));
    const cooldownMin = Math.max(0, Math.min(7 * 24 * 60, Number(cfg.autopilot.cooldownMinutes || 0)));

    const enableRegimeGate = Boolean((cfg.autopilot as any).enableRegimeGate ?? true);
    const dedupMinutes = Math.max(0, Math.min(7 * 24 * 60, Number((cfg.autopilot as any).signalDedupMinutes || 0)));
    const dedupDelta = Math.max(0, Math.min(50, Number((cfg.autopilot as any).dedupMinConfidenceDelta || 0)));

    // Time gates (America/New_York)
    const now = new Date();
    const nowNYMin = nyMinutesSinceMidnight(now);
    const isMarketHours = nowNYMin >= (9 * 60 + 30) && nowNYMin < (16 * 60);
    const inNoTrade = isWithinNoTradeWindows(nowNYMin, cfg.autopilot.noTradeWindows || []);

    if (cfg.autopilot.requireMarketHours && !isMarketHours) {
      meta = { reason: 'time_gate_market_hours', nowNYMin };
      if (!dryRun) {
        await emitAlert("PAPER", {
          type: "AUTOPILOT_HALTED",
          title: "Autopilot halted (new entries)",
          message: String((cfg.autopilot as any).haltReason || ""),
          severity: "warn",
          meta: { mode: cfg.autopilot.mode, haltSetAt: (cfg.autopilot as any).haltSetAt || null },
        });
      }
      return { ok: true, actions, meta };
    }
    if (inNoTrade) {
      meta = { reason: 'time_gate_no_trade_window', nowNYMin };
      if (!dryRun) {
        await emitAlert("PAPER", {
          type: "AUTOPILOT_HALTED",
          title: "Autopilot halted (new entries)",
          message: String((cfg.autopilot as any).haltReason || ""),
          severity: "warn",
          meta: { mode: cfg.autopilot.mode, haltSetAt: (cfg.autopilot as any).haltSetAt || null },
        });
      }
      return { ok: true, actions, meta };
    }

    // Safety gate for LIVE / LIVE_CONFIRM
    if (cfg.autopilot.mode === 'LIVE' || (cfg.autopilot.mode as any) === 'LIVE_CONFIRM') {
      const envGate = process.env.ALLOW_LIVE_AUTOPILOT === 'true';
      if (!envGate) {
        ok = false;
        actions.push({ symbol: '', strategyId: 'trend_rider' as any, presetId: cfg.autopilot.presetId, action: 'SKIP', reason: 'LIVE blocked: set ALLOW_LIVE_AUTOPILOT=true in env.' });
        meta = { reason: 'live_env_block', allow: false };
        return { ok, actions, meta };
      }
      if (cfg.autopilot.mode === 'LIVE' && !isLiveArmed(cfg)) {
        ok = false;
        actions.push({ symbol: '', strategyId: 'trend_rider' as any, presetId: cfg.autopilot.presetId, action: 'SKIP', reason: 'LIVE blocked: not armed (arm window expired).' });
        meta = { reason: 'live_not_armed' };
        return { ok, actions, meta };
      }
    }

    // Risk caps
    const caps = countActivePositions(existing);
    let openTotal = caps.total;
    const openBySymbol = { ...caps.bySymbol };

    const tradesToday = countTradesToday(existing, now);
    const maxTradesToday = Math.max(0, Number(cfg.autopilot.maxTradesPerDay || 0));
    if (maxTradesToday > 0 && tradesToday >= maxTradesToday) {
      meta = { reason: 'risk_gate_max_trades_day', tradesToday, maxTradesToday };
      if (!dryRun) {
        await emitAlert("PAPER", {
          type: "AUTOPILOT_HALTED",
          title: "Autopilot halted (new entries)",
          message: String((cfg.autopilot as any).haltReason || ""),
          severity: "warn",
          meta: { mode: cfg.autopilot.mode, haltSetAt: (cfg.autopilot as any).haltSetAt || null },
        });
      }
      return { ok: true, actions, meta };
    }

    const maxOpenTotal = Math.max(0, Number(cfg.autopilot.maxOpenPositionsTotal || 0));
    if (maxOpenTotal > 0 && openTotal >= maxOpenTotal) {
      meta = { reason: 'risk_gate_max_open_total', openTotal, maxOpenTotal };
      if (!dryRun) {
        await emitAlert("PAPER", {
          type: "AUTOPILOT_HALTED",
          title: "Autopilot halted (new entries)",
          message: String((cfg.autopilot as any).haltReason || ""),
          severity: "warn",
          meta: { mode: cfg.autopilot.mode, haltSetAt: (cfg.autopilot as any).haltSetAt || null },
        });
      }
      return { ok: true, actions, meta };
    }

    const symbols = (cfg.autopilot.symbols || []).map((s) => String(s).trim().toUpperCase()).filter(Boolean);
    const presetId = cfg.autopilot.presetId;
    const globalMinConf = Number(cfg.autopilot.minConfidence || 0);

    // Regime detection cache (per-tick)
    const regimeBySymbol: Record<string, { regime: string; details?: any; ok: boolean }> = {};

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
      if (enableRegimeGate && !regimeBySymbol[symbol]) {
        const r = await detectMarketRegime(symbol);
        regimeBySymbol[symbol] = { ok: r.ok, regime: r.regime, details: r.details };
      }
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

        // LIVE allowlist safety
        if ((cfg.autopilot.mode === 'LIVE' || (cfg.autopilot.mode as any) === 'LIVE_CONFIRM') && cfg.autopilot.requireLiveAllowlist) {
          const allow = (cfg.autopilot.liveAllowlistSymbols || []).map((s) => String(s).trim().toUpperCase()).filter(Boolean);
          if (allow.length && !allow.includes(symbol)) {
            actions.push({ symbol, strategyId, presetId, action: 'SKIP', reason: 'LIVE allowlist blocked this symbol.' });
            continue;
          }
        }

        // Position caps (per symbol)
        const maxPer = Math.max(0, Number(cfg.autopilot.maxOpenPositionsPerSymbol || 0));
        if (maxPer > 0 && (openBySymbol[symbol] || 0) >= maxPer) {
          actions.push({ symbol, strategyId, presetId, action: 'SKIP', reason: 'Max open positions per symbol reached.' });
          continue;
        }

        const sc = cfg.strategies?.[strategyId] || null;
        const minConf = Number(sc?.minConfidence ?? globalMinConf);

        // Regime gate
        if (enableRegimeGate) {
          const strat = STRATEGY_REGISTRY.find((s) => s.id === strategyId) || null;
          const detected = regimeBySymbol[symbol]?.regime || 'MIXED';
          const allowed =
            detected === 'MIXED'
              ? true
              : Boolean(strat?.marketRegimes?.includes(detected as any) || strat?.marketRegimes?.includes('MIXED' as any));
          if (!allowed) {
            actions.push({ symbol, strategyId, presetId, action: 'SKIP', reason: `Regime gate blocked (detected ${detected}).` });
            continue;
          }
        }
        const r = await evaluateStrategySignal({ symbol, strategyId, presetId, mode: (cfg.autopilot.mode === 'LIVE' || (cfg.autopilot.mode as any) === 'LIVE_CONFIRM') ? 'live' : 'paper' });
        const sig = r.ok ? r.signal : null;
        if (!sig || sig.action === 'NO_TRADE') {
          continue;
        }
        if (Number(sig.confidence || 0) < minConf) {
          continue;
        }

        // Dedup suppression (prevents repeated signals firing each tick)
        const key = makeDedupKey(strategyId, symbol, sig.action as any);
        const sup = shouldSuppressSignal({ key, nowMs: Date.now(), windowMinutes: dedupMinutes, minConfidenceDelta: dedupDelta, confidence: Number(sig.confidence || 0) });
        if (sup.suppress) {
          actions.push({ symbol, strategyId, presetId, action: 'SKIP', reason: sup.reason || 'Dedup suppressed', signal: sig });
          continue;
        }
        recordSignalFire(key, Date.now(), Number(sig.confidence || 0));

        signals.push(sig);
      }
    }

    // Sort by confidence, apply maxNew
    signals.sort((a, b) => Number(b.confidence || 0) - Number(a.confidence || 0));
    const take = maxNew ? signals.slice(0, maxNew) : [];

    for (const sig of take) {
      const strategyId = sig.strategyId as StrategyId;
      const symbol = sig.symbol;

      // Cap check again before execution (state may have changed during tick)
      if (maxOpenTotal > 0 && openTotal >= maxOpenTotal) {
        actions.push({ symbol, strategyId, presetId, action: 'SKIP', reason: 'Max open positions (total) reached.' , signal: sig});
        continue;
      }
      const maxPer = Math.max(0, Number(cfg.autopilot.maxOpenPositionsPerSymbol || 0));
      if (maxPer > 0 && (openBySymbol[symbol] || 0) >= maxPer) {
        actions.push({ symbol, strategyId, presetId, action: 'SKIP', reason: 'Max open positions per symbol reached.' , signal: sig});
        continue;
      }

      // Notional cap
      const entry = Number(sig.tradePlan?.entry);
      const isLiveish = cfg.autopilot.mode === 'LIVE' || (cfg.autopilot.mode as any) === 'LIVE_CONFIRM';
      const execInstr = (cfg.autopilot as any).executionInstrument || 'STOCK';

      // Quantity means:
      // - STOCK: shares
      // - OPTION: contracts
      let qty = 1;
      if (isLiveish) {
        if (execInstr === 'OPTION') {
          const defC = Number((cfg.autopilot as any).options?.defaultContracts ?? 1);
          const maxC = Number((cfg.autopilot as any).options?.maxContractsPerTrade ?? 10);
          qty = Math.max(1, Math.min(maxC, Math.floor(defC || 1)));
        } else {
          qty = Math.max(1, Math.min(1000, Number(cfg.autopilot.defaultQuantity || 1)));
        }
      }
      const notional = Number.isFinite(entry) ? entry * qty : NaN;
      const maxNotional = Math.max(0, Number(cfg.autopilot.maxNotionalPerTradeUSD || 0));
      if (maxNotional > 0 && Number.isFinite(notional) && notional > maxNotional) {
        actions.push({ symbol, strategyId, presetId, action: 'SKIP', reason: 'Max notional per trade exceeded.' , signal: sig});
        continue;
      }

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
        if (!dryRun) {
          await emitAlert("PAPER", {
            type: "SIGNAL_PAPER_TRACKED",
            title: `${symbol} • Paper tracked`,
            message: `${sig.strategyName || strategyId} (${presetId}) • conf ${Number(sig.confidence || 0).toFixed(0)} • ${sig.action}`,
            severity: "info",
            symbol,
            strategyId: String(strategyId),
            confidence: Number(sig.confidence || 0),
            action: sig.action as any,
            meta: { trackedId: tracked.id },
          });
        }

      } else if ((cfg.autopilot.mode as any) === 'LIVE_CONFIRM') {
        // Queue a live order for human approval (no order is placed yet)
        const instruction = sig.action === 'BUY' ? 'BUY' : 'SELL';
        const entry = Number(sig.tradePlan?.entry);
        const execInstr = (cfg.autopilot as any).executionInstrument || 'STOCK';
        let selectedOption: any = null;

        // Resolve contract up-front for exact replay in approvals (OPTION execution only)
        if (execInstr === 'OPTION') {
          const side = sig.action === 'BUY' ? 'CALL' : 'PUT';
          const optCfg = (cfg.autopilot as any).options || {};
          const sel = await selectOptionContractForSignal({
            symbol,
            side,
            targetDteDays: Number(optCfg.targetDteDays ?? 30),
            targetAbsDelta: Number(optCfg.targetAbsDelta ?? 0.35),
            minOpenInterest: Number(optCfg.minOpenInterest ?? 1000),
            minVolume: Number(optCfg.minVolume ?? 100),
            maxBidAskPct: Number(optCfg.maxBidAskPct ?? 12),
          });
          if (!sel.ok) {
            actions.push({ symbol, strategyId, presetId, action: 'SKIP', reason: `Option selection failed: ${sel.error}`, signal: sig });
            continue;
          }
          selectedOption = sel.contract;

          // Premium cap (options-specific) before we even queue
          const mid = Number(selectedOption.mid ?? NaN);
          const premiumNotional = Number.isFinite(mid) ? mid * 100 * qty : NaN;
          const maxPrem = Number(optCfg.maxPremiumNotionalUSD ?? 0);
          if (maxPrem > 0 && Number.isFinite(premiumNotional) && premiumNotional > maxPrem) {
            actions.push({ symbol, strategyId, presetId, action: 'SKIP', reason: 'Max options premium notional exceeded.', signal: sig });
            continue;
          }
        }

        const notional = Number.isFinite(entry)
          ? (execInstr === 'OPTION' && selectedOption?.mid ? Number(selectedOption.mid) * 100 * qty : entry * qty)
          : undefined;
        const pendingId = makePendingId(symbol, String(strategyId));

        if (!dryRun) {
          await addPendingApproval({
            id: pendingId,
            createdAt: nowIsoPA(),
            updatedAt: nowIsoPA(),
            status: 'PENDING',
            symbol,
            strategyId,
            presetId,
            action: instruction as any,
            quantity: qty,
            estimatedEntry: Number.isFinite(entry) ? entry : undefined,
            estimatedNotionalUSD: Number.isFinite(notional) ? notional : undefined,
            signal: sig,
            executionInstrument: execInstr,
            selectedOptionContract: selectedOption || undefined,
          });
        }

        actions.push({ symbol, strategyId, presetId, action: 'QUEUE_LIVE_APPROVAL', reason: dryRun ? 'dry_run' : 'queued', signal: sig, pendingId });
        if (!dryRun) {
          await emitAlert("LIVE_CONFIRM", {
            type: "SIGNAL_LIVE_APPROVAL_QUEUED",
            title: `${symbol} • Approval queued`,
            message: `${sig.strategyName || strategyId} (${presetId}) • conf ${Number(sig.confidence || 0).toFixed(0)} • ${sig.action}`,
            severity: "info",
            symbol,
            strategyId: String(strategyId),
            confidence: Number(sig.confidence || 0),
            action: sig.action as any,
            meta: { pendingId },
          });
        }

      } else if (cfg.autopilot.mode === 'LIVE') {
        // Place order + also track
        const execInstr = (cfg.autopilot as any).executionInstrument || 'STOCK';
        const instruction = sig.action === 'BUY' ? 'BUY' : 'SELL';
        let orderId: string | undefined;
        let selectedOption: any = null;

        if (!dryRun) {
          if (execInstr === 'OPTION') {
            const side = sig.action === 'BUY' ? 'CALL' : 'PUT';
            const optCfg = (cfg.autopilot as any).options || {};
            const sel = await selectOptionContractForSignal({
              symbol,
              side,
              targetDteDays: Number(optCfg.targetDteDays ?? 30),
              targetAbsDelta: Number(optCfg.targetAbsDelta ?? 0.35),
              minOpenInterest: Number(optCfg.minOpenInterest ?? 1000),
              minVolume: Number(optCfg.minVolume ?? 100),
              maxBidAskPct: Number(optCfg.maxBidAskPct ?? 12),
            });
            if (!sel.ok) {
              actions.push({ symbol, strategyId, presetId, action: 'SKIP', reason: `Option selection failed: ${sel.error}`, signal: sig });
              continue;
            }
            selectedOption = sel.contract;
            const mid = Number(selectedOption.mid ?? NaN);
            const premiumNotional = Number.isFinite(mid) ? mid * 100 * qty : NaN;
            const maxPrem = Number(optCfg.maxPremiumNotionalUSD ?? 0);
            if (maxPrem > 0 && Number.isFinite(premiumNotional) && premiumNotional > maxPrem) {
              actions.push({ symbol, strategyId, presetId, action: 'SKIP', reason: 'Max options premium notional exceeded.', signal: sig });
              continue;
            }
            const placed = await placeMarketOptionOrder(String(selectedOption.optionSymbol), qty, 'BUY_TO_OPEN');
            if (!placed.ok) {
              actions.push({ symbol, strategyId, presetId, action: 'SKIP', reason: `Option order failed: ${placed.error}`, signal: sig });
              continue;
            }
            orderId = placed.orderId;
          } else {
            const placed = await placeMarketEquityOrder(symbol, qty, instruction);
            orderId = placed.orderId;
          }
        }

        const tracked = signalToTrackedSuggestion(sig, presetId);
        if (tracked && !dryRun) {
          tracked.evidencePacket = { ...(tracked.evidencePacket || {}), orderId } as any;
          tracked.broker = {
            ...(tracked.broker || {}),
            provider: 'SCHWAB',
            orderId: orderId,
            status: 'SUBMITTED',
            lastUpdate: nowIso(),
          } as any;
          if (execInstr === 'OPTION' && selectedOption) {
            tracked.type = 'OPTION' as any;
            tracked.optionContract = {
              optionSymbol: String(selectedOption.optionSymbol),
              expiration: String(selectedOption.expiration),
              strike: Number(selectedOption.strike),
              optionType: String(selectedOption.optionType),
              dte: Number(selectedOption.dte),
            } as any;
          }
          await upsertSuggestion(tracked);
        }

        actions.push({ symbol, strategyId, presetId, action: 'PLACE_LIVE_ORDER', reason: dryRun ? 'dry_run' : 'order_placed', signal: sig, orderId, trackedId: tracked?.id });
        if (!dryRun) {
          await emitAlert("LIVE", {
            type: "SIGNAL_LIVE_ORDER_PLACED",
            title: `${symbol} • Live order placed`,
            message: `${sig.strategyName || strategyId} (${presetId}) • conf ${Number(sig.confidence || 0).toFixed(0)} • qty ${qty} • ${sig.action}`,
            severity: "warn",
            symbol,
            strategyId: String(strategyId),
            confidence: Number(sig.confidence || 0),
            action: sig.action as any,
            meta: { orderId, trackedId: tracked?.id },
          });
        }

      }

      // optimistic counters
      openTotal += 1;
      openBySymbol[symbol] = (openBySymbol[symbol] || 0) + 1;
    }

    meta = {
      lifecycle,
      evaluatedSymbols: symbols.length,
      evaluatedStrategies: enabledStrategies.length,
      candidates: signals.length,
      executed: actions.filter((a) => a.action === 'TRACK_PAPER' || a.action === 'PLACE_LIVE_ORDER' || (a.action as any) === 'QUEUE_LIVE_APPROVAL').length,
      skipped: actions.filter((a) => a.action === 'SKIP').length,
      mode: cfg.autopilot.mode,
      dryRun,
      presetId,
      minConfidence: globalMinConf,
      caps: {
        openTotalStart: caps.total,
        openTotalEnd: openTotal,
        tradesToday,
      },
      time: {
        nowNYMin,
        isMarketHours,
        inNoTradeWindow: inNoTrade,
      },
    };

    if (!dryRun) {
        await emitAlert("PAPER", {
          type: "AUTOPILOT_HALTED",
          title: "Autopilot halted (new entries)",
          message: String((cfg.autopilot as any).haltReason || ""),
          severity: "warn",
          meta: { mode: cfg.autopilot.mode, haltSetAt: (cfg.autopilot as any).haltSetAt || null },
        });
      }
      return { ok: true, actions, meta };
  } catch (e: any) {
    ok = false;
    errorMsg = String(e?.message || e);
    meta = meta || { reason: 'exception' };
    return { ok, actions, meta: { ...meta, error: errorMsg } };
  } finally {
    try {
      await appendAutomationRun({
        id: `run_${Date.now()}`,
        startedAt,
        finishedAt: nowIso(),
        ok,
        mode: cfg?.autopilot?.mode || 'OFF',
        dryRun,
        presetId: cfg?.autopilot?.presetId,
        minConfidence: cfg?.autopilot?.minConfidence,
        meta,
        actions,
        error: errorMsg || undefined,
      });
    } catch {
      // best-effort: never break ticks due to logging
    }
  }
}
