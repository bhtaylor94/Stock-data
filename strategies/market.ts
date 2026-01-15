// strategies/market.ts
// Server-side candle fetcher for strategy evaluation.

import { getSchwabAccessToken, schwabFetchJson } from '@/lib/schwab';
import type { Candle } from '@/strategies/indicators';

export type StrategyRange = '1D' | '1W' | '1M' | '3M';

function clampRange(v: string): StrategyRange {
  const s = (v || '').toUpperCase();
  if (s === '1D' || s === '1W' || s === '1M' || s === '3M') return s as StrategyRange;
  return '1M';
}

function asNumber(v: any, d: number): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}

function buildPriceHistoryUrl(symbol: string, range: StrategyRange): string {
  const base = 'https://api.schwabapi.com/marketdata/v1/pricehistory';
  const p = new URLSearchParams({ symbol: symbol.toUpperCase() });

  if (range === '1D') {
    p.set('periodType', 'day');
    p.set('period', '1');
    p.set('frequencyType', 'minute');
    p.set('frequency', '5');
    return `${base}?${p.toString()}`;
  }

  if (range === '1W') {
    p.set('periodType', 'day');
    p.set('period', '5');
    p.set('frequencyType', 'minute');
    p.set('frequency', '15');
    return `${base}?${p.toString()}`;
  }

  if (range === '1M') {
    p.set('periodType', 'month');
    p.set('period', '1');
    p.set('frequencyType', 'daily');
    p.set('frequency', '1');
    return `${base}?${p.toString()}`;
  }

  // 3M
  p.set('periodType', 'month');
  p.set('period', '3');
  p.set('frequencyType', 'daily');
  p.set('frequency', '1');
  return `${base}?${p.toString()}`;
}

export async function fetchStrategyCandles(symbol: string, rangeIn: string): Promise<{ ok: boolean; candles: Candle[]; error?: string; status?: number }> {
  const range = clampRange(rangeIn);
  const tokenResult = await getSchwabAccessToken('stock');
  if (!tokenResult.token) {
    return { ok: false, candles: [], error: tokenResult.error || 'Schwab auth failed', status: tokenResult.status || 401 };
  }

  const histUrl = buildPriceHistoryUrl(symbol, range);
  const r = await schwabFetchJson<any>(tokenResult.token, histUrl, { scope: 'stock' });
  if (!r.ok) {
    return { ok: false, candles: [], error: r.error || 'Failed to fetch candles', status: r.status || 500 };
  }

  const raw = Array.isArray(r.data?.candles) ? r.data.candles : [];
  const candles: Candle[] = raw
    .map((c: any) => ({
      time: asNumber(c.datetime, 0),
      open: asNumber(c.open, NaN),
      high: asNumber(c.high, NaN),
      low: asNumber(c.low, NaN),
      close: asNumber(c.close, NaN),
      volume: asNumber(c.volume, NaN),
    }))
    .filter((c: any) => c.time > 0 && Number.isFinite(c.close))
    .sort((a: any, b: any) => a.time - b.time)
    .map((c: any) => ({
      time: c.time,
      open: Number.isFinite(c.open) ? c.open : c.close,
      high: Number.isFinite(c.high) ? c.high : c.close,
      low: Number.isFinite(c.low) ? c.low : c.close,
      close: c.close,
      volume: Number.isFinite(c.volume) ? c.volume : undefined,
    }));

  return { ok: true, candles };
}
