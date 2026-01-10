// lib/setupRegistry.ts
// Phase 2: Setup Registry (rules-based playbooks)
//
// Design goals:
// 1) Non-contradictory output (one dominant setup; conflicts -> NO_TRADE)
// 2) Evidence-first: each setup emits explicit datapoints and rule checks
// 3) Stable typing so errors are caught at build time

export type MarketRegime = 'TREND' | 'RANGE' | 'HIGH_VOL';
export type SetupDirection = 'BULLISH' | 'BEARISH' | 'NEUTRAL';
export type PatternStatus = 'CONFIRMED' | 'FORMING' | 'CONFLICT' | 'NONE';

export interface PatternSummary {
  dominantName: string | null;
  dominantType: 'BULLISH' | 'BEARISH' | null;
  status: PatternStatus;
  confidence: number; // 0-100
}

export interface StockSetupContext {
  // Price/vol
  price: number;
  atr: number; // absolute ATR
  atrPct: number; // ATR% for regime context

  // Core indicators
  rsi14: number;
  macdHist: number;
  sma20: number;
  sma50: number;
  sma200: number;

  // Bollinger squeeze context
  bbUpper: number;
  bbMiddle: number;
  bbLower: number;
  bbWidthPct: number;

  // Key levels
  support: number;
  resistance: number;

  // Recent swing context (used for break/retest and failure playbooks)
  // Computed from closes using lookback windows excluding the latest close.
  lastClose: number;
  prevClose: number;
  priorHigh20: number;
  priorLow20: number;

  // Scoring / regime
  regime: MarketRegime;
  fundamentalScore: number;
  technicalScore: number;

  // Patterns
  pattern: PatternSummary;
}

export interface SetupResult {
  id: string;
  name: string;
  direction: SetupDirection;
  score: number;          // 0..10
  passed: boolean;
  reasons: string[];
  entry?: string;
  stop?: string;
  targets?: string[];
  invalidation?: string;
  requiredEvidenceKeys: string[];
}

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const round2 = (n: number) => Math.round(n * 100) / 100;

function inRange(v: number, lo: number, hi: number): boolean {
  return v >= lo && v <= hi;
}

// --- Setup evaluators ---
// IMPORTANT: evaluators must be deterministic and only rely on ctx.

function setupTrendContinuationBull(ctx: StockSetupContext): SetupResult {
  const reasons: string[] = [];
  const priceAbove = ctx.price > ctx.sma50 && ctx.sma50 > ctx.sma200;
  if (priceAbove) reasons.push('Trend filter: price > SMA50 > SMA200.');
  if (inRange(ctx.rsi14, 45, 68)) reasons.push('RSI in trend-continuation zone (45-68).');
  if (ctx.macdHist > 0) reasons.push('MACD histogram positive (momentum tailwind).');

  const passed = priceAbove && ctx.macdHist > 0 && ctx.rsi14 >= 40;
  let score = 0;
  if (priceAbove) score += 4;
  score += ctx.macdHist > 0 ? 3 : 0;
  score += inRange(ctx.rsi14, 45, 68) ? 2 : 0;
  score += (ctx.regime === 'TREND') ? 1 : 0;
  score = clamp(score, 0, 10);

  const atrStop = ctx.atr > 0 ? round2(ctx.price - 1.5 * ctx.atr) : round2(ctx.sma50 * 0.99);
  const target1 = round2(ctx.price + 2 * ctx.atr);
  const target2 = round2(ctx.price + 3 * ctx.atr);

  return {
    id: 'trend_continuation_bull',
    name: 'Trend Continuation (Bullish)',
    direction: 'BULLISH',
    score,
    passed,
    reasons: passed ? reasons : reasons.concat(['Did not meet bullish trend continuation gates.']),
    entry: `Above recent highs / continuation trigger. Current: ${round2(ctx.price)}`,
    stop: `ATR-based stop ~ ${atrStop}`,
    targets: ctx.atr > 0 ? [`Target ~ ${target1}`, `Stretch ~ ${target2}`] : [],
    invalidation: 'Loss of trend filter (price back below SMA50) or MACD histogram flips negative.',
    requiredEvidenceKeys: ['indicators.rsi14', 'indicators.macdHist', 'indicators.sma50', 'indicators.sma200', 'levels.support', 'levels.resistance'],
  };
}

function setupTrendContinuationBear(ctx: StockSetupContext): SetupResult {
  const reasons: string[] = [];
  const priceBelow = ctx.price < ctx.sma50 && ctx.sma50 < ctx.sma200;
  if (priceBelow) reasons.push('Trend filter: price < SMA50 < SMA200.');
  if (inRange(ctx.rsi14, 32, 55)) reasons.push('RSI in bearish continuation zone (32-55).');
  if (ctx.macdHist < 0) reasons.push('MACD histogram negative (bearish momentum).');

  const passed = priceBelow && ctx.macdHist < 0 && ctx.rsi14 <= 60;
  let score = 0;
  if (priceBelow) score += 4;
  score += ctx.macdHist < 0 ? 3 : 0;
  score += inRange(ctx.rsi14, 32, 55) ? 2 : 0;
  score += (ctx.regime === 'TREND') ? 1 : 0;
  score = clamp(score, 0, 10);

  const atrStop = ctx.atr > 0 ? round2(ctx.price + 1.5 * ctx.atr) : round2(ctx.sma50 * 1.01);
  const target1 = round2(ctx.price - 2 * ctx.atr);
  const target2 = round2(ctx.price - 3 * ctx.atr);

  return {
    id: 'trend_continuation_bear',
    name: 'Trend Continuation (Bearish)',
    direction: 'BEARISH',
    score,
    passed,
    reasons: passed ? reasons : reasons.concat(['Did not meet bearish trend continuation gates.']),
    entry: `Below recent lows / continuation trigger. Current: ${round2(ctx.price)}`,
    stop: `ATR-based stop ~ ${atrStop}`,
    targets: ctx.atr > 0 ? [`Target ~ ${target1}`, `Stretch ~ ${target2}`] : [],
    invalidation: 'Loss of bearish filter (price back above SMA50) or MACD histogram turns positive.',
    requiredEvidenceKeys: ['indicators.rsi14', 'indicators.macdHist', 'indicators.sma50', 'indicators.sma200', 'levels.support', 'levels.resistance'],
  };
}

function setupBollingerSqueezeBreakout(ctx: StockSetupContext): SetupResult {
  const reasons: string[] = [];
  const squeeze = ctx.bbWidthPct > 0 && ctx.bbWidthPct <= 6; // conservative squeeze
  if (squeeze) reasons.push(`Bollinger bandwidth tight (${round2(ctx.bbWidthPct)}%).`);
  const aboveMid = ctx.price >= ctx.bbMiddle;
  if (aboveMid) reasons.push('Price above BB midline (bias bullish).');

  const passed = squeeze && aboveMid && ctx.rsi14 >= 45 && ctx.macdHist >= 0;
  let score = 0;
  score += squeeze ? 5 : 0;
  score += aboveMid ? 2 : 0;
  score += (ctx.macdHist >= 0) ? 2 : 0;
  score += (ctx.rsi14 >= 45) ? 1 : 0;
  score = clamp(score, 0, 10);

  const atrStop = ctx.atr > 0 ? round2(ctx.bbMiddle - 1.0 * ctx.atr) : round2(ctx.bbMiddle * 0.99);
  const target1 = round2(ctx.bbUpper);
  const target2 = ctx.atr > 0 ? round2(ctx.bbUpper + 1.5 * ctx.atr) : round2(ctx.bbUpper * 1.02);

  return {
    id: 'bb_squeeze_breakout_bull',
    name: 'Bollinger Squeeze → Breakout (Bullish)',
    direction: 'BULLISH',
    score,
    passed,
    reasons: passed ? reasons : reasons.concat(['Did not meet squeeze breakout gates.']),
    entry: `Trigger: break/hold above upper band or recent range high. Current: ${round2(ctx.price)}`,
    stop: `Below BB midline / ATR buffer (~ ${atrStop})`,
    targets: [`Target ~ ${target1}`, `Stretch ~ ${target2}`],
    invalidation: 'Breakout failure back into range + MACD histogram turns negative.',
    requiredEvidenceKeys: ['indicators.bbUpper', 'indicators.bbMiddle', 'indicators.bbLower', 'indicators.rsi14', 'indicators.macdHist'],
  };
}

function setupBollingerSqueezeBreakdown(ctx: StockSetupContext): SetupResult {
  const reasons: string[] = [];
  const squeeze = ctx.bbWidthPct > 0 && ctx.bbWidthPct <= 6;
  if (squeeze) reasons.push(`Bollinger bandwidth tight (${round2(ctx.bbWidthPct)}%).`);
  const belowMid = ctx.price <= ctx.bbMiddle;
  if (belowMid) reasons.push('Price below BB midline (bias bearish).');

  const passed = squeeze && belowMid && ctx.rsi14 <= 55 && ctx.macdHist <= 0;
  let score = 0;
  score += squeeze ? 5 : 0;
  score += belowMid ? 2 : 0;
  score += (ctx.macdHist <= 0) ? 2 : 0;
  score += (ctx.rsi14 <= 55) ? 1 : 0;
  score = clamp(score, 0, 10);

  const atrStop = ctx.atr > 0 ? round2(ctx.bbMiddle + 1.0 * ctx.atr) : round2(ctx.bbMiddle * 1.01);
  const target1 = round2(ctx.bbLower);
  const target2 = ctx.atr > 0 ? round2(ctx.bbLower - 1.5 * ctx.atr) : round2(ctx.bbLower * 0.98);

  return {
    id: 'bb_squeeze_breakdown_bear',
    name: 'Bollinger Squeeze → Breakdown (Bearish)',
    direction: 'BEARISH',
    score,
    passed,
    reasons: passed ? reasons : reasons.concat(['Did not meet squeeze breakdown gates.']),
    entry: `Trigger: break/hold below lower band or recent range low. Current: ${round2(ctx.price)}`,
    stop: `Above BB midline / ATR buffer (~ ${atrStop})`,
    targets: [`Target ~ ${target1}`, `Stretch ~ ${target2}`],
    invalidation: 'Breakdown failure back into range + MACD histogram flips positive.',
    requiredEvidenceKeys: ['indicators.bbUpper', 'indicators.bbMiddle', 'indicators.bbLower', 'indicators.rsi14', 'indicators.macdHist'],
  };
}

function setupPatternConfirmed(ctx: StockSetupContext): SetupResult {
  const reasons: string[] = [];
  const statusOk = ctx.pattern.status === 'CONFIRMED';
  const confOk = ctx.pattern.confidence >= 55;
  if (statusOk) reasons.push('Chart pattern CONFIRMED (breakout/breakdown occurred).');
  if (confOk) reasons.push(`Pattern confidence ${round2(ctx.pattern.confidence)}% (>=55%).`);

  const direction: SetupDirection =
    ctx.pattern.dominantType === 'BULLISH' ? 'BULLISH' :
    ctx.pattern.dominantType === 'BEARISH' ? 'BEARISH' :
    'NEUTRAL';

  const passed = statusOk && confOk && direction !== 'NEUTRAL';
  let score = 0;
  score += statusOk ? 5 : 0;
  score += confOk ? 3 : 0;
  score += (direction !== 'NEUTRAL') ? 2 : 0;
  score = clamp(score, 0, 10);

  const atrStop = ctx.atr > 0 ? (
    direction === 'BULLISH'
      ? round2(ctx.price - 1.2 * ctx.atr)
      : round2(ctx.price + 1.2 * ctx.atr)
  ) : round2(ctx.support);

  return {
    id: 'pattern_confirmed',
    name: `Pattern Confirmed (${direction})`,
    direction,
    score,
    passed,
    reasons: passed ? reasons.concat([`Pattern: ${ctx.pattern.dominantName || 'N/A'}`]) : reasons.concat(['No confirmed high-confidence dominant pattern.']),
    entry: `Pattern trigger confirmed. Current: ${round2(ctx.price)}`,
    stop: `ATR-based invalidation ~ ${atrStop}`,
    targets: ctx.atr > 0 ? [`~ ${round2(ctx.price + (direction === 'BULLISH' ? 2 : -2) * ctx.atr)}`] : [],
    invalidation: 'Failed retest of breakout/breakdown level or pattern invalidation.',
    requiredEvidenceKeys: ['patterns.status', 'patterns.confidence', 'patterns.dominant'],
  };
}

// Trend pullback setup: buy pullbacks within an established trend.
// Uses SMA20/SMA50 proximity + RSI reset while maintaining trend structure.
function setupTrendPullbackBull(ctx: StockSetupContext): SetupResult {
  const reasons: string[] = [];

  const trendOk = ctx.price > ctx.sma50 && ctx.sma50 > ctx.sma200;
  if (trendOk) reasons.push('Trend intact: price > SMA50 > SMA200.');

  const pullbackLevel = Math.max(ctx.sma20, ctx.sma50);
  const nearPullback = ctx.atr > 0
    ? Math.abs(ctx.price - pullbackLevel) <= 1.0 * ctx.atr
    : Math.abs(ctx.price - pullbackLevel) / Math.max(pullbackLevel, 1) <= 0.02;
  if (nearPullback) reasons.push('Price near trend support (SMA20/SMA50 zone).');

  const rsiReset = inRange(ctx.rsi14, 38, 55);
  if (rsiReset) reasons.push('RSI reset (38-55) within uptrend.');

  const momentumOk = ctx.macdHist >= 0;
  if (momentumOk) reasons.push('MACD histogram not negative (momentum holding).');

  const passed = trendOk && nearPullback && rsiReset && momentumOk;

  let score = 0;
  score += trendOk ? 4 : 0;
  score += nearPullback ? 3 : 0;
  score += rsiReset ? 2 : 0;
  score += (ctx.regime === 'TREND') ? 1 : 0;
  score = clamp(score, 0, 10);

  const atrStop = ctx.atr > 0 ? round2(pullbackLevel - 1.2 * ctx.atr) : round2(pullbackLevel * 0.985);
  const target1 = ctx.atr > 0 ? round2(ctx.price + 2 * ctx.atr) : round2(ctx.resistance);

  return {
    id: 'trend_pullback_bull',
    name: 'Trend Pullback (Bullish)',
    direction: 'BULLISH',
    score,
    passed,
    reasons: passed ? reasons : reasons.concat(['Did not meet bullish pullback gates.']),
    entry: `Pullback entry near SMA support. Current: ${round2(ctx.price)}`,
    stop: `Below pullback zone / ATR buffer (~ ${atrStop})`,
    targets: [`Target ~ ${target1}`],
    invalidation: 'Break below SMA50 with negative MACD histogram.',
    requiredEvidenceKeys: ['indicators.rsi14', 'indicators.macdHist', 'indicators.sma20', 'indicators.sma50', 'indicators.sma200'],
  };
}

function setupTrendPullbackBear(ctx: StockSetupContext): SetupResult {
  const reasons: string[] = [];

  const trendOk = ctx.price < ctx.sma50 && ctx.sma50 < ctx.sma200;
  if (trendOk) reasons.push('Downtrend intact: price < SMA50 < SMA200.');

  const pullbackLevel = Math.min(ctx.sma20, ctx.sma50);
  const nearPullback = ctx.atr > 0
    ? Math.abs(ctx.price - pullbackLevel) <= 1.0 * ctx.atr
    : Math.abs(ctx.price - pullbackLevel) / Math.max(pullbackLevel, 1) <= 0.02;
  if (nearPullback) reasons.push('Price near bearish pullback zone (SMA20/SMA50).');

  const rsiReset = inRange(ctx.rsi14, 45, 62);
  if (rsiReset) reasons.push('RSI rebound (45-62) within downtrend.');

  const momentumOk = ctx.macdHist <= 0;
  if (momentumOk) reasons.push('MACD histogram not positive (bearish momentum holding).');

  const passed = trendOk && nearPullback && rsiReset && momentumOk;

  let score = 0;
  score += trendOk ? 4 : 0;
  score += nearPullback ? 3 : 0;
  score += rsiReset ? 2 : 0;
  score += (ctx.regime === 'TREND') ? 1 : 0;
  score = clamp(score, 0, 10);

  const atrStop = ctx.atr > 0 ? round2(pullbackLevel + 1.2 * ctx.atr) : round2(pullbackLevel * 1.015);
  const target1 = ctx.atr > 0 ? round2(ctx.price - 2 * ctx.atr) : round2(ctx.support);

  return {
    id: 'trend_pullback_bear',
    name: 'Trend Pullback (Bearish)',
    direction: 'BEARISH',
    score,
    passed,
    reasons: passed ? reasons : reasons.concat(['Did not meet bearish pullback gates.']),
    entry: `Pullback short entry near SMA resistance. Current: ${round2(ctx.price)}`,
    stop: `Above pullback zone / ATR buffer (~ ${atrStop})`,
    targets: [`Target ~ ${target1}`],
    invalidation: 'Break above SMA50 with positive MACD histogram.',
    requiredEvidenceKeys: ['indicators.rsi14', 'indicators.macdHist', 'indicators.sma20', 'indicators.sma50', 'indicators.sma200'],
  };
}

// Range mean-reversion: take bounces near support / fades near resistance in RANGE regime.
function setupRangeReversionBull(ctx: StockSetupContext): SetupResult {
  const reasons: string[] = [];
  const rangeOk = ctx.regime === 'RANGE';
  if (rangeOk) reasons.push('Regime: RANGE (mean reversion playbook).');

  const nearSupport = ctx.atr > 0
    ? Math.abs(ctx.price - ctx.support) <= 0.8 * ctx.atr
    : Math.abs(ctx.price - ctx.support) / Math.max(ctx.support, 1) <= 0.015;
  if (nearSupport) reasons.push('Price near support zone.');

  const oversold = ctx.rsi14 <= 35;
  if (oversold) reasons.push(`RSI oversold-ish (${round2(ctx.rsi14)}).`);

  const passed = rangeOk && nearSupport && oversold;
  let score = 0;
  score += rangeOk ? 4 : 0;
  score += nearSupport ? 4 : 0;
  score += oversold ? 2 : 0;
  score = clamp(score, 0, 10);

  const stop = ctx.atr > 0 ? round2(ctx.support - 1.0 * ctx.atr) : round2(ctx.support * 0.98);
  const target1 = round2(ctx.bbMiddle);
  const target2 = round2(ctx.resistance);

  return {
    id: 'range_reversion_bull',
    name: 'Range Reversion (Bullish Bounce)',
    direction: 'BULLISH',
    score,
    passed,
    reasons: passed ? reasons : reasons.concat(['Did not meet range reversion bounce gates.']),
    entry: `Bounce trigger off support. Current: ${round2(ctx.price)}`,
    stop: `Below support / ATR buffer (~ ${stop})`,
    targets: [`Mean reversion ~ ${target1}`, `Range high ~ ${target2}`],
    invalidation: 'Clean break below support (range failure).',
    requiredEvidenceKeys: ['regime', 'indicators.rsi14', 'levels.support', 'levels.resistance', 'indicators.bbMiddle'],
  };
}

function setupRangeReversionBear(ctx: StockSetupContext): SetupResult {
  const reasons: string[] = [];
  const rangeOk = ctx.regime === 'RANGE';
  if (rangeOk) reasons.push('Regime: RANGE (mean reversion playbook).');

  const nearRes = ctx.atr > 0
    ? Math.abs(ctx.price - ctx.resistance) <= 0.8 * ctx.atr
    : Math.abs(ctx.price - ctx.resistance) / Math.max(ctx.resistance, 1) <= 0.015;
  if (nearRes) reasons.push('Price near resistance zone.');

  const overbought = ctx.rsi14 >= 65;
  if (overbought) reasons.push(`RSI overbought-ish (${round2(ctx.rsi14)}).`);

  const passed = rangeOk && nearRes && overbought;
  let score = 0;
  score += rangeOk ? 4 : 0;
  score += nearRes ? 4 : 0;
  score += overbought ? 2 : 0;
  score = clamp(score, 0, 10);

  const stop = ctx.atr > 0 ? round2(ctx.resistance + 1.0 * ctx.atr) : round2(ctx.resistance * 1.02);
  const target1 = round2(ctx.bbMiddle);
  const target2 = round2(ctx.support);

  return {
    id: 'range_reversion_bear',
    name: 'Range Reversion (Bearish Fade)',
    direction: 'BEARISH',
    score,
    passed,
    reasons: passed ? reasons : reasons.concat(['Did not meet range reversion fade gates.']),
    entry: `Fade trigger off resistance. Current: ${round2(ctx.price)}`,
    stop: `Above resistance / ATR buffer (~ ${stop})`,
    targets: [`Mean reversion ~ ${target1}`, `Range low ~ ${target2}`],
    invalidation: 'Clean break above resistance (range breakout).',
    requiredEvidenceKeys: ['regime', 'indicators.rsi14', 'levels.support', 'levels.resistance', 'indicators.bbMiddle'],
  };
}

// Break & Retest (bullish): breakout above prior swing high then a controlled retest/hold of that level.
function setupBreakRetestBull(ctx: StockSetupContext): SetupResult {
  const reasons: string[] = [];
  const level = ctx.priorHigh20;

  // Guard against missing history
  const levelOk = level > 0;
  if (levelOk) reasons.push(`Prior 20-bar swing high ~ ${round2(level)}.`);

  const tol = ctx.atr > 0 ? 0.6 * ctx.atr : Math.max(level * 0.006, 0.25);
  const breakoutRecently = ctx.prevClose >= level * 1.002 || ctx.lastClose >= level * 1.002;
  if (breakoutRecently) reasons.push('Breakout detected above prior swing high (>= +0.2%).');

  const retestNear = Math.abs(ctx.lastClose - level) <= tol;
  if (retestNear) reasons.push(`Retest proximity within tolerance (~${round2(tol)}).`);

  const hold = ctx.lastClose >= level * 0.999;
  if (hold) reasons.push('Retest hold: last close is at/above breakout level.');

  const momentumOk = ctx.macdHist >= 0 && ctx.rsi14 >= 45;
  if (momentumOk) reasons.push('Momentum filter: MACD hist >= 0 and RSI >= 45.');

  const trendOk = ctx.price >= ctx.sma50;
  if (trendOk) reasons.push('Trend support: price at/above SMA50.');

  const passed = levelOk && breakoutRecently && retestNear && hold && momentumOk;
  let score = 0;
  score += (levelOk && breakoutRecently) ? 4 : 0;
  score += retestNear ? 3 : 0;
  score += hold ? 1 : 0;
  score += momentumOk ? 1 : 0;
  score += trendOk ? 1 : 0;
  score = clamp(score, 0, 10);

  const stop = ctx.atr > 0 ? round2(level - 1.0 * ctx.atr) : round2(level * 0.985);
  const target1 = ctx.atr > 0 ? round2(level + 2.0 * ctx.atr) : round2(ctx.resistance);

  return {
    id: 'break_retest_bull',
    name: 'Break & Retest (Bullish)',
    direction: 'BULLISH',
    score,
    passed,
    reasons: passed ? reasons : reasons.concat(['Did not meet break & retest bullish gates.']),
    entry: `Retest/hold above ${round2(level)} then reclaim highs. Last close: ${round2(ctx.lastClose)}`,
    stop: `Below breakout level / ATR buffer (~ ${stop})`,
    targets: [`Measured move ~ ${target1}`],
    invalidation: 'Clean close back below breakout level with weakening momentum (MACD hist < 0).',
    requiredEvidenceKeys: ['levels.priorHigh20', 'indicators.macdHist', 'indicators.rsi14', 'indicators.sma50'],
  };
}

// Break & Retest (bearish): breakdown below prior swing low then retest/reject.
function setupBreakRetestBear(ctx: StockSetupContext): SetupResult {
  const reasons: string[] = [];
  const level = ctx.priorLow20;

  const levelOk = level > 0;
  if (levelOk) reasons.push(`Prior 20-bar swing low ~ ${round2(level)}.`);

  const tol = ctx.atr > 0 ? 0.6 * ctx.atr : Math.max(level * 0.006, 0.25);
  const breakdownRecently = ctx.prevClose <= level * 0.998 || ctx.lastClose <= level * 0.998;
  if (breakdownRecently) reasons.push('Breakdown detected below prior swing low (<= -0.2%).');

  const retestNear = Math.abs(ctx.lastClose - level) <= tol;
  if (retestNear) reasons.push(`Retest proximity within tolerance (~${round2(tol)}).`);

  const reject = ctx.lastClose <= level * 1.001;
  if (reject) reasons.push('Retest reject: last close is at/below breakdown level.');

  const momentumOk = ctx.macdHist <= 0 && ctx.rsi14 <= 55;
  if (momentumOk) reasons.push('Momentum filter: MACD hist <= 0 and RSI <= 55.');

  const trendOk = ctx.price <= ctx.sma50;
  if (trendOk) reasons.push('Trend resistance: price at/below SMA50.');

  const passed = levelOk && breakdownRecently && retestNear && reject && momentumOk;
  let score = 0;
  score += (levelOk && breakdownRecently) ? 4 : 0;
  score += retestNear ? 3 : 0;
  score += reject ? 1 : 0;
  score += momentumOk ? 1 : 0;
  score += trendOk ? 1 : 0;
  score = clamp(score, 0, 10);

  const stop = ctx.atr > 0 ? round2(level + 1.0 * ctx.atr) : round2(level * 1.015);
  const target1 = ctx.atr > 0 ? round2(level - 2.0 * ctx.atr) : round2(ctx.support);

  return {
    id: 'break_retest_bear',
    name: 'Break & Retest (Bearish)',
    direction: 'BEARISH',
    score,
    passed,
    reasons: passed ? reasons : reasons.concat(['Did not meet break & retest bearish gates.']),
    entry: `Retest/reject below ${round2(level)} then continue lower. Last close: ${round2(ctx.lastClose)}`,
    stop: `Above breakdown level / ATR buffer (~ ${stop})`,
    targets: [`Measured move ~ ${target1}`],
    invalidation: 'Clean close back above breakdown level with improving momentum (MACD hist > 0).',
    requiredEvidenceKeys: ['levels.priorLow20', 'indicators.macdHist', 'indicators.rsi14', 'indicators.sma50'],
  };
}

// Failure playbook: Failed breakout (bull trap) often resolves bearish.
function setupFailedBreakoutBear(ctx: StockSetupContext): SetupResult {
  const reasons: string[] = [];
  const level = ctx.priorHigh20;
  const levelOk = level > 0;
  const failed = levelOk && (ctx.prevClose >= level * 1.002) && (ctx.lastClose <= level * 0.998);

  if (levelOk) reasons.push(`Prior swing high ~ ${round2(level)}.`);
  if (failed) reasons.push('Failed breakout: prior close above level, last close back below (bull trap).');

  const momentumOk = ctx.macdHist <= 0 && ctx.rsi14 <= 60;
  if (momentumOk) reasons.push('Momentum confirming: MACD hist <= 0 and RSI <= 60.');

  const passed = failed && momentumOk;
  let score = 0;
  score += failed ? 7 : 0;
  score += momentumOk ? 2 : 0;
  score += (ctx.price <= ctx.sma50) ? 1 : 0;
  score = clamp(score, 0, 10);

  const stop = ctx.atr > 0 ? round2(level + 0.8 * ctx.atr) : round2(level * 1.01);
  const target1 = ctx.atr > 0 ? round2(ctx.lastClose - 2.0 * ctx.atr) : round2(ctx.support);

  return {
    id: 'failed_breakout_bear',
    name: 'Failed Breakout (Bearish)',
    direction: 'BEARISH',
    score,
    passed,
    reasons: passed ? reasons : reasons.concat(['Did not meet failed breakout (bearish) gates.']),
    entry: `After bull trap, look for continuation lower. Last close: ${round2(ctx.lastClose)}`,
    stop: `Above failed breakout level / ATR buffer (~ ${stop})`,
    targets: [`Target ~ ${target1}`],
    invalidation: 'Reclaim and hold back above prior high with positive MACD histogram.',
    requiredEvidenceKeys: ['levels.priorHigh20', 'indicators.macdHist', 'indicators.rsi14'],
  };
}

// Failure playbook: Failed breakdown (bear trap) often resolves bullish.
function setupFailedBreakdownBull(ctx: StockSetupContext): SetupResult {
  const reasons: string[] = [];
  const level = ctx.priorLow20;
  const levelOk = level > 0;
  const failed = levelOk && (ctx.prevClose <= level * 0.998) && (ctx.lastClose >= level * 1.002);

  if (levelOk) reasons.push(`Prior swing low ~ ${round2(level)}.`);
  if (failed) reasons.push('Failed breakdown: prior close below level, last close back above (bear trap).');

  const momentumOk = ctx.macdHist >= 0 && ctx.rsi14 >= 40;
  if (momentumOk) reasons.push('Momentum confirming: MACD hist >= 0 and RSI >= 40.');

  const passed = failed && momentumOk;
  let score = 0;
  score += failed ? 7 : 0;
  score += momentumOk ? 2 : 0;
  score += (ctx.price >= ctx.sma50) ? 1 : 0;
  score = clamp(score, 0, 10);

  const stop = ctx.atr > 0 ? round2(level - 0.8 * ctx.atr) : round2(level * 0.99);
  const target1 = ctx.atr > 0 ? round2(ctx.lastClose + 2.0 * ctx.atr) : round2(ctx.resistance);

  return {
    id: 'failed_breakdown_bull',
    name: 'Failed Breakdown (Bullish)',
    direction: 'BULLISH',
    score,
    passed,
    reasons: passed ? reasons : reasons.concat(['Did not meet failed breakdown (bullish) gates.']),
    entry: `After bear trap, look for continuation higher. Last close: ${round2(ctx.lastClose)}`,
    stop: `Below failed breakdown level / ATR buffer (~ ${stop})`,
    targets: [`Target ~ ${target1}`],
    invalidation: 'Lose the reclaimed level with negative MACD histogram.',
    requiredEvidenceKeys: ['levels.priorLow20', 'indicators.macdHist', 'indicators.rsi14'],
  };
}

export function evaluateStockSetups(ctx: StockSetupContext): {
  best: SetupResult | null;
  passed: SetupResult[];
  conflicts: boolean;
  conflictReason: string | null;
} {
  const setups: SetupResult[] = [
    setupTrendContinuationBull(ctx),
    setupTrendContinuationBear(ctx),
    setupTrendPullbackBull(ctx),
    setupTrendPullbackBear(ctx),
    setupRangeReversionBull(ctx),
    setupRangeReversionBear(ctx),
    setupBreakRetestBull(ctx),
    setupBreakRetestBear(ctx),
    setupFailedBreakoutBear(ctx),
    setupFailedBreakdownBull(ctx),
    setupBollingerSqueezeBreakout(ctx),
    setupBollingerSqueezeBreakdown(ctx),
    setupPatternConfirmed(ctx),
  ];

  const passed = setups.filter(s => s.passed).sort((a, b) => b.score - a.score);
  if (passed.length === 0) {
    return { best: null, passed: [], conflicts: false, conflictReason: null };
  }

  // Detect directional conflicts: at least one bullish AND one bearish passing with strong scores.
  const bullish = passed.filter(s => s.direction === 'BULLISH');
  const bearish = passed.filter(s => s.direction === 'BEARISH');

  const bullishTop = bullish[0];
  const bearishTop = bearish[0];

  const conflicts =
    !!bullishTop && !!bearishTop &&
    bullishTop.score >= 6 && bearishTop.score >= 6;

  if (conflicts) {
    return {
      best: null,
      passed,
      conflicts: true,
      conflictReason: `Setup conflict: ${bullishTop.name} vs ${bearishTop.name}.`,
    };
  }

  // Prefer non-neutral, higher score; tie-break by TREND regime alignment for trend setups.
  const best = passed[0];
  return { best, passed, conflicts: false, conflictReason: null };
}

// --- Options setup registry (structure selection, not contract picking) ---

export type OptionsStructure =
  | 'LONG_CALL'
  | 'LONG_PUT'
  | 'CALL_DEBIT_SPREAD'
  | 'PUT_DEBIT_SPREAD'
  | 'CSP'
  | 'COVERED_CALL'
  | 'CREDIT_SPREAD'
  | 'IRON_CONDOR'
  | 'NO_TRADE';

export interface OptionsSetupContext {
  trend: SetupDirection; // derived from best stock setup direction
  ivPercentile: number;  // 0..100 (best effort)
  daysToEarnings?: number | null;
  liquidityOk: boolean;
}

export interface OptionsSetupResult {
  structure: OptionsStructure;
  score: number;
  passed: boolean;
  reasons: string[];
}

export function evaluateOptionsSetup(ctx: OptionsSetupContext): OptionsSetupResult {
  const reasons: string[] = [];

  if (!ctx.liquidityOk) {
    return {
      structure: 'NO_TRADE',
      score: 0,
      passed: false,
      reasons: ['Options liquidity gate failed (spread/OI/volume).'],
    };
  }

  const nearEarnings = typeof ctx.daysToEarnings === 'number' && ctx.daysToEarnings >= 0 && ctx.daysToEarnings <= 10;
  if (nearEarnings) reasons.push(`Earnings within ${ctx.daysToEarnings} days (IV crush risk).`);

  // Conservative structure selection:
  // - High IV percentile -> prefer risk-defined spreads (avoid paying rich IV)
  // - Low IV percentile -> long premium more acceptable
  const ivHigh = ctx.ivPercentile >= 70;
  const ivLow = ctx.ivPercentile <= 35;

  if (ctx.trend === 'BULLISH') {
    if (ivHigh || nearEarnings) {
      reasons.push('Bullish bias + elevated IV → prefer debit spread (risk-defined).');
      return { structure: 'CALL_DEBIT_SPREAD', score: 8, passed: true, reasons };
    }
    reasons.push('Bullish bias + normal IV → long call acceptable.');
    return { structure: 'LONG_CALL', score: 7, passed: true, reasons };
  }

  if (ctx.trend === 'BEARISH') {
    if (ivHigh || nearEarnings) {
      reasons.push('Bearish bias + elevated IV → prefer debit spread (risk-defined).');
      return { structure: 'PUT_DEBIT_SPREAD', score: 8, passed: true, reasons };
    }
    reasons.push('Bearish bias + normal IV → long put acceptable.');
    return { structure: 'LONG_PUT', score: 7, passed: true, reasons };
  }

  // Neutral
  if (ivHigh && !nearEarnings) {
    reasons.push('Neutral bias + high IV → consider iron condor (risk-defined).');
    return { structure: 'IRON_CONDOR', score: 6, passed: true, reasons };
  }

  reasons.push('Neutral / insufficient edge → NO_TRADE.');
  return { structure: 'NO_TRADE', score: 0, passed: false, reasons };
}
