// strategies/engine.ts
// Strategy evaluation engine (v1)

import { STRATEGY_REGISTRY, type StrategyId, type PresetId } from '@/strategies/registry';
import type { Signal } from '@/strategies/signalTypes';
import { fetchStrategyCandles } from '@/strategies/market';
import { atr, bbands, computeVwap, ema, avgVolume, pctDiff, rollingHigh, rollingLow, round2, scoreToConfidence } from '@/strategies/indicators';

type EvalInput = {
  symbol: string;
  strategyId: StrategyId;
  presetId: PresetId;
  mode?: 'paper' | 'live';
};

function pickStrategy(strategyId: StrategyId) {
  return STRATEGY_REGISTRY.find((s) => s.id === strategyId) || null;
}

function pickPreset(strategyId: StrategyId, presetId: PresetId) {
  const strat = pickStrategy(strategyId);
  if (!strat) return null;
  const preset = strat.presets.find((p) => p.id === presetId) || null;
  return preset ? { strat, preset } : null;
}

function horizonToRange(h: string): '1D' | '1W' | '1M' | '3M' {
  if (h === 'INTRADAY') return '1D';
  if (h === 'SWING') return '1M';
  return '3M';
}

function buildNoTrade(symbol: string, strategyId: StrategyId, strategyName: string, why: string[], horizon: string): Signal {
  return {
    symbol,
    instrument: 'STOCK',
    action: 'NO_TRADE',
    confidence: 0,
    strategyId,
    strategyName,
    why: (why || []).filter(Boolean).slice(0, 3),
    invalidation: null,
    tradePlan: {
      entry: null,
      stop: null,
      target: null,
      horizon,
    },
  };
}

function clampWhy(why: string[]): string[] {
  return (why || []).filter(Boolean).slice(0, 3);
}

// -------------------------------
// Strategy implementations
// -------------------------------

function evalTrendRider(symbol: string, strategyId: StrategyId, strategyName: string, candles: any[], params: any): Signal {
  const closes = candles.map((c: any) => Number(c.close));
  const lastClose = closes[closes.length - 1] || 0;

  const emaFastN = Number(params.emaFast || 20);
  const emaSlowN = Number(params.emaSlow || 50);
  const emaFastArr = ema(closes, emaFastN);
  const emaSlowArr = ema(closes, emaSlowN);
  const vwapArr = computeVwap(candles);
  const atrArr = atr(candles, 14);

  const emaFastLast = emaFastArr[emaFastArr.length - 1] as number | null;
  const emaSlowLast = emaSlowArr[emaSlowArr.length - 1] as number | null;
  const vwapLast = vwapArr[vwapArr.length - 1] as number | null;
  const atrLast = atrArr[atrArr.length - 1] as number | null;

  if (!emaFastLast || !emaSlowLast || !atrLast) {
    return buildNoTrade(symbol, strategyId, strategyName, ['Not enough candles to compute EMA/ATR.'], 'SWING');
  }

  const emaSpreadPct = pctDiff(emaFastLast, emaSlowLast);
  const minEmaSpreadPct = Number(params.minEmaSpreadPct || 0.4);
  if (Math.abs(emaSpreadPct) < minEmaSpreadPct) {
    return buildNoTrade(symbol, strategyId, strategyName, ['Regime not trending (EMA spread below threshold).'], 'SWING');
  }

  const requireVwapConfirm = Boolean(params.requireVwapConfirm);
  const maxExtensionPct = Number(params.maxExtensionPct || 4.0);
  const extensionPct = emaFastLast > 0 ? Math.abs(pctDiff(lastClose, emaFastLast)) : 0;
  if (extensionPct > maxExtensionPct) {
    return buildNoTrade(symbol, strategyId, strategyName, ['Price extended (chase filter).'], 'SWING');
  }

  const bullish = emaFastLast > emaSlowLast && lastClose >= emaFastLast;
  const bearish = emaFastLast < emaSlowLast && lastClose <= emaFastLast;

  if (!bullish && !bearish) {
    return buildNoTrade(symbol, strategyId, strategyName, ['EMA alignment not confirmed (no Trend Rider trigger).'], 'SWING');
  }

  if (requireVwapConfirm && vwapLast) {
    if (bullish && lastClose < vwapLast) {
      return buildNoTrade(symbol, strategyId, strategyName, ['VWAP confirmation failed (price below VWAP).'], 'SWING');
    }
    if (bearish && lastClose > vwapLast) {
      return buildNoTrade(symbol, strategyId, strategyName, ['VWAP confirmation failed (price above VWAP).'], 'SWING');
    }
  }

  const stopAtrMultiple = Number(params.stopAtrMultiple || 1.6);
  const targetRR = Number(params.targetRR || 2.0);

  const entry = round2(lastClose);
  const stop = bullish ? round2(entry - stopAtrMultiple * atrLast) : round2(entry + stopAtrMultiple * atrLast);
  const risk = Math.abs(entry - stop);
  const target = bullish ? round2(entry + targetRR * risk) : round2(entry - targetRR * risk);

  const why: string[] = [];
  why.push(bullish ? 'EMA20 > EMA50 and price above EMA20.' : 'EMA20 < EMA50 and price below EMA20.');
  if (vwapLast) why.push(bullish ? 'Price above VWAP (trend confirmation).' : 'Price below VWAP (trend confirmation).');
  why.push(`ATR stop: ${stopAtrMultiple}x ATR; target: ${targetRR}R.`);

  // Confidence scoring (max 10)
  let score = 0;
  score += 4;
  score += Math.min(3, Math.max(0, Math.round(Math.abs(emaSpreadPct))));
  score += (requireVwapConfirm && vwapLast) ? 2 : 1;
  score += extensionPct <= (maxExtensionPct * 0.7) ? 1 : 0;
  const confidence = scoreToConfidence(score, 10, 5, 95);
  const minConfidence = Number(params.minConfidence || 0);

  if (confidence < minConfidence) {
    return buildNoTrade(symbol, strategyId, strategyName, ['Signal quality below preset confidence threshold.'], 'SWING');
  }

  return {
    symbol,
    instrument: 'STOCK',
    action: bullish ? 'BUY' : 'SELL',
    confidence,
    strategyId,
    strategyName,
    why: clampWhy(why),
    invalidation: bullish
      ? 'Close below EMA50 (or VWAP if required by preset).'
      : 'Close above EMA50 (or VWAP if required by preset).',
    tradePlan: {
      entry,
      stop,
      target,
      horizon: 'SWING',
    },
  };
}

function evalBreakoutVolume(symbol: string, strategyId: StrategyId, strategyName: string, candles: any[], params: any): Signal {
  const closes = candles.map((c: any) => Number(c.close));
  const last = candles[candles.length - 1];
  const lastClose = Number(last?.close || 0);
  const lastVol = Number(last?.volume || 0);

  const lookbackBars = Math.max(10, Number(params.lookbackBars || 20));
  const bufPct = Number(params.breakoutBufferPct || 0.15);
  const volMult = Number(params.volumeMinMultiple || 1.6);
  const requireTrendAlignment = Boolean(params.requireTrendAlignment);

  const hi = rollingHigh(closes, lookbackBars, true);
  const lo = rollingLow(closes, lookbackBars, true);
  const breakoutUp = hi * (1 + bufPct / 100);
  const breakoutDown = lo * (1 - bufPct / 100);

  const avgVol = avgVolume(candles, lookbackBars, true);
  const volOk = avgVol > 0 ? (lastVol / avgVol) >= volMult : false;

  const ema20Arr = ema(closes, 20);
  const ema50Arr = ema(closes, 50);
  const ema20 = ema20Arr[ema20Arr.length - 1] as number | null;
  const ema50 = ema50Arr[ema50Arr.length - 1] as number | null;

  const atrArr = atr(candles, 14);
  const atrLast = atrArr[atrArr.length - 1] as number | null;

  if (!atrLast) {
    return buildNoTrade(symbol, strategyId, strategyName, ['Not enough candles to compute ATR.'], 'SWING');
  }

  const bullish = lastClose >= breakoutUp;
  const bearish = lastClose <= breakoutDown;

  if (!bullish && !bearish) {
    return buildNoTrade(symbol, strategyId, strategyName, ['No breakout trigger (price still inside range).'], 'SWING');
  }

  if (!volOk) {
    return buildNoTrade(symbol, strategyId, strategyName, ['Volume expansion not confirmed.'], 'SWING');
  }

  if (requireTrendAlignment && ema20 && ema50) {
    if (bullish && !(ema20 > ema50)) return buildNoTrade(symbol, strategyId, strategyName, ['Trend alignment filter failed (EMA20 not above EMA50).'], 'SWING');
    if (bearish && !(ema20 < ema50)) return buildNoTrade(symbol, strategyId, strategyName, ['Trend alignment filter failed (EMA20 not below EMA50).'], 'SWING');
  }

  const stopAtrMultiple = Number(params.stopAtrMultiple || 1.6);
  const targetRR = Number(params.targetRR || 2.0);

  const entry = round2(lastClose);
  const rawStop = bullish ? entry - stopAtrMultiple * atrLast : entry + stopAtrMultiple * atrLast;
  const stop = bullish ? round2(Math.min(rawStop, hi)) : round2(Math.max(rawStop, lo));
  const risk = Math.abs(entry - stop);
  const target = bullish ? round2(entry + targetRR * risk) : round2(entry - targetRR * risk);

  const why: string[] = [];
  why.push(bullish ? `Breakout above ${round2(hi)} (lookback ${lookbackBars}).` : `Breakdown below ${round2(lo)} (lookback ${lookbackBars}).`);
  why.push(`Volume expanded: ${avgVol > 0 ? round2(lastVol / avgVol) : 0}x avg.`);
  why.push(`Stop: ${stopAtrMultiple}x ATR; target: ${targetRR}R.`);

  let score = 0;
  score += 4;
  score += Math.min(3, Math.max(0, Math.round((lastVol / Math.max(1, avgVol)) * 1)));
  score += requireTrendAlignment ? 2 : 1;
  score += 1;
  const confidence = scoreToConfidence(score, 10, 5, 95);
  const minConfidence = Number(params.minConfidence || 0);
  if (confidence < minConfidence) {
    return buildNoTrade(symbol, strategyId, strategyName, ['Signal quality below preset confidence threshold.'], 'SWING');
  }

  return {
    symbol,
    instrument: 'STOCK',
    action: bullish ? 'BUY' : 'SELL',
    confidence,
    strategyId,
    strategyName,
    why: clampWhy(why),
    invalidation: bullish
      ? 'Breakout failure: close back inside prior range (below breakout level).'
      : 'Breakdown failure: close back inside prior range (above breakdown level).',
    tradePlan: {
      entry,
      stop,
      target,
      horizon: 'SWING',
    },
  };
}

function evalMeanReversion(symbol: string, strategyId: StrategyId, strategyName: string, candles: any[], params: any): Signal {
  const closes = candles.map((c: any) => Number(c.close));
  const lastClose = closes[closes.length - 1] || 0;

  const bbPeriod = Number(params.bbPeriod || 20);
  const bbStdDev = Number(params.bbStdDev || 2);
  const bbZMin = Number(params.bbZMin || 0.2);
  const vwapProxPct = Number(params.vwapProximityPct || 1.0);
  const requireVwapProx = Boolean(params.requireVwapProximity);

  const { mid, upper, lower } = bbands(closes, bbPeriod, bbStdDev);
  const midLast = mid[mid.length - 1] as number | null;
  const upperLast = upper[upper.length - 1] as number | null;
  const lowerLast = lower[lower.length - 1] as number | null;

  const vwapArr = computeVwap(candles);
  const vwapLast = vwapArr[vwapArr.length - 1] as number | null;

  const atrArr = atr(candles, 14);
  const atrLast = atrArr[atrArr.length - 1] as number | null;

  if (!midLast || !upperLast || !lowerLast || !atrLast) {
    return buildNoTrade(symbol, strategyId, strategyName, ['Not enough candles to compute Bollinger/ATR.'], 'INTRADAY');
  }

  const below = lastClose <= lowerLast;
  const above = lastClose >= upperLast;
  if (!below && !above) {
    return buildNoTrade(symbol, strategyId, strategyName, ['No Bollinger extreme (mean reversion trigger not met).'], 'INTRADAY');
  }

  // Extra extension beyond band
  const bandWidth = Math.max(1e-9, (upperLast - lowerLast));
  const extension = below ? (lowerLast - lastClose) / bandWidth : (lastClose - upperLast) / bandWidth;
  if (extension < bbZMin / 10) {
    return buildNoTrade(symbol, strategyId, strategyName, ['Band touch too shallow (needs a stronger extreme).'], 'INTRADAY');
  }

  if (requireVwapProx && vwapLast) {
    const prox = Math.abs(pctDiff(lastClose, vwapLast));
    if (prox > vwapProxPct) {
      return buildNoTrade(symbol, strategyId, strategyName, ['VWAP proximity filter failed (too far from VWAP).'], 'INTRADAY');
    }
  }

  const stopAtrMultiple = Number(params.stopAtrMultiple || 1.2);
  const targetMode = String(params.targetMode || 'VWAP');

  const entry = round2(lastClose);
  const stop = below ? round2(entry - stopAtrMultiple * atrLast) : round2(entry + stopAtrMultiple * atrLast);
  const target = targetMode === 'MID'
    ? round2(midLast)
    : vwapLast
      ? round2(vwapLast)
      : round2(midLast);

  const why: string[] = [];
  why.push(below ? 'Price at/through lower Bollinger band (oversold extreme).' : 'Price at/through upper Bollinger band (overbought extreme).');
  if (vwapLast) why.push(`Mean target: ${targetMode === 'MID' ? 'BB mid' : 'VWAP'} (~${round2(targetMode === 'MID' ? midLast : vwapLast)}).`);
  why.push(`Time stop: ${Number(params.timeStopBars || 6)} bars (preset).`);

  let score = 0;
  score += 4;
  score += extension > 0.15 ? 2 : 1;
  score += requireVwapProx ? 2 : 1;
  score += 2;
  const confidence = scoreToConfidence(score, 10, 5, 95);
  const minConfidence = Number(params.minConfidence || 0);
  if (confidence < minConfidence) {
    return buildNoTrade(symbol, strategyId, strategyName, ['Signal quality below preset confidence threshold.'], 'INTRADAY');
  }

  return {
    symbol,
    instrument: 'STOCK',
    action: below ? 'BUY' : 'SELL',
    confidence,
    strategyId,
    strategyName,
    why: clampWhy(why),
    invalidation: below
      ? 'Continue closing below the lower band with no mean reversion within time stop.'
      : 'Continue closing above the upper band with no mean reversion within time stop.',
    tradePlan: {
      entry,
      stop,
      target,
      horizon: 'INTRADAY',
    },
  };
}

function evalEventMomentum(symbol: string, strategyId: StrategyId, strategyName: string, _candles: any[], _params: any): Signal {
  // NOTE (v1): catalyst detection is intentionally conservative until evidence packets
  // are wired to earnings/news APIs in a unified way.
  return buildNoTrade(
    symbol,
    strategyId,
    strategyName,
    ['Event catalyst not wired yet (earnings/news evidence pending).'],
    'INTRADAY'
  );
}

export async function evaluateStrategySignal(input: EvalInput): Promise<{ ok: boolean; signal: Signal; error?: string; status?: number }> {
  const picked = pickPreset(input.strategyId, input.presetId);
  if (!picked) {
    return {
      ok: false,
      status: 400,
      error: 'Unknown strategy or preset',
      signal: buildNoTrade(input.symbol, input.strategyId, 'Unknown Strategy', ['Unknown strategy/preset.'], 'SWING'),
    };
  }

  const { strat, preset } = picked;
  const range = horizonToRange(strat.horizon);
  const c = await fetchStrategyCandles(input.symbol, range);
  if (!c.ok) {
    return {
      ok: false,
      status: c.status || 500,
      error: c.error || 'Candle fetch failed',
      signal: buildNoTrade(input.symbol, strat.id, strat.name, ['Failed to fetch candles for strategy evaluation.'], strat.horizon),
    };
  }

  const candles = c.candles;
  if (!candles || candles.length < 30) {
    return {
      ok: true,
      signal: buildNoTrade(input.symbol, strat.id, strat.name, ['Insufficient candle history.'], strat.horizon),
    };
  }

  let signal: Signal;
  const params = preset.params || {};

  if (strat.id === 'trend_rider') signal = evalTrendRider(input.symbol, strat.id, strat.name, candles, params);
  else if (strat.id === 'breakout_volume') signal = evalBreakoutVolume(input.symbol, strat.id, strat.name, candles, params);
  else if (strat.id === 'mean_reversion') signal = evalMeanReversion(input.symbol, strat.id, strat.name, candles, params);
  else signal = evalEventMomentum(input.symbol, strat.id, strat.name, candles, params);

  return { ok: true, signal };
}
