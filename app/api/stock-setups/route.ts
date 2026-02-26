import { NextResponse } from 'next/server';
import { getSchwabAccessToken, SCHWAB_HEADERS } from '@/lib/schwab';
import { TTLCache } from '@/lib/cache';

// ── Constants ────────────────────────────────────────────────────────────────

const cache = new TTLCache<any>();

const WATCHLIST = [
  'AAPL', 'MSFT', 'NVDA', 'TSLA', 'GOOGL', 'AMZN', 'META', 'AMD', 'PLTR', 'COIN',
  'NFLX', 'UBER', 'SHOP', 'MELI', 'AVGO', 'QCOM', 'MU', 'AMAT', 'CRWD', 'PANW',
  'JPM', 'GS', 'V', 'MA', 'XOM', 'CVX', 'UNH', 'LLY', 'BKNG', 'ABNB',
  'SPY', 'QQQ', 'IWM', 'HOOD', 'RDDT',
];

const SECTOR_MAP: Record<string, string> = {
  AAPL: 'Technology',  MSFT: 'Technology',  GOOGL: 'Technology', META: 'Technology',
  PLTR: 'Technology',  NFLX: 'Technology',  SHOP: 'Technology',  MELI: 'Technology',
  CRWD: 'Technology',  PANW: 'Technology',  RDDT: 'Technology',
  NVDA: 'Semis',       AMD:  'Semis',       AVGO: 'Semis',
  QCOM: 'Semis',       MU:   'Semis',       AMAT: 'Semis',
  TSLA: 'Cons. Disc.', AMZN: 'Cons. Disc.', UBER: 'Cons. Disc.',
  BKNG: 'Cons. Disc.', ABNB: 'Cons. Disc.',
  JPM: 'Finance',      GS:   'Finance',     V:    'Finance',
  MA:  'Finance',      COIN: 'Finance',     HOOD: 'Finance',
  XOM: 'Energy',       CVX:  'Energy',
  UNH: 'Healthcare',   LLY:  'Healthcare',
  SPY: 'ETF',          QQQ:  'ETF',         IWM:  'ETF',
};


const FINNHUB_KEY = process.env.FINNHUB_KEY ?? '';

// ── Setup config ─────────────────────────────────────────────────────────────

interface SetupConfig {
  id: string; name: string; emoji: string;
  outlook: 'bullish' | 'bearish'; holdPeriod: string;
}

const SETUPS_CONFIG: SetupConfig[] = [
  { id: 'bull-flag',     name: 'Bull Flag',      emoji: '🚩', outlook: 'bullish', holdPeriod: '3–10 days' },
  { id: 'pullback-ma',   name: 'Pullback to MA',  emoji: '🎯', outlook: 'bullish', holdPeriod: '5–15 days' },
  { id: 'breakout',      name: 'Breakout',        emoji: '🚀', outlook: 'bullish', holdPeriod: '3–12 days' },
  { id: 'higher-lows',   name: 'Higher Lows',     emoji: '📈', outlook: 'bullish', holdPeriod: '5–20 days' },
  { id: 'double-bottom', name: 'Double Bottom',   emoji: '🔄', outlook: 'bullish', holdPeriod: '5–15 days' },
  { id: 'bear-flag',     name: 'Bear Flag',       emoji: '🔻', outlook: 'bearish', holdPeriod: '3–10 days' },
  { id: 'gap-up',        name: 'Gap Up',          emoji: '⚡', outlook: 'bullish', holdPeriod: '1–5 days'  },
];

// ── Types ────────────────────────────────────────────────────────────────────

type Candle = { open: number; close: number; high: number; low: number; volume: number };

interface SetupHit {
  hit: true; confidence: number; criteria: string[];
  entry: number; stop: number; target: number; status: string;
}
type SetupResult = SetupHit | { hit: false };

// ── Schwab data fetching ─────────────────────────────────────────────────────

async function fetchCandles(token: string, symbol: string): Promise<Candle[]> {
  try {
    const res = await fetch(
      `https://api.schwabapi.com/marketdata/v1/pricehistory?symbol=${symbol}&periodType=year&period=1&frequencyType=daily&frequency=1`,
      { headers: { Authorization: `Bearer ${token}`, ...SCHWAB_HEADERS } },
    );
    if (!res.ok) return [];
    const data = await res.json();
    return (data.candles ?? []).map((c: any) => ({
      open: c.open, close: c.close, high: c.high, low: c.low, volume: c.volume,
    }));
  } catch { return []; }
}

// ── Basic technical indicators ────────────────────────────────────────────────

function sma(prices: number[], period: number): number {
  if (prices.length < period) return prices[prices.length - 1] ?? 0;
  return prices.slice(-period).reduce((a, b) => a + b, 0) / period;
}

function ema(prices: number[], period: number): number {
  if (prices.length < period) return prices[prices.length - 1] ?? 0;
  const k = 2 / (period + 1);
  let val = prices.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < prices.length; i++) val = prices[i] * k + val * (1 - k);
  return val;
}

function rsi(prices: number[], period = 14): number {
  if (prices.length < period + 1) return 50;
  const changes = prices.slice(1).map((p, i) => p - prices[i]);
  let avgGain = 0, avgLoss = 0;
  for (let i = 0; i < period; i++) {
    if (changes[i] > 0) avgGain += changes[i];
    else avgLoss += Math.abs(changes[i]);
  }
  avgGain /= period; avgLoss /= period;
  for (let i = period; i < changes.length; i++) {
    const g = changes[i] > 0 ? changes[i] : 0;
    const l = changes[i] < 0 ? Math.abs(changes[i]) : 0;
    avgGain = (avgGain * (period - 1) + g) / period;
    avgLoss = (avgLoss * (period - 1) + l) / period;
  }
  if (avgLoss === 0) return 100;
  return 100 - 100 / (1 + avgGain / avgLoss);
}

function avgVol(candles: Candle[], period = 10): number {
  const recent = candles.slice(-period);
  return recent.reduce((s, c) => s + c.volume, 0) / recent.length;
}

// ── RS Rating (IBD-style relative strength) ───────────────────────────────────
// Weighted return: 40% 12m + 20% 6m + 20% 3m + 20% 1m (recent months count more).
// We then rank all 35 tickers and assign 1–99 score.

function weightedReturn(candles: Candle[]): number {
  if (candles.length < 10) return 0;
  const n   = candles.length;
  const cur = candles[n - 1].close;
  const at  = (days: number) => candles[Math.max(0, n - days)].close;
  const r12 = (cur - at(252)) / at(252);
  const r6  = (cur - at(126)) / at(126);
  const r3  = (cur - at(63))  / at(63);
  const r1  = (cur - at(21))  / at(21);
  return 0.4 * r12 + 0.2 * r6 + 0.2 * r3 + 0.2 * r1;
}

function buildRSRatingMap(entries: { ticker: string; ret: number }[]): Map<string, number> {
  const sorted = [...entries].sort((a, b) => a.ret - b.ret);
  const map = new Map<string, number>();
  sorted.forEach((e, i) => {
    map.set(e.ticker, Math.round(1 + (i / Math.max(sorted.length - 1, 1)) * 98));
  });
  return map;
}

// ── Volume Profile ────────────────────────────────────────────────────────────
// Distributes each candle's volume across its price range, then finds:
//   POC  — price level with most volume (price magnet)
//   VAH/VAL — value area high/low encompassing 70% of total volume

function computeVolumeProfile(candles: Candle[], bins = 60) {
  const highs  = candles.map(c => c.high);
  const lows   = candles.map(c => c.low);
  const lo     = Math.min(...lows);
  const hi     = Math.max(...highs);
  const range  = hi - lo;
  if (range <= 0) return { poc: candles[candles.length - 1].close, valueAreaHigh: hi, valueAreaLow: lo };

  const binSize = range / bins;
  const hist    = new Array(bins).fill(0);

  for (const c of candles) {
    const bLow  = Math.max(0, Math.floor((c.low  - lo) / binSize));
    const bHigh = Math.min(bins - 1, Math.floor((c.high - lo) / binSize));
    const n     = bHigh - bLow + 1;
    const vpb   = c.volume / n;
    for (let b = bLow; b <= bHigh; b++) hist[b] += vpb;
  }

  const pocBin   = hist.indexOf(Math.max(...hist));
  const poc      = lo + (pocBin + 0.5) * binSize;
  const totalVol = hist.reduce((a, b) => a + b, 0);
  const target   = totalVol * 0.70;

  let vaL = pocBin, vaH = pocBin, vaVol = hist[pocBin];
  while (vaVol < target && (vaL > 0 || vaH < bins - 1)) {
    const addL = vaL > 0        ? hist[vaL - 1] : 0;
    const addH = vaH < bins - 1 ? hist[vaH + 1] : 0;
    if (addL >= addH && vaL > 0)        { vaL--; vaVol += addL; }
    else if (vaH < bins - 1)            { vaH++; vaVol += addH; }
    else break;
  }

  return {
    poc,
    valueAreaHigh: lo + (vaH + 1) * binSize,
    valueAreaLow:  lo + vaL       * binSize,
  };
}

// ── Anchored VWAP ─────────────────────────────────────────────────────────────
// VWAP anchored from a lookback window — a cleaner mean-reversion reference
// than arbitrary moving averages. Used by institutional desks as dynamic S/R.

function anchoredVwap(candles: Candle[], lookback = 20): number {
  const slice = candles.slice(-lookback);
  let pv = 0, vol = 0;
  for (const c of slice) {
    const tp = (c.high + c.low + c.close) / 3;
    pv  += tp * c.volume;
    vol += c.volume;
  }
  return vol > 0 ? pv / vol : 0;
}

// ── Stealth Volume / Block Absorption ─────────────────────────────────────────
// Detects high-volume, tight-range candles — the fingerprint of institutional
// block accumulation/distribution without moving the market.
// When a fund absorbs supply at a level, you see: volume 2×+ avg, range <2%,
// close near high (accumulation) or low (distribution). No dark pool feed
// needed — this pattern IS the block trade signature on the tape.

function detectBlockActivity(candles: Candle[], av10: number) {
  const window = candles.slice(-30);
  let accumDays = 0, distribDays = 0;

  for (const c of window) {
    if (c.volume < av10 * 1.4) continue;                     // only elevated volume
    const rangeRatio = (c.high - c.low) / c.close;
    const body       = Math.abs(c.close - c.open);
    const fullRange  = c.high - c.low;
    const bodyRatio  = fullRange > 0 ? body / fullRange : 0;
    const closeRatio = fullRange > 0 ? (c.close - c.low) / fullRange : 0.5;

    // Absorption = high vol + tight range OR weak body = market maker soaking supply/demand
    const isAbsorption = rangeRatio < 0.02 || bodyRatio < 0.45;
    if (!isAbsorption) continue;

    if (closeRatio > 0.58) accumDays++;   // buyers absorbed all supply, closed near high
    else if (closeRatio < 0.42) distribDays++; // sellers absorbed all demand, closed near low
  }

  const net    = accumDays - distribDays;
  const signal = net >= 2 ? 'ACCUMULATION' : net <= -2 ? 'DISTRIBUTION' : 'NEUTRAL';
  const score  = Math.min(100, Math.round(
    (accumDays / 30) * 150 + (signal === 'ACCUMULATION' ? 15 : signal === 'DISTRIBUTION' ? -15 : 0) + 50,
  ));

  return { accumDays, distribDays, signal, score: Math.max(0, Math.min(100, score)) };
}

// ── FINRA RegSHO daily short-sale volume ──────────────────────────────────────
// Free, SEC-mandated daily file. Short sale volume / total volume gives a proxy
// for directional conviction: sustained >55% short ratio = heavy short pressure;
// <40% = largely long-side activity. Fetches last available trading day.

async function fetchFinraShortRatios(tickers: string[]): Promise<Map<string, number>> {
  const result = new Map<string, number>();
  try {
    // Build list of the last 5 calendar days (skip weekends)
    const dates: string[] = [];
    for (let d = 1; d <= 7 && dates.length < 4; d++) {
      const dt  = new Date(Date.now() - d * 86_400_000);
      const dow = dt.getDay();
      if (dow === 0 || dow === 6) continue;
      const pad = (n: number) => String(n).padStart(2, '0');
      dates.push(`${dt.getFullYear()}${pad(dt.getMonth() + 1)}${pad(dt.getDate())}`);
    }

    for (const date of dates) {
      const url = `https://cdn.finra.org/equity/regsho/daily/CNMSshvol${date}.txt`;
      const res = await fetch(url, {
        headers: { 'User-Agent': SCHWAB_HEADERS['User-Agent'] },
        signal: AbortSignal.timeout(6_000),
      });
      if (!res.ok) continue;

      const text  = await res.text();
      const lines = text.split('\n').slice(1); // skip header

      for (const line of lines) {
        const parts = line.trim().split('|');
        if (parts.length < 5) continue;
        const sym      = parts[1]?.trim();
        if (!sym || !tickers.includes(sym)) continue;
        const shortVol = parseInt(parts[2] ?? '0', 10);
        const totalVol = parseInt(parts[4] ?? '0', 10);
        if (totalVol > 0) result.set(sym, shortVol / totalVol);
      }

      if (result.size > 0) break; // got data — done
    }
  } catch { /* graceful — short data is supplemental */ }
  return result;
}

// ── Finnhub helpers ───────────────────────────────────────────────────────────

async function fetchFinnhubInsiders(symbol: string): Promise<any | null> {
  if (!FINNHUB_KEY) return null;
  try {
    const from = new Date(Date.now() - 90 * 86_400_000).toISOString().split('T')[0];
    const res  = await fetch(
      `https://finnhub.io/api/v1/stock/insider-transactions?symbol=${symbol}&from=${from}&token=${FINNHUB_KEY}`,
      { signal: AbortSignal.timeout(5_000) },
    );
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}

async function fetchFinnhubEarnings(symbol: string): Promise<any[]> {
  if (!FINNHUB_KEY) return [];
  try {
    const res = await fetch(
      `https://finnhub.io/api/v1/stock/earnings?symbol=${symbol}&limit=8&token=${FINNHUB_KEY}`,
      { signal: AbortSignal.timeout(5_000) },
    );
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch { return []; }
}

// ── Insider score ─────────────────────────────────────────────────────────────

function computeInsiderScore(raw: any): {
  score: number; buys90d: number; totalValue: number;
  clusterBuy: boolean; seniorBuy: boolean; lastBuyDaysAgo: number | null;
} {
  const empty = { score: 50, buys90d: 0, totalValue: 0, clusterBuy: false, seniorBuy: false, lastBuyDaysAgo: null };
  if (!raw?.data?.length) return empty;

  const txns  = raw.data as any[];
  const now   = Date.now();
  const SENIOR_TITLES = /\b(CEO|CFO|COO|President|Chairman|Director)\b/i;
  const GRANT_NAMES   = /award|grant|option|restricted|vesting|conversion/i;

  // Filter: open-market purchases only (positive change, no option exercises)
  const buys = txns.filter(t =>
    (t.change ?? t.share ?? 0) > 0 &&
    !GRANT_NAMES.test(t.transactionDescription ?? '') &&
    t.transactionDate
  );

  if (buys.length === 0) return empty;

  const buysWithMeta = buys.map(t => ({
    ...t,
    daysAgo:    Math.round((now - new Date(t.transactionDate).getTime()) / 86_400_000),
    value:      (t.transactionPrice ?? 0) * Math.abs(t.change ?? t.share ?? 0),
    isSenior:   SENIOR_TITLES.test(t.name ?? ''),
  }));

  const recentBuys  = buysWithMeta.filter(t => t.daysAgo <= 90);
  const buys30d     = buysWithMeta.filter(t => t.daysAgo <= 30);
  const clusterBuy  = buys30d.length >= 3;
  const seniorBuy   = recentBuys.some(t => t.isSenior);
  const totalValue  = recentBuys.reduce((s, t) => s + t.value, 0);
  const lastBuyDaysAgo = recentBuys.length > 0
    ? Math.min(...recentBuys.map(t => t.daysAgo)) : null;

  // Score: base + cluster + senior + recency + value
  let score = 50;
  score += Math.min(recentBuys.length * 6, 20);         // up to +20 for volume of buys
  if (clusterBuy)  score += 15;                          // cluster = very bullish
  if (seniorBuy)   score += 10;                          // C-suite has highest info
  if (lastBuyDaysAgo !== null && lastBuyDaysAgo <= 14) score += 5; // recent = fresh signal
  if (totalValue > 1_000_000) score += 5;               // big dollar commitment

  return {
    score: Math.min(100, Math.round(score)),
    buys90d: recentBuys.length,
    totalValue,
    clusterBuy,
    seniorBuy,
    lastBuyDaysAgo,
  };
}

// ── Earnings quality score ────────────────────────────────────────────────────

function computeEarningsScore(earnings: any[]): {
  score: number; beatRate: number; revBeatRate: number;
  estimateTrend: 'RISING' | 'FALLING' | 'FLAT';
  lastSurprisePct: number | null;
} {
  const empty = { score: 50, beatRate: 0, revBeatRate: 0, estimateTrend: 'FLAT' as const, lastSurprisePct: null };
  if (!earnings.length) return empty;

  const recent  = earnings.slice(0, 8); // most recent up to 8 quarters
  const beats   = recent.filter(e => (e.surprise ?? 0) > 0);
  const beatRate = beats.length / recent.length;

  // Estimate trend: compare most recent estimate to the one 2 quarters ago
  const latest  = recent[0];
  const older   = recent[2];
  let estimateTrend: 'RISING' | 'FALLING' | 'FLAT' = 'FLAT';
  if (latest?.estimate != null && older?.estimate != null) {
    const delta = latest.estimate - older.estimate;
    if (delta >  0.02) estimateTrend = 'RISING';
    else if (delta < -0.02) estimateTrend = 'FALLING';
  }

  const lastSurprisePct = latest?.surprisePercent ?? null;

  // Score
  let score = 50;
  score += Math.round(beatRate * 30);                              // +0 to +30 for beat rate
  if (estimateTrend === 'RISING')  score += 15;
  if (estimateTrend === 'FALLING') score -= 10;
  if ((lastSurprisePct ?? 0) > 5) score += 5;                    // strong last beat

  return {
    score: Math.min(100, Math.max(0, Math.round(score))),
    beatRate,
    revBeatRate: beatRate, // same source for now
    estimateTrend,
    lastSurprisePct,
  };
}

// ── Conviction composite ──────────────────────────────────────────────────────
// Weights: setup pattern 30 · RS rating 25 · insider 20 · stealth vol 15 · earnings 10

function computeConviction({
  setupConfidence, rsRating, insiderScore, stealthScore, earningsScore,
}: {
  setupConfidence: number; rsRating: number; insiderScore: number;
  stealthScore: number; earningsScore: number;
}): number {
  return Math.min(100, Math.round(
    setupConfidence * 0.30 +
    rsRating        * 0.25 +
    insiderScore    * 0.20 +
    stealthScore    * 0.15 +
    earningsScore   * 0.10,
  ));
}

// ── Setup detectors ───────────────────────────────────────────────────────────

function detectBullFlag(candles: Candle[], av10: number, rsiVal: number, sma50: number): SetupResult {
  if (candles.length < 15) return { hit: false };
  let bestPole: { start: number; end: number; gain: number; poleVol: number } | null = null;
  for (let pLen = 3; pLen <= 5; pLen++) {
    const pEnd = candles.length - 3, pStart = pEnd - pLen;
    if (pStart < 0) continue;
    const pole    = candles.slice(pStart, pEnd);
    const allUp   = pole.every((c, i) => i === 0 || c.close > pole[i - 1].close);
    const gain    = (pole[pole.length - 1].close - pole[0].open) / pole[0].open;
    const poleVol = pole.reduce((s, c) => s + c.volume, 0) / pole.length;
    if (allUp && gain >= 0.05 && poleVol >= av10 * 1.3) { bestPole = { start: pStart, end: pEnd, gain, poleVol }; break; }
  }
  if (!bestPole) return { hit: false };
  const flag = candles.slice(bestPole.end);
  if (flag.length < 2) return { hit: false };
  const flagHigh   = Math.max(...flag.map(c => c.high));
  const flagLow    = Math.min(...flag.map(c => c.low));
  const flagRange  = (flagHigh - flagLow) / candles[bestPole.end - 1].close;
  const flagVol    = flag.reduce((s, c) => s + c.volume, 0) / flag.length;
  if (flagRange > bestPole.gain * 0.5 || flagVol > bestPole.poleVol * 0.65) return { hit: false };
  const latest     = candles[candles.length - 1];
  const poleHeight = bestPole.gain * candles[bestPole.start].open;
  const status     = latest.close > flagHigh && latest.volume > av10 * 1.4 ? 'BREAKOUT' : 'FORMING';
  const criteria   = [
    `Pole: +${(bestPole.gain * 100).toFixed(1)}% over ${bestPole.end - bestPole.start}d on ${(bestPole.poleVol / av10).toFixed(1)}× vol`,
    `Flag: ${(flagRange * 100).toFixed(1)}% range, vol dried to ${(flagVol / av10).toFixed(2)}× avg`,
  ];
  if (status === 'BREAKOUT') criteria.push('Breaking flag high on volume ✓');
  let c = (2 / 3) * 65;
  if (rsiVal >= 50 && rsiVal <= 70) c += 15; else if (rsiVal >= 45) c += 8;
  if (latest.volume > av10 * 1.2) c += 10;
  if (latest.close > sma50) c += 10;
  return { hit: true, confidence: Math.min(Math.round(c), 100), criteria, entry: flagHigh, stop: flagLow, target: flagHigh + poleHeight, status };
}

function detectPullbackMA(candles: Candle[], av10: number, rsiVal: number, sma20: number, sma50: number): SetupResult {
  if (candles.length < 20 || sma20 <= sma50) return { hit: false };
  const latest = candles[candles.length - 1];
  const dist   = (latest.close - sma20) / sma20;
  if (dist < -0.03 || dist > 0.03 || rsiVal < 30 || rsiVal > 52) return { hit: false };
  const last3Vol = candles.slice(-3).reduce((s, c) => s + c.volume, 0) / 3;
  if (last3Vol >= av10) return { hit: false };
  const priorHigh = Math.max(...candles.slice(-20).map(c => c.high));
  const criteria  = [
    `SMA20 ($${sma20.toFixed(2)}) > SMA50 ($${sma50.toFixed(2)}) — uptrend confirmed`,
    `Price within ${(Math.abs(dist) * 100).toFixed(1)}% of SMA20`,
    `RSI ${rsiVal.toFixed(0)} — oversold pullback in uptrend`,
    `Volume dry-up: ${(last3Vol / av10).toFixed(2)}× 10d avg`,
  ];
  let c = 65;
  if (rsiVal >= 35 && rsiVal <= 48) c += 15; else if (rsiVal >= 30) c += 8;
  if (last3Vol < av10 * 0.7) c += 10;
  c += 10;
  return { hit: true, confidence: Math.min(Math.round(c), 100), criteria, entry: latest.close, stop: sma50 * 0.98, target: priorHigh, status: 'FORMING' };
}

function detectBreakout(candles: Candle[], av10: number, rsiVal: number, sma50: number): SetupResult {
  if (candles.length < 20) return { hit: false };
  const lookback = Math.min(15, candles.length - 1);
  const cons = candles.slice(-lookback - 1, -1);
  if (cons.length < 5) return { hit: false };
  const avgRange  = cons.reduce((s, c) => s + (c.high - c.low) / c.close, 0) / cons.length;
  if (avgRange > 0.03) return { hit: false };
  const consHigh  = Math.max(...cons.map(c => c.high));
  const consLow   = Math.min(...cons.map(c => c.low));
  const latest    = candles[candles.length - 1];
  if ((consHigh - latest.close) / consHigh > 0.05 || latest.volume < av10 * 1.4) return { hit: false };
  const status    = latest.close > consHigh ? 'BREAKOUT' : 'FORMING';
  const criteria: string[] = [
    `${cons.length}d tight consolidation: ${(avgRange * 100).toFixed(1)}% avg daily range`,
    `Price near consolidation high ($${consHigh.toFixed(2)})`,
    `Volume surge: ${(latest.volume / av10).toFixed(1)}× avg`,
  ];
  let c = (3 / 4) * 65;
  if (rsiVal >= 50 && rsiVal <= 65) { c += 15; criteria.push(`RSI ${rsiVal.toFixed(0)} — momentum building`); } else c += 5;
  if (latest.volume > av10 * 2) c += 10; else if (latest.volume > av10 * 1.4) c += 5;
  if (latest.close > sma50) c += 10;
  return { hit: true, confidence: Math.min(Math.round(c), 100), criteria, entry: consHigh, stop: consLow, target: consHigh + 2 * (consHigh - consLow), status };
}

function detectHigherLows(candles: Candle[], av10: number, rsiVal: number, ema20v: number, ema50v: number, sma50: number): SetupResult {
  if (candles.length < 30 || ema20v <= ema50v) return { hit: false };
  const latest = candles[candles.length - 1];
  if (latest.close <= ema20v || rsiVal < 45 || rsiVal > 65) return { hit: false };
  const recent = candles.slice(-30);
  const lows: number[] = [];
  for (let i = 2; i < recent.length - 2; i++) {
    if (recent[i].low < recent[i-1].low && recent[i].low < recent[i+1].low &&
        recent[i].low < recent[i-2].low && recent[i].low < recent[i+2].low) lows.push(recent[i].low);
  }
  if (lows.length < 2) return { hit: false };
  const higherLows = lows.every((v, i) => i === 0 || v > lows[i - 1]);
  if (!higherLows) return { hit: false };
  const priorHigh = Math.max(...recent.map(c => c.high));
  const criteria  = [
    `EMA20 ($${ema20v.toFixed(2)}) > EMA50 ($${ema50v.toFixed(2)}) — bullish stack`,
    `Price above EMA20`,
    `RSI ${rsiVal.toFixed(0)} — healthy momentum zone`,
    `${lows.length} progressive higher lows confirmed`,
  ];
  let c = (4 / 5) * 65;
  if (rsiVal >= 50 && rsiVal <= 60) c += 15; else c += 8;
  if (latest.volume > av10 * 0.8) c += 5;
  if (latest.close > sma50) c += 10;
  return { hit: true, confidence: Math.min(Math.round(c), 100), criteria, entry: latest.close, stop: lows[lows.length - 1] * 0.99, target: priorHigh, status: 'FORMING' };
}

function detectDoubleBottom(candles: Candle[], av10: number, rsiVal: number, sma50: number): SetupResult {
  if (candles.length < 20) return { hit: false };
  const recent = candles.slice(-40);
  const lows: { idx: number; price: number }[] = [];
  for (let i = 2; i < recent.length - 2; i++) {
    if (recent[i].low < recent[i-1].low && recent[i].low < recent[i+1].low &&
        recent[i].low < recent[i-2].low && recent[i].low < recent[i+2].low)
      lows.push({ idx: i, price: recent[i].low });
  }
  if (lows.length < 2) return { hit: false };
  const low1 = lows[lows.length - 2], low2 = lows[lows.length - 1];
  if (low2.idx - low1.idx < 5 || Math.abs(low2.price - low1.price) / low1.price > 0.03) return { hit: false };
  const neckline      = Math.max(...recent.slice(low1.idx, low2.idx + 1).map(c => c.high));
  const patternHeight = neckline - Math.min(low1.price, low2.price);
  const latest        = candles[candles.length - 1];
  const status        = latest.close > neckline ? 'CONFIRMED' : 'FORMING';
  const criteria      = [
    `Two lows: $${low1.price.toFixed(2)} and $${low2.price.toFixed(2)} (${(Math.abs(low2.price - low1.price) / low1.price * 100).toFixed(1)}% apart)`,
    `Separated by ${low2.idx - low1.idx} candles`,
    `Neckline: $${neckline.toFixed(2)}`,
  ];
  if (status === 'CONFIRMED') criteria.push('Price above neckline — confirmed ✓');
  let c = (3 / 5) * 65;
  if (rsiVal >= 40 && rsiVal <= 60) c += 10;
  if (latest.volume > av10) c += 10;
  if (latest.close > sma50) c += 10;
  return { hit: true, confidence: Math.min(Math.round(c), 100), criteria, entry: neckline, stop: Math.min(low1.price, low2.price) * 0.98, target: neckline + patternHeight, status };
}

function detectBearFlag(candles: Candle[], av10: number, rsiVal: number, sma50: number): SetupResult {
  if (candles.length < 15 || rsiVal >= 50) return { hit: false };
  let bestPole: { start: number; end: number; drop: number; poleVol: number } | null = null;
  for (let pLen = 3; pLen <= 5; pLen++) {
    const pEnd = candles.length - 3, pStart = pEnd - pLen;
    if (pStart < 0) continue;
    const pole    = candles.slice(pStart, pEnd);
    const allDown = pole.every((c, i) => i === 0 || c.close < pole[i - 1].close);
    const drop    = (pole[0].open - pole[pole.length - 1].close) / pole[0].open;
    const poleVol = pole.reduce((s, c) => s + c.volume, 0) / pole.length;
    if (allDown && drop >= 0.05 && poleVol >= av10 * 1.3) { bestPole = { start: pStart, end: pEnd, drop, poleVol }; break; }
  }
  if (!bestPole) return { hit: false };
  const flag = candles.slice(bestPole.end);
  if (flag.length < 2) return { hit: false };
  const flagHigh  = Math.max(...flag.map(c => c.high));
  const flagLow   = Math.min(...flag.map(c => c.low));
  const flagRange = (flagHigh - flagLow) / candles[bestPole.end - 1].close;
  const flagVol   = flag.reduce((s, c) => s + c.volume, 0) / flag.length;
  if (flagRange > bestPole.drop * 0.5 || flagVol > bestPole.poleVol * 0.65) return { hit: false };
  const poleHeight = bestPole.drop * candles[bestPole.start].open;
  const latest     = candles[candles.length - 1];
  const status     = latest.close < flagLow && latest.volume > av10 * 1.4 ? 'BREAKDOWN' : 'FORMING';
  const criteria   = [
    `Pole: -${(bestPole.drop * 100).toFixed(1)}% over ${bestPole.end - bestPole.start}d on high vol`,
    `Flag bounce: ${(flagRange * 100).toFixed(1)}% range, vol drying`,
    `RSI ${rsiVal.toFixed(0)} — unable to reclaim 50`,
  ];
  if (status === 'BREAKDOWN') criteria.push('Breaking below flag low on volume ✓');
  let c = (3 / 4) * 65;
  if (rsiVal < 40) c += 15; else if (rsiVal < 50) c += 8;
  if (latest.volume > av10 * 1.2) c += 10;
  if (latest.close < sma50) c += 10;
  return { hit: true, confidence: Math.min(Math.round(c), 100), criteria, entry: flagLow, stop: flagHigh, target: flagLow - poleHeight, status };
}

function detectGapUp(candles: Candle[], av10: number, rsiVal: number, sma50: number): SetupResult {
  if (candles.length < 5) return { hit: false };
  const latest = candles[candles.length - 1], prior = candles[candles.length - 2];
  const gapPct = (latest.open - prior.close) / prior.close;
  if (gapPct < 0.03 || latest.volume < av10 * 2 || latest.low < prior.close) return { hit: false };
  const resistance = Math.max(...candles.slice(-20).map(c => c.high));
  const criteria: string[] = [
    `Gap up: +${(gapPct * 100).toFixed(1)}% from prior close ($${prior.close.toFixed(2)})`,
    `Volume: ${(latest.volume / av10).toFixed(1)}× avg — institutional participation`,
    `Gap holding — price above $${prior.close.toFixed(2)}`,
  ];
  let c = (3 / 4) * 65;
  if (rsiVal >= 50 && rsiVal <= 70) { c += 15; criteria.push(`RSI ${rsiVal.toFixed(0)} — momentum`); } else c += 5;
  if (latest.volume > av10 * 3) c += 10; else if (latest.volume > av10 * 2) c += 5;
  if (latest.close > sma50) c += 10;
  return { hit: true, confidence: Math.min(Math.round(c), 100), criteria, entry: latest.open, stop: prior.close * 0.99, target: resistance, status: 'FORMING' };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function confidenceLabel(score: number): 'VERY_HIGH' | 'HIGH' | 'MEDIUM' {
  return score >= 80 ? 'VERY_HIGH' : score >= 65 ? 'HIGH' : 'MEDIUM';
}

function riskReward(entry: number, stop: number, target: number): string {
  const risk = Math.abs(entry - stop), reward = Math.abs(target - entry);
  if (risk === 0) return 'N/A';
  return `1:${(reward / risk).toFixed(1)}`;
}

// ── Main handler ──────────────────────────────────────────────────────────────

export async function GET() {
  const cached = cache.get('stock-setups-v2');
  if (cached) return NextResponse.json(cached);

  const { token, error } = await getSchwabAccessToken('stock');
  if (!token) return NextResponse.json({ error }, { status: 500 });

  // ── 1. Fetch 1 year of candles for all 35 tickers ─────────────────────────
  const allData = await Promise.all(
    WATCHLIST.map(ticker => fetchCandles(token, ticker).then(candles => ({ ticker, candles }))),
  );

  // ── 2. Build RS Rating map across the entire watchlist ────────────────────
  const rsInputs = allData.map(({ ticker, candles }) => ({ ticker, ret: weightedReturn(candles) }));
  const rsMap    = buildRSRatingMap(rsInputs);

  // ── 3. Fetch FINRA short volume (one file, all tickers, best-effort) ───────
  const finraMap = await fetchFinraShortRatios(WATCHLIST);

  // ── 4. Run setup detection for each ticker ────────────────────────────────
  const rawSetups: any[] = [];

  for (const { ticker, candles } of allData) {
    if (candles.length < 20) continue;

    // Use last ~63 candles (3 months) for setup detection
    const sc    = candles.slice(-63);
    const ac    = candles;                             // full year for indicators
    const cl    = sc.map(c => c.close);
    const acl   = ac.map(c => c.close);               // full closes for RSI
    const sma20 = sma(cl, Math.min(20, cl.length));
    const sma50 = sma(cl, Math.min(50, cl.length));
    const ema20 = ema(cl, Math.min(20, cl.length));
    const ema50 = ema(cl, Math.min(50, cl.length));
    const rv    = rsi(acl, 14);
    const av10  = avgVol(sc, 10);

    // All detectors
    const detections: { cfg: SetupConfig; res: SetupHit }[] = [];
    const tryAdd = (cfg: SetupConfig, r: SetupResult) => { if (r.hit) detections.push({ cfg, res: r }); };

    tryAdd(SETUPS_CONFIG[0], detectBullFlag(sc, av10, rv, sma50));
    tryAdd(SETUPS_CONFIG[1], detectPullbackMA(sc, av10, rv, sma20, sma50));
    tryAdd(SETUPS_CONFIG[2], detectBreakout(sc, av10, rv, sma50));
    tryAdd(SETUPS_CONFIG[3], detectHigherLows(sc, av10, rv, ema20, ema50, sma50));
    tryAdd(SETUPS_CONFIG[4], detectDoubleBottom(sc, av10, rv, sma50));
    tryAdd(SETUPS_CONFIG[5], detectBearFlag(sc, av10, rv, sma50));
    tryAdd(SETUPS_CONFIG[6], detectGapUp(sc, av10, rv, sma50));

    if (detections.length === 0) continue;
    const best = detections.reduce((a, b) => a.res.confidence >= b.res.confidence ? a : b);
    if (best.res.confidence < 50) continue;

    const latest    = sc[sc.length - 1];
    const prior     = sc.length >= 2 ? sc[sc.length - 2] : latest;
    const price     = latest.close;
    const changePct = ((price - prior.close) / prior.close) * 100;
    const rsRating  = rsMap.get(ticker) ?? 50;

    // Volume profile + VWAP from last 63 days
    const volProfile  = computeVolumeProfile(sc);
    const avwap       = anchoredVwap(sc, 20);
    const blockAct    = detectBlockActivity(sc, av10);
    const shortRatio  = finraMap.get(ticker) ?? null;

    rawSetups.push({
      ticker,
      price,
      changePct,
      sector: SECTOR_MAP[ticker] ?? 'Other',
      rsRating,
      rsLabel: rsRating >= 80 ? 'LEADER' : rsRating >= 60 ? 'STRONG' : rsRating >= 40 ? 'AVERAGE' : 'WEAK',
      volProfile,
      avwap,
      blockActivity: blockAct,
      shortRatio,
      setup: {
        id:              best.cfg.id,
        name:            best.cfg.name,
        emoji:           best.cfg.emoji,
        outlook:         best.cfg.outlook,
        status:          best.res.status,
        confidence:      best.res.confidence,
        confidenceLabel: confidenceLabel(best.res.confidence),
        criteria:        best.res.criteria,
        entry:           best.res.entry,
        stop:            best.res.stop,
        target:          best.res.target,
        riskReward:      riskReward(best.res.entry, best.res.stop, best.res.target),
        holdPeriod:      best.cfg.holdPeriod,
      },
    });
  }

  // ── 5. Enrich with Finnhub data (insider + earnings) ─────────────────────
  if (FINNHUB_KEY) {
    // Batch in groups of 5 with small delay to respect rate limits
    const batchSize = 5;
    for (let i = 0; i < rawSetups.length; i += batchSize) {
      const batch = rawSetups.slice(i, i + batchSize);
      await Promise.all(batch.map(async (r) => {
        const [insiderRaw, earningsRaw] = await Promise.all([
          fetchFinnhubInsiders(r.ticker),
          fetchFinnhubEarnings(r.ticker),
        ]);
        r.insider  = computeInsiderScore(insiderRaw);
        r.earnings = computeEarningsScore(earningsRaw);
      }));
      if (i + batchSize < rawSetups.length) await new Promise(res => setTimeout(res, 250));
    }
  } else {
    // No Finnhub key — use neutral defaults
    for (const r of rawSetups) {
      r.insider  = { score: 50, buys90d: 0, totalValue: 0, clusterBuy: false, seniorBuy: false, lastBuyDaysAgo: null };
      r.earnings = { score: 50, beatRate: 0, revBeatRate: 0, estimateTrend: 'FLAT', lastSurprisePct: null };
    }
  }

  // ── 6. Compute conviction scores + finalise ───────────────────────────────
  for (const r of rawSetups) {
    r.conviction = computeConviction({
      setupConfidence: r.setup.confidence,
      rsRating:        r.rsRating,
      insiderScore:    r.insider.score,
      stealthScore:    r.blockActivity.score,
      earningsScore:   r.earnings.score,
    });
    r.convictionLabel = r.conviction >= 80 ? 'VERY_HIGH' : r.conviction >= 65 ? 'HIGH' : 'MEDIUM';
  }

  // ── 7. Sort by conviction, cap at 25 ─────────────────────────────────────
  rawSetups.sort((a, b) => b.conviction - a.conviction);
  const top = rawSetups.slice(0, 25);

  const payload = { setups: top, generatedAt: new Date().toISOString(), count: top.length };
  cache.set('stock-setups-v2', payload, 5 * 60 * 1000);

  return NextResponse.json(payload);
}
