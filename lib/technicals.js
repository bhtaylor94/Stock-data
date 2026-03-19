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


// ============================================================
// TREND DETECTION
// ============================================================

function detectTrendContext(closePrices) {
  if (!closePrices || closePrices.length < 200) return null;

  const ema50 = ema(closePrices, 50);
  const ema200Val = ema(closePrices, 200);
  if (!ema50 || !ema200Val) return null;

  const currentPrice = closePrices[closePrices.length - 1];
  const emaSpread = ((ema50 - ema200Val) / ema200Val) * 100;

  // Price slope over 20 and 50 days
  const price20ago = closePrices.length >= 21 ? closePrices[closePrices.length - 21] : currentPrice;
  const priceSlope20d = ((currentPrice - price20ago) / price20ago) * 100;
  const price50ago = closePrices.length >= 51 ? closePrices[closePrices.length - 51] : currentPrice;
  const priceSlope50d = ((currentPrice - price50ago) / price50ago) * 100;

  // Higher high / lower low pattern (last 40 days)
  const recent = closePrices.slice(-40);
  const firstHalf = recent.slice(0, 20);
  const secondHalf = recent.slice(20);
  const makingLowerHighs = Math.max(...secondHalf) < Math.max(...firstHalf);
  const makingLowerLows = Math.min(...secondHalf) < Math.min(...firstHalf);

  let trend, trendLabel, trendColor;

  if (emaSpread > 2 && currentPrice > ema50) {
    trend = 'UPTREND';
    trendLabel = 'Uptrend — 50 EMA above 200 EMA, price above 50 EMA';
    trendColor = '#22c55e';
  } else if (emaSpread > 2 && currentPrice <= ema50) {
    trend = 'PULLBACK';
    trendLabel = 'Pullback in uptrend — price below 50 EMA but trend structure intact';
    trendColor = '#eab308';
  } else if (emaSpread > -2 && emaSpread <= 2) {
    trend = 'TRANSITION';
    trendLabel = 'Trend transition — 50 and 200 EMA converging, direction unclear';
    trendColor = '#f97316';
  } else {
    trend = 'DOWNTREND';
    trendLabel = 'Downtrend — 50 EMA below 200 EMA (death cross zone)';
    trendColor = '#ef4444';
  }

  // Override: consistent lower highs/lows + big drop = downtrend even if EMAs haven't crossed
  if (trend !== 'DOWNTREND' && makingLowerHighs && makingLowerLows && priceSlope50d < -10) {
    trend = 'DOWNTREND';
    trendLabel = `Downtrend — lower highs and lower lows, down ${Math.abs(Math.round(priceSlope50d))}% over 50 days`;
    trendColor = '#ef4444';
  }

  return {
    trend, trendLabel, trendColor,
    ema50: Math.round(ema50 * 100) / 100,
    ema200: Math.round(ema200Val * 100) / 100,
    emaSpread: Math.round(emaSpread * 10) / 10,
    priceSlope20d: Math.round(priceSlope20d * 10) / 10,
    priceSlope50d: Math.round(priceSlope50d * 10) / 10,
    makingLowerHighs, makingLowerLows,
  };
}

// ============================================================
// 200 EMA PROXIMITY FLAG & BOUNCE CONFIRMATION SYSTEM
// ============================================================
//
// States:
// ABOVE_EMA      — price >3% above 200 EMA (no flag)
// APPROACHING    — price within 3% above (yellow)
// AT_SUPPORT     — price within 1% of EMA (orange — wait)
// BELOW_EMA      — price >1% below (red — avoid)
// CONFIRMED      — bounced in UPTREND/PULLBACK (green — entry)
// CAUTION_BOUNCE — bounced in DOWNTREND/TRANSITION (yellow — reduced size)
// FAILED         — broke below after testing (red)

export function calculateEma200Proximity(closePrices, volumes, livePrice) {
  if (!closePrices || closePrices.length < 200) return null;

  const ema200Val = ema(closePrices, 200);
  if (!ema200Val) return null;

  const trendContext = detectTrendContext(closePrices);
  const currentPrice = livePrice || closePrices[closePrices.length - 1];
  const ema200Rounded = Math.round(ema200Val * 100) / 100;
  const distance = ((currentPrice - ema200Val) / ema200Val) * 100;
  const distanceRounded = Math.round(distance * 10) / 10;

  const isDowntrend = trendContext?.trend === 'DOWNTREND';
  const isTransition = trendContext?.trend === 'TRANSITION';

  let state, message, color, action;

  if (currentPrice > ema200Val * 1.03) {
    state = 'ABOVE_EMA';
    message = `Price is ${distanceRounded}% above 200 EMA ($${ema200Rounded}). No support concerns.`;
    color = null;
    action = null;
  } else if (currentPrice > ema200Val * 1.01) {
    state = 'APPROACHING';
    message = `Price approaching 200 EMA support at $${ema200Rounded} (${distanceRounded}% above).`;
    if (isDowntrend) message += ' ⚠ Stock is in a downtrend — 200 EMA may not hold.';
    else message += ' Wait for a test and bounce.';
    color = '#eab308';
    action = 'CAUTION';
  } else if (currentPrice >= ema200Val * 0.99) {
    state = 'AT_SUPPORT';
    message = `Price testing 200 EMA at $${ema200Rounded}. Wait for 2 daily closes above.`;
    if (isDowntrend) message += ' ⚠ Downtrend — higher chance of support breaking.';
    color = '#f97316';
    action = 'WAIT';
  } else {
    state = 'BELOW_EMA';
    message = `Price broke below 200 EMA ($${ema200Rounded}). AVOID. Wait for reclaim and 2 days above.`;
    color = '#ef4444';
    action = 'AVOID';
  }

  // Bounce confirmation
  let bounceStatus = null;
  if (state === 'AT_SUPPORT' || state === 'APPROACHING') {
    const recentCloses = closePrices.slice(-3);
    const daysAboveEma = recentCloses.filter(c => c > ema200Val).length;

    if (daysAboveEma >= 2 && recentCloses[recentCloses.length - 1] > ema200Val && recentCloses[recentCloses.length - 2] > ema200Val) {
      let highVolumeConfirm = false;
      if (volumes && volumes.length >= 21) {
        const avgVol = volumes.slice(-21, -1).reduce((a, b) => a + b, 0) / 20;
        highVolumeConfirm = volumes[volumes.length - 1] > avgVol * 1.2;
      }
      const lastTwo = recentCloses.slice(-2).map(c => `$${c.toFixed(2)}`).join(', ');

      if (isDowntrend || isTransition) {
        state = 'CAUTION_BOUNCE';
        message = `Bounce detected at 200 EMA ($${ema200Rounded}) — closes: ${lastTwo}. `;
        message += isDowntrend
          ? `However, the stock is in a DOWNTREND (50 EMA below 200 EMA, ${trendContext.trendLabel}). In downtrends, 200 EMA bounces frequently fail — this could be a dead cat bounce. Reduce position size by 50% or wait for 50 EMA to cross back above 200 EMA.`
          : `Trend is uncertain — 50 and 200 EMA are converging. Use smaller size and tighter stops.`;
        if (highVolumeConfirm) message += ' Volume did confirm the bounce.';
        color = '#eab308';
        action = 'REDUCED_ENTRY';
        bounceStatus = { confirmed: true, highVolume: highVolumeConfirm, closes: recentCloses.slice(-2), downtrendCaution: true };
      } else {
        state = 'CONFIRMED';
        message = `Bounce confirmed. Held above 200 EMA ($${ema200Rounded}) for 2 days. Closes: ${lastTwo}.`;
        if (highVolumeConfirm) message += ' Volume confirms.';
        message += ' Trend healthy — 50 EMA above 200 EMA. Institutional buy-the-dip zone.';
        color = '#22c55e';
        action = 'ENTRY_CONFIRMED';
        bounceStatus = { confirmed: true, highVolume: highVolumeConfirm, closes: recentCloses.slice(-2), downtrendCaution: false };
      }
    } else if (recentCloses[recentCloses.length - 1] < ema200Val * 0.99) {
      state = 'FAILED';
      message = `Bounce failed. Broke below 200 EMA ($${ema200Rounded}). Avoid.`;
      color = '#ef4444';
      action = 'AVOID';
      bounceStatus = { confirmed: false, failed: true };
    } else if (daysAboveEma === 1) {
      bounceStatus = { confirmed: false, pending: true, daysConfirmed: 1 };
      message += ` Day 1 above EMA. Waiting for Day 2 close above $${ema200Rounded}.`;
    }
  }

  // Grade modifier — trend-aware
  let gradeModifier = 0;
  if (state === 'CONFIRMED') gradeModifier = 1;
  else if (state === 'CAUTION_BOUNCE') gradeModifier = 0; // NO upgrade in downtrend
  else if (state === 'APPROACHING') gradeModifier = 0;
  else if (state === 'AT_SUPPORT') gradeModifier = -0.5;
  else if (state === 'BELOW_EMA' || state === 'FAILED') gradeModifier = -1;

  return {
    ema200: ema200Rounded, currentPrice, distance: distanceRounded,
    state, message, color, action, gradeModifier, bounceStatus, trendContext,
  };
}

// Apply grade modifier from EMA proximity
export function adjustGrade(grade, modifier) {
  const grades = ['A', 'B', 'C', 'D', 'F'];
  const idx = grades.indexOf(grade);
  if (idx === -1) return grade;
  const newIdx = Math.max(0, Math.min(grades.length - 1, idx - modifier));
  return grades[Math.round(newIdx)];
}

