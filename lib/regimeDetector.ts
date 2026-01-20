// lib/regimeDetector.ts
// Lightweight market regime detector for strategy gating.
//
// Heuristic output (v1): TREND / RANGE / MOMENTUM / EVENT / MIXED

import type { MarketRegime } from '@/strategies/registry';
import { fetchStrategyCandles } from '@/strategies/market';
import { atr, bbands, ema, avgVolume, pctDiff, rollingHigh, rollingLow } from '@/strategies/indicators';

export type RegimeDetails = {
  emaSpreadPct: number;
  bbWidthPct: number;
  atrPct: number;
  lastChangePct: number;
  volMultiple: number;
  nearBreakout: boolean;
};

// MarketRegime (strategy spec) plus an internal fallback when no clear regime is detected.
export type DetectedRegime = MarketRegime | 'MIXED';

function safeNum(v: any): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export async function detectMarketRegime(symbol: string): Promise<{ ok: boolean; regime: DetectedRegime; details: RegimeDetails }> {
  try {
    // Use a 1M window (fits swing + regime context) and 5m/15m resolution from your existing market fetcher.
    const r = await fetchStrategyCandles(symbol, '1M');
    const candles = Array.isArray(r?.candles) ? r.candles : [];
    if (candles.length < 60) {
      return {
        ok: true,
        regime: 'MIXED',
        details: { emaSpreadPct: 0, bbWidthPct: 0, atrPct: 0, lastChangePct: 0, volMultiple: 0, nearBreakout: false },
      };
    }

    const closes = candles.map((c: any) => safeNum(c.close));
    const last = candles[candles.length - 1];
    const prev = candles[candles.length - 2];
    const lastClose = safeNum(last?.close);
    const prevClose = safeNum(prev?.close);
    const lastVol = safeNum(last?.volume);

    const ema20Arr = ema(closes, 20);
    const ema50Arr = ema(closes, 50);
    const ema20 = safeNum(ema20Arr[ema20Arr.length - 1]);
    const ema50 = safeNum(ema50Arr[ema50Arr.length - 1]);
    const emaSpreadPct = ema20 && ema50 ? Math.abs(pctDiff(ema20, ema50)) : 0;

    const { mid, upper, lower } = bbands(closes, 20, 2);
    const midLast = safeNum(mid[mid.length - 1]);
    const upperLast = safeNum(upper[upper.length - 1]);
    const lowerLast = safeNum(lower[lower.length - 1]);
    const bbWidthPct = midLast ? ((upperLast - lowerLast) / midLast) * 100 : 0;

    const atrArr = atr(candles, 14);
    const atrLast = safeNum(atrArr[atrArr.length - 1]);
    const atrPct = lastClose ? (atrLast / lastClose) * 100 : 0;

    const lastChangePct = prevClose ? ((lastClose - prevClose) / prevClose) * 100 : 0;

    const avgVol = avgVolume(candles, 20, true);
    const volMultiple = avgVol > 0 ? lastVol / avgVol : 0;

    // Breakout proximity check
    const hi = rollingHigh(closes, 20, true);
    const lo = rollingLow(closes, 20, true);
    const nearBreakout = hi > 0 && (lastClose >= hi * 0.995 || lastClose <= lo * 1.005);

    const details: RegimeDetails = {
      emaSpreadPct,
      bbWidthPct,
      atrPct,
      lastChangePct,
      volMultiple,
      nearBreakout,
    };

    // EVENT: outsized move + volume spike
    const bigMove = Math.abs(lastChangePct) >= Math.max(2.5, atrPct * 1.8);
    const volSpike = volMultiple >= 2.2;
    if (bigMove && volSpike) return { ok: true, regime: 'EVENT', details };

    // TREND: strong EMA separation + moderate expansion
    if (emaSpreadPct >= 0.45 && bbWidthPct >= 6) return { ok: true, regime: 'TREND', details };

    // RANGE: tight EMAs + tight bands
    if (emaSpreadPct <= 0.25 && bbWidthPct <= 5.5) return { ok: true, regime: 'RANGE', details };

    // MOMENTUM: expanding bands or breakout proximity + above-average volume
    if ((bbWidthPct >= 7.5 || nearBreakout) && volMultiple >= 1.4) return { ok: true, regime: 'MOMENTUM', details };

    return { ok: true, regime: 'MIXED', details };
  } catch {
    return {
      ok: false,
      regime: 'MIXED',
      details: { emaSpreadPct: 0, bbWidthPct: 0, atrPct: 0, lastChangePct: 0, volMultiple: 0, nearBreakout: false },
    };
  }
}
