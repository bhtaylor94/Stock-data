import { NextResponse } from 'next/server';
import { getSchwabAccessToken, schwabFetchJson } from '@/lib/schwab';
import { TTLCache } from '@/lib/cache';

const cache = new TTLCache<any>();
const CACHE_TTL = 90_000; // 90 seconds

// Top liquid tickers with the most active options markets
const SCAN_TICKERS = [
  'SPY', 'QQQ', 'AAPL', 'TSLA', 'NVDA',
  'AMD', 'MSFT', 'META', 'AMZN', 'GOOGL',
];

export interface FlowSignal {
  ticker: string;
  currentPrice: number;
  strike: number;
  type: 'call' | 'put';
  expiration: string;
  dte: number;
  mark: number;
  premium: number;
  volume: number;
  openInterest: number;
  volumeOIRatio: number;
  iv: number;
  delta: number;
  score: number;
  reasons: string[];
  alertLabel: string;
}

// ── Strong Buy Scoring ─────────────────────────────────────────────────────────
//
// Based on methodologies from Unusual Whales, FlowAlgo, Barchart, and
// Market Chameleon. A strong buy signal needs MULTIPLE confirming factors:
//
// 1. Vol/OI > 2× — new positions being opened (not closing)
// 2. Premium size — institutional money leaves big footprints
// 3. High absolute volume — real activity, not noise
// 4. Delta 0.25–0.65 — directional leverage (not deep ITM hedges)
// 5. DTE 14–60 days — targeted directional bet, not long-dated hedge
// 6. IV not extreme — buying overpriced options hurts expected value
//
function scoreContract(
  c: any,
  strikeStr: string,
  expDate: string,
  ticker: string,
  currentPrice: number,
): FlowSignal | null {
  const strike = parseFloat(strikeStr);
  const volume = c.totalVolume || 0;
  const oi = c.openInterest || 0;
  const bid = c.bid ?? 0;
  const ask = c.ask ?? 0;
  const mark = ask > 0 ? (bid + ask) / 2 : (c.last ?? 0);
  const premium = mark * volume * 100;
  const volOI = oi > 0 ? volume / oi : volume > 0 ? 99 : 0;
  const delta = c.delta ?? 0;
  const dte = c.daysToExpiration ?? 0;
  const iv = (c.volatility ?? 0) / 100;

  // Hard minimums — skip noise
  if (volume < 100) return null;
  if (mark <= 0) return null;
  if (premium < 10_000) return null;
  if (dte < 3 || dte > 365) return null;
  if (volOI < 2) return null; // Not opening new positions

  let score = 0;
  const reasons: string[] = [];

  // ── Vol / OI ratio ────────────────────────────────────────────────────────
  if (volOI >= 10) {
    score += 30;
    reasons.push(`Vol/OI ${volOI.toFixed(0)}× — massive new positioning`);
  } else if (volOI >= 5) {
    score += 20;
    reasons.push(`Vol/OI ${volOI.toFixed(1)}× — strong new positioning`);
  } else if (volOI >= 3) {
    score += 12;
    reasons.push(`Vol/OI ${volOI.toFixed(1)}× — elevated new positions`);
  } else {
    score += 5;
  }

  // ── Premium size ──────────────────────────────────────────────────────────
  if (premium >= 1_000_000) {
    score += 30;
    reasons.push(`$${(premium / 1e6).toFixed(1)}M premium — major institutional`);
  } else if (premium >= 500_000) {
    score += 22;
    reasons.push(`$${(premium / 1e6).toFixed(2)}M premium — institutional`);
  } else if (premium >= 100_000) {
    score += 14;
    reasons.push(`$${(premium / 1e3).toFixed(0)}K premium`);
  } else if (premium >= 50_000) {
    score += 8;
    reasons.push(`$${(premium / 1e3).toFixed(0)}K premium`);
  } else {
    score += 2;
  }

  // ── Absolute volume ───────────────────────────────────────────────────────
  if (volume >= 10_000) {
    score += 15;
    reasons.push(`${volume.toLocaleString()} contracts traded`);
  } else if (volume >= 5_000) {
    score += 10;
    reasons.push(`${volume.toLocaleString()} contracts`);
  } else if (volume >= 1_000) {
    score += 5;
  }

  // ── Delta (directional sweet spot 0.25–0.65) ─────────────────────────────
  const absDelta = Math.abs(delta);
  if (absDelta >= 0.30 && absDelta <= 0.60) {
    score += 12;
    reasons.push(`Δ${delta.toFixed(2)} — directional sweet spot`);
  } else if (absDelta >= 0.20 && absDelta <= 0.70) {
    score += 6;
  } else if (absDelta > 0.85) {
    return null; // Deep ITM = likely exercise/hedge, not speculative
  }

  // ── DTE (ideal 14–60 days) ────────────────────────────────────────────────
  if (dte >= 14 && dte <= 60) {
    score += 12;
    reasons.push(`${dte}d to expiry — ideal timeframe`);
  } else if (dte >= 7 && dte <= 90) {
    score += 6;
    reasons.push(`${dte}d to expiry`);
  } else if (dte < 7) {
    score -= 10;
  }

  // ── IV environment ────────────────────────────────────────────────────────
  if (iv > 0 && iv < 0.40) {
    score += 8;
    reasons.push(`IV ${(iv * 100).toFixed(0)}% — not overpriced`);
  } else if (iv >= 0.40 && iv < 0.70) {
    score += 3;
  }

  // Minimum score to qualify
  if (score < 30) return null;

  // ── Alert label ───────────────────────────────────────────────────────────
  let alertLabel = 'Unusual Call Flow';
  if (volOI >= 10 && premium >= 100_000) alertLabel = 'Golden Sweep';
  else if (premium >= 500_000) alertLabel = 'Block Trade';
  else if (volOI >= 5) alertLabel = 'High Conviction';
  else if (volOI >= 3) alertLabel = 'Sweep';

  return {
    ticker,
    currentPrice,
    strike,
    type: 'call',
    expiration: expDate,
    dte,
    mark,
    premium,
    volume,
    openInterest: oi,
    volumeOIRatio: Math.round(volOI * 10) / 10,
    iv,
    delta,
    score,
    reasons,
    alertLabel,
  };
}

async function scanTicker(token: string, ticker: string): Promise<FlowSignal[]> {
  const url =
    `https://api.schwabapi.com/marketdata/v1/chains` +
    `?symbol=${ticker}&contractType=CALL&strikeCount=20` +
    `&includeUnderlyingQuote=true&range=ALL`;

  const result = await schwabFetchJson<any>(token, url, { scope: 'stock' });
  if (!result.ok) return [];

  const chainData = result.data;
  const currentPrice: number =
    chainData.underlyingPrice ??
    chainData.underlying?.mark ??
    chainData.underlying?.last ??
    0;
  if (!currentPrice) return [];

  const signals: FlowSignal[] = [];
  const callMap = chainData.callExpDateMap ?? {};

  for (const [expKey, strikes] of Object.entries(callMap)) {
    const expDate = (expKey as string).split(':')[0];
    for (const [strikeStr, contracts] of Object.entries(strikes as Record<string, any[]>)) {
      if (!contracts || contracts.length === 0) continue;
      const signal = scoreContract(contracts[0], strikeStr, expDate, ticker, currentPrice);
      if (signal) signals.push(signal);
    }
  }

  return signals;
}

export async function GET() {
  const cached = cache.get('flow-scan');
  if (cached) return NextResponse.json(cached);

  const { token, error } = await getSchwabAccessToken('stock');
  if (!token) {
    return NextResponse.json({ error, signals: [] }, { status: 500 });
  }

  // Scan all tickers in parallel
  const results = await Promise.allSettled(
    SCAN_TICKERS.map(ticker => scanTicker(token, ticker)),
  );

  const allSignals: FlowSignal[] = [];
  for (const r of results) {
    if (r.status === 'fulfilled') allSignals.push(...r.value);
  }

  // Sort by score descending, deduplicate same ticker+strike
  const seen = new Set<string>();
  const topSignals = allSignals
    .sort((a, b) => b.score - a.score)
    .filter(s => {
      const key = `${s.ticker}-${s.strike}-${s.expiration}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 15);

  const response = {
    signals: topSignals,
    scannedAt: new Date().toISOString(),
    tickersScanned: SCAN_TICKERS.length,
  };

  cache.set('flow-scan', response, CACHE_TTL);
  return NextResponse.json(response);
}
