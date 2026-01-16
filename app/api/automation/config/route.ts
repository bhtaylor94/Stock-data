import { NextRequest, NextResponse } from 'next/server';
import { STRATEGY_REGISTRY, type StrategyId, type PresetId } from '@/strategies/registry';
import {
  loadAutomationConfig,
  saveAutomationConfig,
  defaultAutomationConfig,
  normalizeSymbolList,
  normalizeNoTradeWindows,
  type AutomationConfig,
  type AutopilotMode,
} from '@/lib/automationStore';

export const runtime = 'nodejs';

function clampNum(v: any, min: number, max: number, fallback: number): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function isPresetId(v: any): v is PresetId {
  return v === 'conservative' || v === 'balanced' || v === 'aggressive';
}

function isMode(v: any): v is AutopilotMode {
  return v === 'OFF' || v === 'PAPER' || v === 'LIVE' || v === 'LIVE_CONFIRM';
}

export async function GET() {
  const cfg = await loadAutomationConfig();
  // Fill in any missing strategy config defaults
  const next: AutomationConfig = { ...cfg };
  next.strategies = next.strategies || {};
  for (const s of STRATEGY_REGISTRY) {
    if (!next.strategies[s.id]) next.strategies[s.id] = { enabled: true };
  }
  // best-effort persist normalization
  await saveAutomationConfig(next);
  return NextResponse.json({ ok: true, config: next, strategies: STRATEGY_REGISTRY });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    if (!body) return NextResponse.json({ ok: false, error: 'Invalid JSON body' }, { status: 400 });

    const current = await loadAutomationConfig();
    const next: AutomationConfig = { ...current };
    next.strategies = next.strategies || {};

    // Special actions
    if (body.action === 'reset') {
      const fresh = defaultAutomationConfig();
      // enable all strategies by default
      for (const s of STRATEGY_REGISTRY) fresh.strategies[s.id] = { enabled: true };
      await saveAutomationConfig(fresh);
      return NextResponse.json({ ok: true, config: fresh });
    }

    if (body.action === 'armLive') {
      const minutes = clampNum(body.minutes, 1, 180, 30);
      const exp = new Date(Date.now() + minutes * 60 * 1000).toISOString();
      next.autopilot = { ...next.autopilot, liveArmExpiresAt: exp };
      await saveAutomationConfig(next);
      return NextResponse.json({ ok: true, config: next });
    }

    if (body.action === 'disarmLive') {
      next.autopilot = { ...next.autopilot };
      delete (next.autopilot as any).liveArmExpiresAt;
      await saveAutomationConfig(next);
      return NextResponse.json({ ok: true, config: next });
    }

    // Patch autopilot
    if (body.autopilot) {
      const ap = body.autopilot;
      next.autopilot = {
        ...next.autopilot,
        enabled: typeof ap.enabled === 'boolean' ? ap.enabled : next.autopilot.enabled,
        mode: isMode(ap.mode) ? ap.mode : next.autopilot.mode,
        presetId: isPresetId(ap.presetId) ? ap.presetId : next.autopilot.presetId,
        minConfidence: clampNum(ap.minConfidence, 0, 100, next.autopilot.minConfidence),
        defaultQuantity: clampNum(ap.defaultQuantity, 1, 10000, next.autopilot.defaultQuantity),
        maxNewPositionsPerTick: clampNum(ap.maxNewPositionsPerTick, 0, 25, next.autopilot.maxNewPositionsPerTick),
        cooldownMinutes: clampNum(ap.cooldownMinutes, 0, 7 * 24 * 60, next.autopilot.cooldownMinutes),

        enableRegimeGate:
          typeof ap.enableRegimeGate === 'boolean' ? ap.enableRegimeGate : (next.autopilot as any).enableRegimeGate ?? true,
        signalDedupMinutes: clampNum(ap.signalDedupMinutes, 0, 7 * 24 * 60, (next.autopilot as any).signalDedupMinutes ?? 120),
        dedupMinConfidenceDelta: clampNum(ap.dedupMinConfidenceDelta, 0, 50, (next.autopilot as any).dedupMinConfidenceDelta ?? 5),
        maxOpenPositionsTotal: clampNum(ap.maxOpenPositionsTotal, 0, 250, next.autopilot.maxOpenPositionsTotal),
        maxOpenPositionsPerSymbol: clampNum(ap.maxOpenPositionsPerSymbol, 0, 50, next.autopilot.maxOpenPositionsPerSymbol),
        maxTradesPerDay: clampNum(ap.maxTradesPerDay, 0, 500, next.autopilot.maxTradesPerDay),
        maxNotionalPerTradeUSD: clampNum(ap.maxNotionalPerTradeUSD, 0, 10000000, next.autopilot.maxNotionalPerTradeUSD),
        requireMarketHours: typeof ap.requireMarketHours === 'boolean' ? ap.requireMarketHours : next.autopilot.requireMarketHours,
        noTradeWindows: ap.noTradeWindows !== undefined ? normalizeNoTradeWindows(ap.noTradeWindows) : next.autopilot.noTradeWindows,
        requireLiveAllowlist: typeof ap.requireLiveAllowlist === 'boolean' ? ap.requireLiveAllowlist : next.autopilot.requireLiveAllowlist,
        liveAllowlistSymbols: ap.liveAllowlistSymbols !== undefined ? normalizeSymbolList(ap.liveAllowlistSymbols) : next.autopilot.liveAllowlistSymbols,
        symbols: ap.symbols !== undefined ? normalizeSymbolList(ap.symbols) : next.autopilot.symbols,

        // Trade lifecycle manager
        manageOpenTradesEnabled:
          typeof ap.manageOpenTradesEnabled === 'boolean'
            ? ap.manageOpenTradesEnabled
            : (next.autopilot as any).manageOpenTradesEnabled ?? true,
        timeStopDays: clampNum(ap.timeStopDays, 0, 120, Number((next.autopilot as any).timeStopDays ?? 10)),
        enableTrailingStop:
          typeof ap.enableTrailingStop === 'boolean'
            ? ap.enableTrailingStop
            : (next.autopilot as any).enableTrailingStop ?? true,
        trailAfterR: clampNum(ap.trailAfterR, 0, 10, Number((next.autopilot as any).trailAfterR ?? 1)),
        trailLockInR: clampNum(ap.trailLockInR, 0, 5, Number((next.autopilot as any).trailLockInR ?? 0.1)),

        // Kill switch
        haltNewEntries: typeof ap.haltNewEntries === 'boolean' ? ap.haltNewEntries : (next.autopilot as any).haltNewEntries ?? false,
        haltReason: ap.haltReason !== undefined ? String(ap.haltReason || '').slice(0, 140) : (next.autopilot as any).haltReason ?? '',
        haltSetAt:
          ap.haltNewEntries === true
            ? ((next.autopilot as any).haltSetAt || new Date().toISOString())
            : ap.haltNewEntries === false
              ? undefined
              : (next.autopilot as any).haltSetAt,
      };
    }

    // Patch per-strategy toggles
    if (body.strategies && typeof body.strategies === 'object') {
      for (const s of STRATEGY_REGISTRY) {
        const patch = body.strategies[s.id as StrategyId];
        const cur = next.strategies[s.id] || { enabled: true };
        if (!patch) {
          next.strategies[s.id] = cur;
          continue;
        }
        next.strategies[s.id] = {
          enabled: typeof patch.enabled === 'boolean' ? patch.enabled : cur.enabled,
          minConfidence:
            patch.minConfidence !== undefined ? clampNum(patch.minConfidence, 0, 100, Number(cur.minConfidence ?? NaN)) : cur.minConfidence,
          symbols: patch.symbols !== undefined ? normalizeSymbolList(patch.symbols) : cur.symbols,
        };
      }
    }

    await saveAutomationConfig(next);
    return NextResponse.json({ ok: true, config: next });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: String(err?.message || err) }, { status: 500 });
  }
}
