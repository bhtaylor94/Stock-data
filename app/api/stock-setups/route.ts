import { NextResponse } from 'next/server';
import { getSchwabAccessToken } from '@/lib/schwab';
import { TTLCache } from '@/lib/cache';

// ── Constants ───────────────────────────────────────────────────────────────

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

const SCHWAB_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'application/json',
  'Accept-Language': 'en-US,en;q=0.9',
};

// ── Types ───────────────────────────────────────────────────────────────────

type Candle = { open: number; close: number; high: number; low: number; volume: number };

interface SetupHit {
  hit: true;
  confidence: number;
  criteria: string[];
  entry: number;
  stop: number;
  target: number;
  status: string;
}
type SetupResult = SetupHit | { hit: false };

interface SetupConfig {
  id: string;
  name: string;
  emoji: string;
  outlook: 'bullish' | 'bearish';
  holdPeriod: string;
}

const SETUPS_CONFIG: SetupConfig[] = [
  { id: 'bull-flag',     name: 'Bull Flag',     emoji: '🚩', outlook: 'bullish', holdPeriod: '3–10 days' },
  { id: 'pullback-ma',   name: 'Pullback to MA', emoji: '🎯', outlook: 'bullish', holdPeriod: '5–15 days' },
  { id: 'breakout',      name: 'Breakout',       emoji: '🚀', outlook: 'bullish', holdPeriod: '3–12 days' },
  { id: 'higher-lows',   name: 'Higher Lows',    emoji: '📈', outlook: 'bullish', holdPeriod: '5–20 days' },
  { id: 'double-bottom', name: 'Double Bottom',  emoji: '🔄', outlook: 'bullish', holdPeriod: '5–15 days' },
  { id: 'bear-flag',     name: 'Bear Flag',      emoji: '🔻', outlook: 'bearish', holdPeriod: '3–10 days' },
  { id: 'gap-up',        name: 'Gap Up',         emoji: '⚡', outlook: 'bullish', holdPeriod: '1–5 days'  },
];

// ── Data fetching ────────────────────────────────────────────────────────────

async function fetchCandles(token: string, symbol: string): Promise<Candle[]> {
  try {
    const res = await fetch(
      `https://api.schwabapi.com/marketdata/v1/pricehistory?symbol=${symbol}&periodType=month&period=3&frequencyType=daily&frequency=1`,
      { headers: { Authorization: `Bearer ${token}`, ...SCHWAB_HEADERS } },
    );
    if (!res.ok) return [];
    const data = await res.json();
    return (data.candles ?? []).map((c: any) => ({
      open: c.open, close: c.close, high: c.high, low: c.low, volume: c.volume,
    }));
  } catch { return []; }
}

// ── Technical indicators ─────────────────────────────────────────────────────

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
  let avgGain = 0;
  let avgLoss = 0;
  for (let i = 0; i < period; i++) {
    if (changes[i] > 0) avgGain += changes[i];
    else avgLoss += Math.abs(changes[i]);
  }
  avgGain /= period;
  avgLoss /= period;
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

// ── Setup detectors ──────────────────────────────────────────────────────────

function detectBullFlag(
  candles: Candle[], av10: number, rsiVal: number, sma50: number,
): SetupResult {
  if (candles.length < 15) return { hit: false };

  let bestPole: { start: number; end: number; gain: number; poleAvgVol: number } | null = null;
  for (let pLen = 3; pLen <= 5; pLen++) {
    const pEnd = candles.length - 3;
    const pStart = pEnd - pLen;
    if (pStart < 0) continue;
    const pole = candles.slice(pStart, pEnd);
    const allUp = pole.every((c, i) => i === 0 || c.close > pole[i - 1].close);
    const gain = (pole[pole.length - 1].close - pole[0].open) / pole[0].open;
    const poleAvgVol = pole.reduce((s, c) => s + c.volume, 0) / pole.length;
    if (allUp && gain >= 0.05 && poleAvgVol >= av10 * 1.3) {
      bestPole = { start: pStart, end: pEnd, gain, poleAvgVol };
      break;
    }
  }
  if (!bestPole) return { hit: false };

  const flag = candles.slice(bestPole.end);
  if (flag.length < 2) return { hit: false };

  const flagHigh = Math.max(...flag.map(c => c.high));
  const flagLow  = Math.min(...flag.map(c => c.low));
  const flagRange = (flagHigh - flagLow) / candles[bestPole.end - 1].close;
  const flagAvgVol = flag.reduce((s, c) => s + c.volume, 0) / flag.length;

  if (flagRange > bestPole.gain * 0.5) return { hit: false };
  if (flagAvgVol > bestPole.poleAvgVol * 0.65) return { hit: false };

  const latest = candles[candles.length - 1];
  const status = latest.close > flagHigh && latest.volume > av10 * 1.4 ? 'BREAKOUT' : 'FORMING';
  const poleHeight = bestPole.gain * candles[bestPole.start].open;

  const criteria = [
    `Pole gain: +${(bestPole.gain * 100).toFixed(1)}% over ${bestPole.end - bestPole.start} candles`,
    `Pole volume: ${(bestPole.poleAvgVol / av10).toFixed(1)}× avg`,
    `Flag consolidation: ${(flagRange * 100).toFixed(1)}% range`,
    `Flag volume dried to ${(flagAvgVol / av10).toFixed(2)}× avg`,
  ];
  if (status === 'BREAKOUT') criteria.push('Breaking flag high on volume surge ✓');

  let confidence = (4 / 5) * 65;
  if (rsiVal >= 50 && rsiVal <= 70) confidence += 15; else if (rsiVal >= 45) confidence += 8;
  if (latest.volume > av10 * 1.2) confidence += 10;
  if (latest.close > sma50) confidence += 10;

  return { hit: true, confidence: Math.min(Math.round(confidence), 100), criteria, entry: flagHigh, stop: flagLow, target: flagHigh + poleHeight, status };
}

function detectPullbackMA(
  candles: Candle[], av10: number, rsiVal: number, sma20: number, sma50: number,
): SetupResult {
  if (candles.length < 20) return { hit: false };
  if (sma20 <= sma50) return { hit: false };

  const latest = candles[candles.length - 1];
  const price = latest.close;
  const distToSma20 = (price - sma20) / sma20;

  if (distToSma20 < -0.03 || distToSma20 > 0.03) return { hit: false };
  if (rsiVal < 30 || rsiVal > 52) return { hit: false };

  const last3Vol = candles.slice(-3).reduce((s, c) => s + c.volume, 0) / 3;
  if (last3Vol >= av10) return { hit: false };

  const priorHigh = Math.max(...candles.slice(-20).map(c => c.high));

  const criteria = [
    `SMA20 ($${sma20.toFixed(2)}) > SMA50 ($${sma50.toFixed(2)}) — uptrend intact`,
    `Price within ${(Math.abs(distToSma20) * 100).toFixed(1)}% of SMA20`,
    `RSI ${rsiVal.toFixed(0)} — oversold pullback in uptrend`,
    `Volume drying up: ${(last3Vol / av10).toFixed(2)}× 10d avg`,
  ];

  let confidence = (4 / 4) * 65;
  if (rsiVal >= 35 && rsiVal <= 48) confidence += 15; else if (rsiVal >= 30) confidence += 8;
  if (last3Vol < av10 * 0.7) confidence += 10;
  confidence += 10; // sma20 > sma50 implies price likely > sma50

  return { hit: true, confidence: Math.min(Math.round(confidence), 100), criteria, entry: price, stop: sma50 * 0.98, target: priorHigh, status: 'FORMING' };
}

function detectBreakout(
  candles: Candle[], av10: number, rsiVal: number, sma50: number,
): SetupResult {
  if (candles.length < 20) return { hit: false };

  const lookback = Math.min(15, candles.length - 1);
  const cons = candles.slice(-lookback - 1, -1);
  if (cons.length < 5) return { hit: false };

  const avgRange = cons.reduce((s, c) => s + (c.high - c.low) / c.close, 0) / cons.length;
  if (avgRange > 0.03) return { hit: false };

  const consHigh = Math.max(...cons.map(c => c.high));
  const consLow  = Math.min(...cons.map(c => c.low));
  const latest = candles[candles.length - 1];

  if ((consHigh - latest.close) / consHigh > 0.05) return { hit: false };
  if (latest.volume < av10 * 1.4) return { hit: false };

  const consHeight = consHigh - consLow;
  const status = latest.close > consHigh ? 'BREAKOUT' : 'FORMING';

  const criteria: string[] = [
    `Tight consolidation: ${(avgRange * 100).toFixed(1)}% avg daily range over ${cons.length}d`,
    `Price near consolidation high ($${consHigh.toFixed(2)})`,
    `Volume surge: ${(latest.volume / av10).toFixed(1)}× 10d avg`,
  ];

  let confidence = (3 / 4) * 65;
  if (rsiVal >= 50 && rsiVal <= 65) { confidence += 15; criteria.push(`RSI ${rsiVal.toFixed(0)} — momentum building`); }
  else confidence += 5;
  if (latest.volume > av10 * 2) confidence += 10; else if (latest.volume > av10 * 1.4) confidence += 5;
  if (latest.close > sma50) confidence += 10;

  return { hit: true, confidence: Math.min(Math.round(confidence), 100), criteria, entry: consHigh, stop: consLow, target: consHigh + 2 * consHeight, status };
}

function detectHigherLows(
  candles: Candle[], av10: number, rsiVal: number,
  ema20val: number, ema50val: number, sma50: number,
): SetupResult {
  if (candles.length < 30) return { hit: false };
  if (ema20val <= ema50val) return { hit: false };

  const latest = candles[candles.length - 1];
  const price = latest.close;
  if (price <= ema20val) return { hit: false };
  if (rsiVal < 45 || rsiVal > 65) return { hit: false };

  const recent = candles.slice(-30);
  const swingLows: number[] = [];
  for (let i = 2; i < recent.length - 2; i++) {
    if (
      recent[i].low < recent[i - 1].low && recent[i].low < recent[i + 1].low &&
      recent[i].low < recent[i - 2].low && recent[i].low < recent[i + 2].low
    ) swingLows.push(recent[i].low);
  }
  if (swingLows.length < 2) return { hit: false };

  let higherLows = true;
  for (let i = 1; i < swingLows.length; i++) {
    if (swingLows[i] <= swingLows[i - 1]) { higherLows = false; break; }
  }
  if (!higherLows) return { hit: false };

  const lastSwingLow = swingLows[swingLows.length - 1];
  const priorHigh = Math.max(...recent.map(c => c.high));

  const criteria = [
    `EMA20 ($${ema20val.toFixed(2)}) > EMA50 ($${ema50val.toFixed(2)}) — bullish stack`,
    `Price above EMA20`,
    `RSI ${rsiVal.toFixed(0)} — healthy momentum zone`,
    `${swingLows.length} progressive higher lows identified`,
  ];

  let confidence = (4 / 5) * 65;
  if (rsiVal >= 50 && rsiVal <= 60) confidence += 15; else confidence += 8;
  if (latest.volume > av10 * 0.8) confidence += 5;
  if (price > sma50) confidence += 10;

  return { hit: true, confidence: Math.min(Math.round(confidence), 100), criteria, entry: price, stop: lastSwingLow * 0.99, target: priorHigh, status: 'FORMING' };
}

function detectDoubleBottom(
  candles: Candle[], av10: number, rsiVal: number, sma50: number,
): SetupResult {
  if (candles.length < 20) return { hit: false };

  const recent = candles.slice(-40);
  const lows: { idx: number; price: number }[] = [];
  for (let i = 2; i < recent.length - 2; i++) {
    if (
      recent[i].low < recent[i - 1].low && recent[i].low < recent[i + 1].low &&
      recent[i].low < recent[i - 2].low && recent[i].low < recent[i + 2].low
    ) lows.push({ idx: i, price: recent[i].low });
  }
  if (lows.length < 2) return { hit: false };

  const low1 = lows[lows.length - 2];
  const low2 = lows[lows.length - 1];
  if (low2.idx - low1.idx < 5) return { hit: false };
  if (Math.abs(low2.price - low1.price) / low1.price > 0.03) return { hit: false };

  const neckline = Math.max(...recent.slice(low1.idx, low2.idx + 1).map(c => c.high));
  const patternHeight = neckline - Math.min(low1.price, low2.price);
  const latest = candles[candles.length - 1];
  const status = latest.close > neckline ? 'CONFIRMED' : 'FORMING';

  const criteria = [
    `Two lows at ~$${low1.price.toFixed(2)} and $${low2.price.toFixed(2)}`,
    `Lows within ${(Math.abs(low2.price - low1.price) / low1.price * 100).toFixed(1)}% of each other`,
    `Separated by ${low2.idx - low1.idx} candles`,
    `Neckline resistance: $${neckline.toFixed(2)}`,
  ];
  if (status === 'CONFIRMED') criteria.push('Price confirmed above neckline ✓');

  let confidence = (4 / 5) * 65;
  if (rsiVal >= 40 && rsiVal <= 60) confidence += 10;
  if (latest.volume > av10) confidence += 10;
  if (latest.close > sma50) confidence += 10;

  return { hit: true, confidence: Math.min(Math.round(confidence), 100), criteria, entry: neckline, stop: Math.min(low1.price, low2.price) * 0.98, target: neckline + patternHeight, status };
}

function detectBearFlag(
  candles: Candle[], av10: number, rsiVal: number, sma50: number,
): SetupResult {
  if (candles.length < 15) return { hit: false };

  let bestPole: { start: number; end: number; drop: number; poleAvgVol: number } | null = null;
  for (let pLen = 3; pLen <= 5; pLen++) {
    const pEnd = candles.length - 3;
    const pStart = pEnd - pLen;
    if (pStart < 0) continue;
    const pole = candles.slice(pStart, pEnd);
    const allDown = pole.every((c, i) => i === 0 || c.close < pole[i - 1].close);
    const drop = (pole[0].open - pole[pole.length - 1].close) / pole[0].open;
    const poleAvgVol = pole.reduce((s, c) => s + c.volume, 0) / pole.length;
    if (allDown && drop >= 0.05 && poleAvgVol >= av10 * 1.3) {
      bestPole = { start: pStart, end: pEnd, drop, poleAvgVol };
      break;
    }
  }
  if (!bestPole) return { hit: false };

  const flag = candles.slice(bestPole.end);
  if (flag.length < 2) return { hit: false };

  const flagHigh    = Math.max(...flag.map(c => c.high));
  const flagLow     = Math.min(...flag.map(c => c.low));
  const flagRange   = (flagHigh - flagLow) / candles[bestPole.end - 1].close;
  const flagAvgVol  = flag.reduce((s, c) => s + c.volume, 0) / flag.length;

  if (flagRange > bestPole.drop * 0.5) return { hit: false };
  if (flagAvgVol > bestPole.poleAvgVol * 0.65) return { hit: false };
  if (rsiVal >= 50) return { hit: false };

  const poleHeight = bestPole.drop * candles[bestPole.start].open;
  const latest = candles[candles.length - 1];
  const status = latest.close < flagLow && latest.volume > av10 * 1.4 ? 'BREAKDOWN' : 'FORMING';

  const criteria = [
    `Pole drop: -${(bestPole.drop * 100).toFixed(1)}% over ${bestPole.end - bestPole.start} candles`,
    `Pole volume: ${(bestPole.poleAvgVol / av10).toFixed(1)}× avg`,
    `Flag bounce: ${(flagRange * 100).toFixed(1)}% range — weak`,
    `RSI ${rsiVal.toFixed(0)} — bearish`,
  ];
  if (status === 'BREAKDOWN') criteria.push('Breaking below flag low on volume ✓');

  let confidence = (4 / 5) * 65;
  if (rsiVal < 40) confidence += 15; else if (rsiVal < 50) confidence += 8;
  if (latest.volume > av10 * 1.2) confidence += 10;
  if (latest.close < sma50) confidence += 10;

  return { hit: true, confidence: Math.min(Math.round(confidence), 100), criteria, entry: flagLow, stop: flagHigh, target: flagLow - poleHeight, status };
}

function detectGapUp(
  candles: Candle[], av10: number, rsiVal: number, sma50: number,
): SetupResult {
  if (candles.length < 5) return { hit: false };

  const latest = candles[candles.length - 1];
  const prior  = candles[candles.length - 2];
  const gapPct = (latest.open - prior.close) / prior.close;

  if (gapPct < 0.03) return { hit: false };
  if (latest.volume < av10 * 2) return { hit: false };
  if (latest.low < prior.close) return { hit: false }; // gap filled

  const resistance = Math.max(...candles.slice(-20).map(c => c.high));

  const criteria: string[] = [
    `Gap up: +${(gapPct * 100).toFixed(1)}% from prior close ($${prior.close.toFixed(2)})`,
    `Volume: ${(latest.volume / av10).toFixed(1)}× 10d avg`,
    `Gap holding — price above $${prior.close.toFixed(2)}`,
  ];

  let confidence = (3 / 4) * 65;
  if (rsiVal >= 50 && rsiVal <= 70) { confidence += 15; criteria.push(`RSI ${rsiVal.toFixed(0)} — momentum`); }
  else confidence += 5;
  if (latest.volume > av10 * 3) confidence += 10; else if (latest.volume > av10 * 2) confidence += 5;
  if (latest.close > sma50) confidence += 10;

  return { hit: true, confidence: Math.min(Math.round(confidence), 100), criteria, entry: latest.open, stop: prior.close * 0.99, target: resistance, status: 'FORMING' };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function confidenceLabel(score: number): 'VERY_HIGH' | 'HIGH' | 'MEDIUM' {
  if (score >= 80) return 'VERY_HIGH';
  if (score >= 65) return 'HIGH';
  return 'MEDIUM';
}

function riskReward(entry: number, stop: number, target: number): string {
  const risk   = Math.abs(entry - stop);
  const reward = Math.abs(target - entry);
  if (risk === 0) return 'N/A';
  return `1:${(reward / risk).toFixed(1)}`;
}

// ── Main handler ─────────────────────────────────────────────────────────────

export async function GET() {
  const cached = cache.get('stock-setups-v1');
  if (cached) return NextResponse.json(cached);

  const { token, error } = await getSchwabAccessToken('stock');
  if (!token) return NextResponse.json({ error }, { status: 500 });

  // Fetch all tickers in parallel
  const allCandles = await Promise.all(
    WATCHLIST.map(ticker => fetchCandles(token, ticker).then(candles => ({ ticker, candles }))),
  );

  const results: any[] = [];

  for (const { ticker, candles } of allCandles) {
    if (candles.length < 20) continue;

    const closes  = candles.map(c => c.close);
    const sma20   = sma(closes, 20);
    const sma50   = sma(closes, 50);
    const ema20   = ema(closes, 20);
    const ema50   = ema(closes, 50);
    const rsiVal  = rsi(closes, 14);
    const av10    = avgVol(candles, 10);

    const latest   = candles[candles.length - 1];
    const prior    = candles.length >= 2 ? candles[candles.length - 2] : latest;
    const price    = latest.close;
    const changePct = ((price - prior.close) / prior.close) * 100;

    // Run all detectors
    const detections: { setup: SetupConfig; result: SetupHit }[] = [];

    const tryAdd = (cfg: SetupConfig, result: SetupResult) => {
      if (result.hit) detections.push({ setup: cfg, result });
    };

    tryAdd(SETUPS_CONFIG[0], detectBullFlag(candles, av10, rsiVal, sma50));
    tryAdd(SETUPS_CONFIG[1], detectPullbackMA(candles, av10, rsiVal, sma20, sma50));
    tryAdd(SETUPS_CONFIG[2], detectBreakout(candles, av10, rsiVal, sma50));
    tryAdd(SETUPS_CONFIG[3], detectHigherLows(candles, av10, rsiVal, ema20, ema50, sma50));
    tryAdd(SETUPS_CONFIG[4], detectDoubleBottom(candles, av10, rsiVal, sma50));
    tryAdd(SETUPS_CONFIG[5], detectBearFlag(candles, av10, rsiVal, sma50));
    tryAdd(SETUPS_CONFIG[6], detectGapUp(candles, av10, rsiVal, sma50));

    if (detections.length === 0) continue;

    const best = detections.reduce((a, b) => a.result.confidence >= b.result.confidence ? a : b);
    if (best.result.confidence < 50) continue;

    results.push({
      ticker,
      price,
      changePct,
      sector: SECTOR_MAP[ticker] ?? 'Other',
      setup: {
        id:              best.setup.id,
        name:            best.setup.name,
        emoji:           best.setup.emoji,
        outlook:         best.setup.outlook,
        status:          best.result.status,
        confidence:      best.result.confidence,
        confidenceLabel: confidenceLabel(best.result.confidence),
        criteria:        best.result.criteria,
        entry:           best.result.entry,
        stop:            best.result.stop,
        target:          best.result.target,
        riskReward:      riskReward(best.result.entry, best.result.stop, best.result.target),
        holdPeriod:      best.setup.holdPeriod,
      },
    });
  }

  // Sort by confidence desc, cap at 25
  results.sort((a, b) => b.setup.confidence - a.setup.confidence);
  const top = results.slice(0, 25);

  const payload = { setups: top, generatedAt: new Date().toISOString(), count: top.length };
  cache.set('stock-setups-v1', payload, 5 * 60 * 1000);

  return NextResponse.json(payload);
}
