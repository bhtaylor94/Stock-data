// lib/technicals.js
// Technical indicator calculations from price history data

// Simple Moving Average
export function sma(prices, period) {
  if (prices.length < period) return null;
  const slice = prices.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / period;
}

// Exponential Moving Average
export function ema(prices, period) {
  if (prices.length < period) return null;
  const k = 2 / (period + 1);
  let emaVal = sma(prices.slice(0, period), period);
  for (let i = period; i < prices.length; i++) {
    emaVal = prices[i] * k + emaVal * (1 - k);
  }
  return emaVal;
}

// RSI (14-period default)
export function rsi(prices, period = 14) {
  if (prices.length < period + 1) return null;
  const changes = [];
  for (let i = 1; i < prices.length; i++) {
    changes.push(prices[i] - prices[i - 1]);
  }

  let avgGain = 0, avgLoss = 0;
  for (let i = 0; i < period; i++) {
    if (changes[i] > 0) avgGain += changes[i];
    else avgLoss += Math.abs(changes[i]);
  }
  avgGain /= period;
  avgLoss /= period;

  for (let i = period; i < changes.length; i++) {
    const change = changes[i];
    avgGain = (avgGain * (period - 1) + (change > 0 ? change : 0)) / period;
    avgLoss = (avgLoss * (period - 1) + (change < 0 ? Math.abs(change) : 0)) / period;
  }

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

// MACD (12, 26, 9)
export function macd(prices) {
  if (prices.length < 26) return null;
  const ema12 = ema(prices, 12);
  const ema26 = ema(prices, 26);
  const macdLine = ema12 - ema26;

  // Calculate signal line from MACD history
  const macdHistory = [];
  for (let i = 26; i <= prices.length; i++) {
    const slice = prices.slice(0, i);
    const e12 = ema(slice, 12);
    const e26 = ema(slice, 26);
    macdHistory.push(e12 - e26);
  }

  const signalLine = macdHistory.length >= 9 ? ema(macdHistory, 9) : null;
  const histogram = signalLine !== null ? macdLine - signalLine : null;

  // Detect crossover
  let signal = 'NEUTRAL';
  if (macdHistory.length >= 2 && signalLine !== null) {
    const prevMacd = macdHistory[macdHistory.length - 2];
    const prevSignal = ema(macdHistory.slice(0, -1), 9);
    if (prevMacd <= prevSignal && macdLine > signalLine) signal = 'BULLISH_CROSS';
    else if (prevMacd >= prevSignal && macdLine < signalLine) signal = 'BEARISH_CROSS';
    else if (macdLine > signalLine) signal = 'BULLISH';
    else signal = 'BEARISH';
  }

  return { macdLine, signalLine, histogram, signal };
}

// Bollinger Bands (20, 2)
export function bollingerBands(prices, period = 20, stdDev = 2) {
  if (prices.length < period) return null;
  const slice = prices.slice(-period);
  const mean = slice.reduce((a, b) => a + b, 0) / period;
  const variance = slice.reduce((sum, p) => sum + Math.pow(p - mean, 2), 0) / period;
  const sd = Math.sqrt(variance);

  const upper = mean + stdDev * sd;
  const lower = mean - stdDev * sd;
  const current = prices[prices.length - 1];

  let position = 'MIDDLE';
  if (current >= upper) position = 'UPPER';
  else if (current <= lower) position = 'LOWER';
  else if (current > mean + sd) position = 'UPPER_MID';
  else if (current < mean - sd) position = 'LOWER_MID';

  // Squeeze detection — bandwidth narrowing
  const bandwidth = (upper - lower) / mean;
  const squeeze = bandwidth < 0.04; // tight bands = squeeze

  return { upper, lower, mean, position, bandwidth, squeeze };
}

// Realized volatility (annualized, from daily closes)
export function realizedVol(prices, days = 20) {
  if (prices.length < days + 1) return null;
  const returns = [];
  const slice = prices.slice(-(days + 1));
  for (let i = 1; i < slice.length; i++) {
    returns.push(Math.log(slice[i] / slice[i - 1]));
  }
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / (returns.length - 1);
  return Math.sqrt(variance) * Math.sqrt(252) * 100; // annualized %
}

// Run all technicals on a price array and return a summary
export function analyzeTechnicals(closePrices) {
  if (!closePrices || closePrices.length < 50) {
    return { score: 0, description: 'Insufficient price data for technical analysis' };
  }

  const currentPrice = closePrices[closePrices.length - 1];
  const rsiVal = rsi(closePrices);
  const macdResult = macd(closePrices);
  const bb = bollingerBands(closePrices);
  const sma50 = sma(closePrices, 50);
  const sma200 = closePrices.length >= 200 ? sma(closePrices, 200) : null;
  const rv20 = realizedVol(closePrices, 20);

  return {
    rsi: rsiVal ? Math.round(rsiVal * 10) / 10 : null,
    macd: macdResult,
    bollingerBands: bb,
    sma50,
    sma200,
    realizedVol20d: rv20 ? Math.round(rv20 * 10) / 10 : null,
    currentPrice,
    trend: sma50 ? (currentPrice > sma50 ? 'ABOVE_50SMA' : 'BELOW_50SMA') : null,
    goldenCross: sma50 && sma200 ? sma50 > sma200 : null,
  };
}

// Score the technical layer (0 or 1) for a given direction
export function scoreTechnicals(technicals, direction) {
  if (!technicals || !technicals.rsi) return { score: 0, description: 'Insufficient data' };

  const { rsi: rsiVal, macd: macdResult, bollingerBands: bb, trend } = technicals;
  let points = 0;
  const reasons = [];

  if (direction === 'BULLISH') {
    if (rsiVal < 70 && rsiVal > 25) { points++; reasons.push(`RSI ${rsiVal} — room to run`); }
    if (macdResult?.signal === 'BULLISH_CROSS' || macdResult?.signal === 'BULLISH') {
      points++; reasons.push(`MACD ${macdResult.signal === 'BULLISH_CROSS' ? 'just crossed bullish' : 'bullish'}`);
    }
    if (trend === 'ABOVE_50SMA') { points++; reasons.push('Above 50-day average'); }
    if (bb?.position !== 'UPPER') { points++; reasons.push('Not overextended on Bollinger Bands'); }
  } else {
    if (rsiVal > 30 && rsiVal < 75) { points++; reasons.push(`RSI ${rsiVal} — room to fall`); }
    if (macdResult?.signal === 'BEARISH_CROSS' || macdResult?.signal === 'BEARISH') {
      points++; reasons.push(`MACD ${macdResult.signal === 'BEARISH_CROSS' ? 'just crossed bearish' : 'bearish'}`);
    }
    if (trend === 'BELOW_50SMA') { points++; reasons.push('Below 50-day average'); }
    if (bb?.position !== 'LOWER') { points++; reasons.push('Not oversold on Bollinger Bands'); }
  }

  const score = points >= 2 ? 1 : 0;
  const description = reasons.length > 0
    ? reasons.join('. ') + '.'
    : 'Technical signals are mixed.';

  return { score, rsi: rsiVal, macdSignal: macdResult?.signal, trend, description };
}
