// strategies/indicators.ts
// Minimal indicator utilities used by strategy engines (server-safe, deterministic).

export type Candle = {
  time: number; // ms epoch
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
};

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

export function sma(values: number[], period: number): (number | null)[] {
  if (period <= 1) return values.map((v) => (Number.isFinite(v) ? v : null));
  const out: (number | null)[] = new Array(values.length).fill(null);
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    sum += v;
    if (i >= period) sum -= values[i - period];
    if (i >= period - 1) out[i] = sum / period;
  }
  return out;
}

export function ema(values: number[], period: number): (number | null)[] {
  if (period <= 1) return values.map((v) => (Number.isFinite(v) ? v : null));
  const out: (number | null)[] = new Array(values.length).fill(null);
  const k = 2 / (period + 1);
  let prev: number | null = null;
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (!Number.isFinite(v)) {
      out[i] = null;
      continue;
    }
    if (prev === null) {
      prev = v;
      out[i] = null;
      continue;
    }
    // Avoid using the identifier name "next" (can confuse certain TS/Next toolchains).
    const emaNext: number = v * k + prev * (1 - k);
    prev = emaNext;
    out[i] = emaNext;
  }
  // For stability: null out the first (period-1) outputs.
  for (let i = 0; i < Math.min(values.length, period - 1); i++) out[i] = null;
  return out;
}

export function stddev(values: number[], period: number, meanArr?: (number | null)[]): (number | null)[] {
  const m = meanArr || sma(values, period);
  const out: (number | null)[] = new Array(values.length).fill(null);
  for (let i = 0; i < values.length; i++) {
    const mu = m[i];
    if (mu === null) continue;
    const start = i - period + 1;
    if (start < 0) continue;
    let s = 0;
    for (let j = start; j <= i; j++) {
      const d = values[j] - (mu as number);
      s += d * d;
    }
    out[i] = Math.sqrt(s / period);
  }
  return out;
}

export function bbands(closes: number[], period = 20, stdevs = 2): { mid: (number | null)[]; upper: (number | null)[]; lower: (number | null)[] } {
  const mid = sma(closes, period);
  const sd = stddev(closes, period, mid);
  const upper = closes.map((_, i) => (mid[i] === null || sd[i] === null ? null : (mid[i] as number) + stdevs * (sd[i] as number)));
  const lower = closes.map((_, i) => (mid[i] === null || sd[i] === null ? null : (mid[i] as number) - stdevs * (sd[i] as number)));
  return { mid, upper, lower };
}

export function computeVwap(candles: Candle[]): (number | null)[] {
  const out: (number | null)[] = new Array(candles.length).fill(null);
  let cumPV = 0;
  let cumV = 0;
  for (let i = 0; i < candles.length; i++) {
    const c = candles[i];
    const v = Number.isFinite(c.volume as any) ? Number(c.volume) : 0;
    const tp = (c.high + c.low + c.close) / 3;
    if (v > 0 && Number.isFinite(tp)) {
      cumPV += tp * v;
      cumV += v;
      out[i] = cumV > 0 ? cumPV / cumV : null;
    } else {
      out[i] = cumV > 0 ? cumPV / cumV : null;
    }
  }
  return out;
}

export function atr(candles: Candle[], period = 14): (number | null)[] {
  const out: (number | null)[] = new Array(candles.length).fill(null);
  let trSum = 0;
  for (let i = 1; i < candles.length; i++) {
    const cur = candles[i];
    const prev = candles[i - 1];
    const tr = Math.max(cur.high - cur.low, Math.abs(cur.high - prev.close), Math.abs(cur.low - prev.close));
    trSum += tr;
    if (i >= period) {
      // subtract TR from i - period
      const dropCur = candles[i - period + 1];
      const dropPrev = candles[i - period];
      const dropTr = Math.max(dropCur.high - dropCur.low, Math.abs(dropCur.high - dropPrev.close), Math.abs(dropCur.low - dropPrev.close));
      trSum -= dropTr;
    }
    if (i >= period) out[i] = trSum / period;
  }
  return out;
}

export function rollingHigh(closes: number[], lookback: number, excludeLast = true): number {
  const end = excludeLast ? closes.length - 1 : closes.length;
  const start = Math.max(0, end - lookback);
  let hi = -Infinity;
  for (let i = start; i < end; i++) hi = Math.max(hi, closes[i]);
  return Number.isFinite(hi) ? hi : closes[closes.length - 1] || 0;
}

export function rollingLow(closes: number[], lookback: number, excludeLast = true): number {
  const end = excludeLast ? closes.length - 1 : closes.length;
  const start = Math.max(0, end - lookback);
  let lo = Infinity;
  for (let i = start; i < end; i++) lo = Math.min(lo, closes[i]);
  return Number.isFinite(lo) ? lo : closes[closes.length - 1] || 0;
}

export function avgVolume(candles: Candle[], lookback: number, excludeLast = true): number {
  const end = excludeLast ? candles.length - 1 : candles.length;
  const start = Math.max(0, end - lookback);
  let sum = 0;
  let n = 0;
  for (let i = start; i < end; i++) {
    const v = Number.isFinite(candles[i].volume as any) ? Number(candles[i].volume) : 0;
    if (v > 0) {
      sum += v;
      n += 1;
    }
  }
  return n > 0 ? sum / n : 0;
}

export function pctDiff(a: number, b: number): number {
  if (!Number.isFinite(a) || !Number.isFinite(b) || b === 0) return 0;
  return ((a - b) / b) * 100;
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function scoreToConfidence(score: number, max: number, floor = 5, ceiling = 95): number {
  const pct = max > 0 ? (score / max) * 100 : 0;
  return clamp(Math.round(pct), floor, ceiling);
}
