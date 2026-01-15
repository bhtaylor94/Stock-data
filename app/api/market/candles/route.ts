import { NextRequest, NextResponse } from 'next/server';
import { getSchwabAccessToken, schwabFetchJson } from '@/lib/schwab';

type Candle = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
};

function asNumber(v: any, d: number): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}

function clampRange(v: string): '1D' | '1W' | '1M' | '3M' | 'YTD' | '1Y' | '5Y' {
  const s = (v || '').toUpperCase();
  if (s === '1D' || s === '1W' || s === '1M' || s === '3M' || s === 'YTD' || s === '1Y' || s === '5Y') return s;
  return '1D';
}

function buildPriceHistoryUrl(symbol: string, range: ReturnType<typeof clampRange>): string {
  const base = 'https://api.schwabapi.com/marketdata/v1/pricehistory';
  const now = Date.now();

  // NOTE: Schwab pricehistory supports both (periodType/period/frequencyType/frequency)
  // and (startDate/endDate) styles. We keep this simple and stable.
  const p = new URLSearchParams({ symbol: symbol.toUpperCase() });

  if (range === '1D') {
    // Intraday-ish: 5m candles for last 1 trading day.
    p.set('periodType', 'day');
    p.set('period', '1');
    p.set('frequencyType', 'minute');
    p.set('frequency', '5');
    return `${base}?${p.toString()}`;
  }

  if (range === '1W') {
    // 5m candles across 5 trading days.
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

  if (range === '3M') {
    p.set('periodType', 'month');
    p.set('period', '3');
    p.set('frequencyType', 'daily');
    p.set('frequency', '1');
    return `${base}?${p.toString()}`;
  }

  if (range === 'YTD') {
    // Daily candles from Jan 1 to now.
    const d = new Date();
    const start = new Date(d.getFullYear(), 0, 1).getTime();
    p.set('periodType', 'year');
    p.set('period', '1');
    p.set('frequencyType', 'daily');
    p.set('frequency', '1');
    p.set('startDate', String(start));
    p.set('endDate', String(now));
    return `${base}?${p.toString()}`;
  }

  if (range === '1Y') {
    p.set('periodType', 'year');
    p.set('period', '1');
    p.set('frequencyType', 'daily');
    p.set('frequency', '1');
    return `${base}?${p.toString()}`;
  }

  // 5Y
  p.set('periodType', 'year');
  p.set('period', '5');
  p.set('frequencyType', 'weekly');
  p.set('frequency', '1');
  return `${base}?${p.toString()}`;
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const symbol = (url.searchParams.get('symbol') || url.searchParams.get('ticker') || '').trim().toUpperCase();
  const range = clampRange(url.searchParams.get('range') || '1D');

  if (!symbol) {
    return NextResponse.json({ ok: false, error: 'Missing symbol' }, { status: 400 });
  }

  const tokenResult = await getSchwabAccessToken('stock');
  if (!tokenResult.token) {
    return NextResponse.json(
      { ok: false, error: tokenResult.error || 'Schwab auth failed', status: tokenResult.status || 401 },
      { status: tokenResult.status || 401 }
    );
  }

  const histUrl = buildPriceHistoryUrl(symbol, range);
  const r = await schwabFetchJson<any>(tokenResult.token, histUrl, { scope: 'stock' });
  if (!r.ok) {
    return NextResponse.json(
      { ok: false, error: r.error, status: r.status, detail: r.text || '' },
      { status: r.status || 500 }
    );
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

  return NextResponse.json({ ok: true, symbol, range, candles });
}
