// lib/unusualActivityDetector.ts
// Professional-grade UOA detection engine
// Scoring model based on Unusual Whales / Cheddar Flow / BlackBox Stocks research

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export type AlertType =
  | 'GOLDEN_SWEEP'   // Premium >= $1M, ask-side, DTE 8-45
  | 'SWEEP'          // Premium >= $100K, ask-side execution proxy
  | 'BLOCK'          // Large single print near midpoint
  | 'UNUSUAL_VOLUME' // Vol/OI >= 2.0, no aggression signal
  | 'REPEATED_HIT';  // Same contract flagged 2+ consecutive sessions

export type UOATier = 'EXTREME' | 'VERY_HIGH' | 'HIGH' | 'MEDIUM' | 'LOW';

export type AggressionProxy = 'AA' | 'A' | 'M' | 'B' | 'BB';

export interface UOAScoreBreakdown {
  premium: number;     // 0-30
  volOI: number;       // 0-20
  aggression: number;  // 0-20
  dte: number;         // 0-15
  moneyness: number;   // 0-10
  catalyst: number;    // 0-5  (earnings proximity)
  repeat: number;      // 0-5  (multi-day accumulation)
  hedgeDiscount: number; // 0 or -20
}

export interface UnusualActivity {
  symbol: string;
  optionSymbol: string;
  type: 'CALL' | 'PUT';
  strike: number;
  expiration: string;
  dte: number;
  delta: number;

  // Scoring
  uoaScore: number;          // 0-100 composite
  tier: UOATier;
  alertType: AlertType;
  scoreBreakdown: UOAScoreBreakdown;
  aggressionProxy: AggressionProxy;

  // Legacy compat fields (used by existing components)
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME';
  activityType: 'SWEEP' | 'BLOCK' | 'UNUSUAL_VOLUME' | 'GAMMA_SQUEEZE' | 'WHALE_TRADE';
  confidence: number; // alias for uoaScore

  // Metrics
  metrics: {
    volume: number;
    openInterest: number;
    volumeOIRatio: number;
    avgVolume: number;
    volumeVsAvg: number;
    premium: number;
    impliedMove: number;
  };

  // Classification
  sentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  tradeType: 'DIRECTIONAL' | 'LIKELY_HEDGE' | 'UNCERTAIN';
  tradeTypeReason: string;
  hedgeDiscountApplied: boolean;

  // Insider signals (kept for existing UnusualActivitySection)
  insiderProbability: 'HIGH' | 'MEDIUM' | 'LOW' | 'UNLIKELY';
  insiderSignals: string[];

  // Repeat flow
  isRepeatFlow: boolean;
  consecutiveDays: number;

  reasoning: string[];
  signals: string[];  // alias for reasoning (legacy compat)
  timestamp: number;

  // For compatibility with options route consumer
  convictionLevel: 'HIGH' | 'MEDIUM' | 'LOW';
  interpretation: string;
}

export interface ActivityFilters {
  minVolume?: number;
  minPremium?: number;
  minVolumeOIRatio?: number;
  minUOAScore?: number;
  minSeverity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME';
  types?: Array<'CALL' | 'PUT'>;
  sentiments?: Array<'BULLISH' | 'BEARISH' | 'NEUTRAL'>;
  excludeHedges?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// SCORING HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function scorePremium(premium: number): number {
  if (premium < 20_000) return 0;
  if (premium < 100_000) return 5;
  if (premium < 250_000) return 10;
  if (premium < 500_000) return 18;
  if (premium < 1_000_000) return 24;
  return 30; // $1M+ golden tier
}

function scoreVolOI(ratio: number, volExceedsOI: boolean): number {
  let s = 0;
  if (ratio >= 5) s = 20;
  else if (ratio >= 2) s = 15;
  else if (ratio >= 1) s = 10;
  else if (ratio >= 0.5) s = 5;
  if (volExceedsOI) s = Math.min(20, s + 5);
  return s;
}

function scoreAggression(proxy: AggressionProxy): number {
  switch (proxy) {
    case 'AA': return 20;
    case 'A':  return 10;
    case 'M':  return 0;
    case 'B':  return -5;
    case 'BB': return -10;
  }
}

function scoreDTE(dte: number, hasKnownCatalyst: boolean): number {
  if (dte === 0) return hasKnownCatalyst ? 15 : 8;
  if (dte <= 7)  return hasKnownCatalyst ? 15 : 13;
  if (dte <= 21) return 15;
  if (dte <= 45) return 12;
  if (dte <= 90) return 8;
  if (dte <= 180) return 3;
  return 0;
}

function scoreMoneyness(absDelta: number): number {
  if (absDelta >= 0.30 && absDelta <= 0.50) return 10; // peak conviction zone
  if (absDelta >= 0.25 && absDelta <= 0.55) return 8;
  if (absDelta >= 0.55 && absDelta <= 0.65) return 6;
  if (absDelta >= 0.65 && absDelta <= 0.85) return 4;
  if (absDelta > 0.85) return 2;
  if (absDelta >= 0.15) return 5; // OTM — speculative but valid
  if (absDelta >= 0.05) return 1;
  return 0;
}

function deriveAggressionProxy(last: number, bid: number, ask: number): AggressionProxy {
  if (bid <= 0 || ask <= 0) return 'M';
  const mid = (bid + ask) / 2;
  if (last >= ask * 1.01) return 'AA';
  if (last >= ask * 0.97) return 'A';
  if (last <= bid * 0.99) return 'BB';
  if (last <= bid * 1.03) return 'B';
  return 'M';
}

function scoreTier(score: number): UOATier {
  if (score >= 80) return 'EXTREME';
  if (score >= 65) return 'VERY_HIGH';
  if (score >= 50) return 'HIGH';
  if (score >= 30) return 'MEDIUM';
  return 'LOW';
}

function tierToSeverity(tier: UOATier): 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME' {
  switch (tier) {
    case 'EXTREME':   return 'EXTREME';
    case 'VERY_HIGH': return 'HIGH';
    case 'HIGH':      return 'HIGH';
    case 'MEDIUM':    return 'MEDIUM';
    default:          return 'LOW';
  }
}

function classifyAlertType(
  premium: number,
  proxy: AggressionProxy,
  dte: number,
  isRepeat: boolean,
  volumeOIRatio: number,
): AlertType {
  if (isRepeat) return 'REPEATED_HIT';
  const isAskSide = proxy === 'A' || proxy === 'AA';
  if (premium >= 1_000_000 && isAskSide && dte >= 8 && dte <= 45) return 'GOLDEN_SWEEP';
  if (premium >= 100_000 && isAskSide) return 'SWEEP';
  if (premium >= 100_000 && !isAskSide) return 'BLOCK';
  if (volumeOIRatio >= 2.0) return 'UNUSUAL_VOLUME';
  return 'UNUSUAL_VOLUME';
}

// ─────────────────────────────────────────────────────────────────────────────
// HEDGE DETECTION
// ─────────────────────────────────────────────────────────────────────────────

function detectHedge(
  type: 'CALL' | 'PUT',
  dte: number,
  absDelta: number,
  stockTrend: 'UP' | 'DOWN' | 'SIDEWAYS',
  volumeOIRatio: number,
  symbol: string,
): { isHedge: boolean; reason: string } {
  // Index/ETF with DTE > 30 — likely portfolio hedge
  const isIndex = ['SPY', 'QQQ', 'IWM', 'DIA', 'VTI', 'XLF', 'XLE', 'XLK', 'XLV'].includes(symbol);
  if (isIndex && dte > 30 && type === 'PUT') {
    return { isHedge: true, reason: 'ETF put hedge (portfolio protection)' };
  }
  // DTE > 90 AND ITM — portfolio hedge signature
  if (dte > 90 && absDelta > 0.65) {
    return { isHedge: true, reason: 'Long-dated ITM option (likely hedge or synthetic)' };
  }
  // Trend contradiction with low vol/OI
  if (type === 'PUT' && stockTrend === 'UP' && volumeOIRatio < 0.5) {
    return { isHedge: true, reason: 'Put in uptrend with low vol/OI — likely protective hedge' };
  }
  // Very low vol/OI means mostly existing positions being traded
  if (volumeOIRatio < 0.3) {
    return { isHedge: true, reason: 'Vol/OI < 0.3 — mostly closing positions' };
  }
  return { isHedge: false, reason: 'Directional signals predominate' };
}

// ─────────────────────────────────────────────────────────────────────────────
// INSIDER / CONVICTION SIGNALS
// ─────────────────────────────────────────────────────────────────────────────

function detectInsiderSignals(
  premium: number,
  dte: number,
  otmPercent: number,
  volumeOIRatio: number,
  proxy: AggressionProxy,
  isNearEarnings: boolean,
  type: 'CALL' | 'PUT',
): { signals: string[]; probability: 'HIGH' | 'MEDIUM' | 'LOW' | 'UNLIKELY' } {
  const signals: string[] = [];
  let score = 0;

  if (dte < 14) { signals.push('Short-dated (< 2 weeks) — high urgency'); score += 2; }
  if (proxy === 'AA') { signals.push('Paid above ask — maximum execution urgency'); score += 2; }
  if (otmPercent > 10 && dte < 30 && volumeOIRatio > 1) {
    signals.push(`Deep OTM (${otmPercent.toFixed(0)}%) + short-dated + new positions`); score += 3;
  }
  if (premium > 1_000_000) { signals.push(`$${(premium / 1e6).toFixed(1)}M premium — whale size`); score += 2; }
  if (isNearEarnings && type === 'CALL' && dte < 14) {
    signals.push('Near-earnings call with urgency — possible catalyst positioning'); score += 2;
  }
  if (volumeOIRatio > 5) { signals.push(`Vol/OI ${volumeOIRatio.toFixed(1)}x — significant new positioning`); score += 1; }

  const probability =
    score >= 6 ? 'HIGH' :
    score >= 4 ? 'MEDIUM' :
    score >= 2 ? 'LOW' : 'UNLIKELY';

  return { signals, probability };
}

// ─────────────────────────────────────────────────────────────────────────────
// CONTRACT ANALYZER
// ─────────────────────────────────────────────────────────────────────────────

interface ContractInput {
  symbol?: string;
  optionSymbol?: string;
  putCall?: string;       // 'CALL' | 'PUT'
  type?: string;          // 'call' | 'put' (options route uses this)
  strikePrice?: number;
  strike?: number;
  expirationDate?: string;
  expiration?: string;
  daysToExpiration?: number;
  dte?: number;
  delta?: number;
  totalVolume?: number;
  volume?: number;
  openInterest?: number;
  bid?: number;
  ask?: number;
  last?: number;
  mark?: number;
}

function analyzeContract(
  raw: ContractInput,
  underlyingPrice: number,
  stockTrend: 'UP' | 'DOWN' | 'SIDEWAYS',
  isNearEarnings: boolean,
  repeatDays: number,
  symbol: string,
): UnusualActivity | null {
  const isCall = (raw.putCall || raw.type || '').toUpperCase().startsWith('C');
  const type: 'CALL' | 'PUT' = isCall ? 'CALL' : 'PUT';

  const strike = raw.strikePrice ?? raw.strike ?? 0;
  const expiration = raw.expirationDate ?? raw.expiration ?? '';
  const dte = raw.daysToExpiration ?? raw.dte ?? 0;
  const delta = Math.abs(raw.delta ?? (isCall ? 0.40 : -0.40));
  const volume = raw.totalVolume ?? raw.volume ?? 0;
  const openInterest = raw.openInterest ?? 0;
  const bid = raw.bid ?? 0;
  const ask = raw.ask ?? 0;
  const last = raw.last ?? raw.mark ?? (bid + ask) / 2;
  const mark = raw.mark ?? ((bid + ask) / 2 || last);

  if (volume === 0) return null;

  // ── Metrics ──────────────────────────────────────────────
  const volumeOIRatio = openInterest > 0 ? volume / openInterest : volume > 0 ? 99 : 0;
  const avgVolume = Math.max(openInterest / 45, 10); // better heuristic: OI/45
  const volumeVsAvg = avgVolume > 0 ? volume / avgVolume : volume;
  const premium = volume * mark * 100;
  const impliedMove = Math.abs(strike - underlyingPrice) / underlyingPrice * 100;
  const otmPercent = isCall
    ? Math.max(0, (strike - underlyingPrice) / underlyingPrice * 100)
    : Math.max(0, (underlyingPrice - strike) / underlyingPrice * 100);

  // ── Minimum gates ─────────────────────────────────────────
  if (premium < 20_000 && volume < 100) return null;
  if (volumeOIRatio < 0.5 && volume < 500) return null;

  // ── Aggression proxy ──────────────────────────────────────
  const proxy = deriveAggressionProxy(last, bid, ask);

  // ── Score components ──────────────────────────────────────
  const premiumScore = scorePremium(premium);
  const volOIScore   = scoreVolOI(volumeOIRatio, volume >= openInterest && openInterest > 100);
  const aggrScore    = scoreAggression(proxy);
  const dteScore     = scoreDTE(dte, isNearEarnings);
  const moneynessScore = scoreMoneyness(delta);
  const catalystScore  = isNearEarnings ? 5 : 0;
  const repeatScore    = repeatDays >= 3 ? 5 : repeatDays >= 2 ? 3 : repeatDays >= 1 ? 2 : 0;

  // ── Hedge detection ───────────────────────────────────────
  const { isHedge, reason: hedgeReason } = detectHedge(type, dte, delta, stockTrend, volumeOIRatio, symbol);
  const hedgeDiscount = isHedge ? -20 : 0;

  const rawScore = premiumScore + volOIScore + aggrScore + dteScore + moneynessScore + catalystScore + repeatScore;
  const uoaScore = Math.max(0, Math.min(100, rawScore + hedgeDiscount));

  // After hedge discount — apply minimum threshold
  if (uoaScore < 20) return null;

  const tier = scoreTier(uoaScore);
  const isRepeat = repeatDays >= 2;
  const alertType = classifyAlertType(premium, proxy, dte, isRepeat, volumeOIRatio);

  // ── Sentiment ─────────────────────────────────────────────
  let sentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';
  if (type === 'CALL') {
    sentiment = (proxy === 'A' || proxy === 'AA' || last >= mark) ? 'BULLISH' : 'NEUTRAL';
  } else {
    sentiment = (proxy === 'A' || proxy === 'AA' || last >= mark) ? 'BEARISH' : 'NEUTRAL';
  }
  if (isHedge) sentiment = 'NEUTRAL';

  // ── Insider signals ───────────────────────────────────────
  const { signals: insiderSignals, probability: insiderProbability } = detectInsiderSignals(
    premium, dte, otmPercent, volumeOIRatio, proxy, isNearEarnings, type
  );

  // ── Trade type classification ──────────────────────────────
  const tradeType: 'DIRECTIONAL' | 'LIKELY_HEDGE' | 'UNCERTAIN' = isHedge ? 'LIKELY_HEDGE' : 'DIRECTIONAL';

  // ── Human-readable reasoning ──────────────────────────────
  const reasoning: string[] = [];
  if (alertType === 'GOLDEN_SWEEP') reasoning.push(`Golden sweep — $${(premium / 1e6).toFixed(2)}M at ask-side`);
  else if (alertType === 'SWEEP') reasoning.push(`Sweep — $${(premium / 1e3).toFixed(0)}K aggressive buy`);
  else if (alertType === 'BLOCK') reasoning.push(`Block print — $${(premium / 1e3).toFixed(0)}K institutional`);
  else if (alertType === 'REPEATED_HIT') reasoning.push(`Repeat flow — ${repeatDays}d consecutive accumulation`);
  else reasoning.push(`Unusual volume — ${volumeOIRatio.toFixed(1)}x normal`);

  if (proxy === 'A' || proxy === 'AA') reasoning.push('Bought at/above ask — buyer is urgent');
  if (volumeOIRatio >= 2) reasoning.push(`Vol/OI ${volumeOIRatio.toFixed(1)}x — significant new positions`);
  if (volume > openInterest && openInterest > 100) reasoning.push('Volume exceeds open interest — all new positioning');
  reasoning.push(`${volume.toLocaleString()} contracts · $${(premium / 1e3).toFixed(0)}K premium · δ${delta.toFixed(2)}`);
  if (isHedge) reasoning.push(`Hedge signal: ${hedgeReason}`);

  // ── Legacy compat ─────────────────────────────────────────
  const severity = tierToSeverity(tier);
  const activityType: UnusualActivity['activityType'] =
    alertType === 'GOLDEN_SWEEP' || alertType === 'SWEEP' ? 'SWEEP' :
    alertType === 'BLOCK' ? 'BLOCK' :
    premium >= 500_000 ? 'WHALE_TRADE' :
    Math.abs(strike - underlyingPrice) / underlyingPrice < 0.05 && volumeOIRatio > 1 ? 'GAMMA_SQUEEZE' :
    'UNUSUAL_VOLUME';

  const convictionLevel: 'HIGH' | 'MEDIUM' | 'LOW' =
    uoaScore >= 65 ? 'HIGH' : uoaScore >= 40 ? 'MEDIUM' : 'LOW';

  const interpretation = isHedge
    ? `Likely hedge: ${hedgeReason}`
    : `${convictionLevel} conviction ${sentiment.toLowerCase()} — ${alertType.replace('_', ' ')}`;

  const optionSymbol = raw.optionSymbol ||
    `${symbol}_${expiration}${type[0]}${strike}`;

  return {
    symbol,
    optionSymbol,
    type,
    strike,
    expiration,
    dte,
    delta,

    uoaScore,
    tier,
    alertType,
    scoreBreakdown: {
      premium: premiumScore,
      volOI: volOIScore,
      aggression: aggrScore,
      dte: dteScore,
      moneyness: moneynessScore,
      catalyst: catalystScore,
      repeat: repeatScore,
      hedgeDiscount,
    },
    aggressionProxy: proxy,

    severity,
    activityType,
    confidence: uoaScore,

    metrics: {
      volume,
      openInterest,
      volumeOIRatio: Math.round(volumeOIRatio * 100) / 100,
      avgVolume: Math.round(avgVolume),
      volumeVsAvg: Math.round(volumeVsAvg * 100) / 100,
      premium: Math.round(premium),
      impliedMove: Math.round(impliedMove * 100) / 100,
    },

    sentiment,
    tradeType,
    tradeTypeReason: isHedge ? hedgeReason : 'Directional signals predominate',
    hedgeDiscountApplied: isHedge,

    insiderProbability,
    insiderSignals,

    isRepeatFlow: isRepeat,
    consecutiveDays: repeatDays,

    reasoning,
    signals: reasoning,
    timestamp: Date.now(),

    convictionLevel,
    interpretation,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC API
// ─────────────────────────────────────────────────────────────────────────────

export function detectUnusualActivity(
  optionsChain: any[],
  underlyingPrice: number,
  filters?: ActivityFilters,
  opts?: {
    stockTrend?: 'UP' | 'DOWN' | 'SIDEWAYS';
    isNearEarnings?: boolean;
    repeatFlowMap?: Map<string, number>; // optionSymbol -> days
    symbol?: string;
  }
): UnusualActivity[] {
  const trend = opts?.stockTrend ?? 'SIDEWAYS';
  const nearEarnings = opts?.isNearEarnings ?? false;
  const repeatMap = opts?.repeatFlowMap ?? new Map();
  const sym = opts?.symbol ?? 'UNKNOWN';

  const activities: UnusualActivity[] = [];

  for (const raw of optionsChain) {
    const key = raw.optionSymbol || raw.symbol || '';
    const repeatDays = repeatMap.get(key) ?? 0;
    const activity = analyzeContract(raw, underlyingPrice, trend, nearEarnings, repeatDays, sym);
    if (activity && meetsFilters(activity, filters)) {
      activities.push(activity);
    }
  }

  return activities.sort((a, b) => {
    if (b.uoaScore !== a.uoaScore) return b.uoaScore - a.uoaScore;
    return b.metrics.premium - a.metrics.premium;
  });
}

// Overload used by the options route which passes calls+puts separately
export function detectUnusualActivityFromChain(
  calls: any[],
  puts: any[],
  underlyingPrice: number,
  symbol: string,
  opts?: {
    stockTrend?: 'UP' | 'DOWN' | 'SIDEWAYS';
    isNearEarnings?: boolean;
    repeatFlowMap?: Map<string, number>;
  }
): UnusualActivity[] {
  const all = [...calls, ...puts];
  const result = detectUnusualActivity(all, underlyingPrice, undefined, {
    ...opts,
    symbol,
  });
  return result.slice(0, 12);
}

function meetsFilters(activity: UnusualActivity, filters?: ActivityFilters): boolean {
  if (!filters) return true;
  if (filters.minVolume && activity.metrics.volume < filters.minVolume) return false;
  if (filters.minPremium && activity.metrics.premium < filters.minPremium) return false;
  if (filters.minVolumeOIRatio && activity.metrics.volumeOIRatio < filters.minVolumeOIRatio) return false;
  if (filters.minUOAScore && activity.uoaScore < filters.minUOAScore) return false;
  if (filters.excludeHedges && activity.hedgeDiscountApplied) return false;
  if (filters.types && !filters.types.includes(activity.type)) return false;
  if (filters.sentiments && !filters.sentiments.includes(activity.sentiment)) return false;
  if (filters.minSeverity) {
    const order = { LOW: 1, MEDIUM: 2, HIGH: 3, EXTREME: 4 };
    if (order[activity.severity] < order[filters.minSeverity]) return false;
  }
  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// PATTERN DETECTION (kept for compat)
// ─────────────────────────────────────────────────────────────────────────────

export interface ActivityPattern {
  pattern: 'CALL_SWEEP' | 'PUT_SWEEP' | 'STRADDLE' | 'STRANGLE' | 'RATIO_SPREAD' | 'MIXED_SIGNALS';
  description: string;
  sentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  confidence: number;
  activities: UnusualActivity[];
}

export function detectPatterns(activities: UnusualActivity[]): ActivityPattern[] {
  const patterns: ActivityPattern[] = [];
  const bySymbol = new Map<string, UnusualActivity[]>();

  for (const a of activities) {
    if (!bySymbol.has(a.symbol)) bySymbol.set(a.symbol, []);
    bySymbol.get(a.symbol)!.push(a);
  }

  for (const [, symbolActivities] of bySymbol.entries()) {
    const callSweeps = symbolActivities.filter(a =>
      a.type === 'CALL' && (a.alertType === 'SWEEP' || a.alertType === 'GOLDEN_SWEEP')
    );
    if (callSweeps.length > 0) {
      const total = callSweeps.reduce((s, a) => s + a.metrics.premium, 0);
      patterns.push({
        pattern: 'CALL_SWEEP',
        description: `${callSweeps.length} call sweeps totaling $${(total / 1e6).toFixed(2)}M`,
        sentiment: 'BULLISH',
        confidence: Math.min(95, 60 + callSweeps.length * 10),
        activities: callSweeps,
      });
    }

    const putSweeps = symbolActivities.filter(a =>
      a.type === 'PUT' && (a.alertType === 'SWEEP' || a.alertType === 'GOLDEN_SWEEP')
    );
    if (putSweeps.length > 0) {
      const total = putSweeps.reduce((s, a) => s + a.metrics.premium, 0);
      patterns.push({
        pattern: 'PUT_SWEEP',
        description: `${putSweeps.length} put sweeps totaling $${(total / 1e6).toFixed(2)}M`,
        sentiment: 'BEARISH',
        confidence: Math.min(95, 60 + putSweeps.length * 10),
        activities: putSweeps,
      });
    }

    const calls = symbolActivities.filter(a => a.type === 'CALL');
    const puts  = symbolActivities.filter(a => a.type === 'PUT');

    if (calls.length > 0 && puts.length > 0) {
      // Straddle: matching strikes
      for (const c of calls) {
        const mp = puts.find(p => Math.abs(p.strike - c.strike) < 1);
        if (mp) {
          patterns.push({
            pattern: 'STRADDLE',
            description: `Straddle at $${c.strike} — expecting big move`,
            sentiment: 'NEUTRAL',
            confidence: 75,
            activities: [c, mp],
          });
        }
      }

      // Mixed signals
      const callPrem = calls.reduce((s, a) => s + a.metrics.premium, 0);
      const putPrem  = puts.reduce((s, a) => s + a.metrics.premium, 0);
      const ratio = Math.min(callPrem, putPrem) / Math.max(callPrem, putPrem);
      if (ratio > 0.5) {
        patterns.push({
          pattern: 'MIXED_SIGNALS',
          description: `Mixed: $${(callPrem / 1e6).toFixed(2)}M calls vs $${(putPrem / 1e6).toFixed(2)}M puts`,
          sentiment: 'NEUTRAL',
          confidence: 50,
          activities: [...calls, ...puts],
        });
      }
    }
  }

  return patterns;
}

// ─────────────────────────────────────────────────────────────────────────────
// MONITOR (kept for compat)
// ─────────────────────────────────────────────────────────────────────────────

export class UnusualActivityMonitor {
  private activities = new Map<string, UnusualActivity>();
  private callbacks = new Set<(a: UnusualActivity) => void>();
  private thresholds: ActivityFilters;

  constructor(thresholds?: ActivityFilters) {
    this.thresholds = thresholds ?? { minUOAScore: 30 };
  }

  processUpdate(contract: any, underlyingPrice: number, symbol?: string) {
    const activity = analyzeContract(contract, underlyingPrice, 'SIDEWAYS', false, 0, symbol ?? 'UNKNOWN');
    if (activity && meetsFilters(activity, this.thresholds)) {
      const key = activity.optionSymbol;
      const existing = this.activities.get(key);
      if (!existing || activity.uoaScore > existing.uoaScore) {
        this.activities.set(key, activity);
        this.callbacks.forEach(cb => cb(activity));
      }
    }
  }

  subscribe(callback: (a: UnusualActivity) => void) {
    this.callbacks.add(callback);
    return () => this.callbacks.delete(callback);
  }

  getActivities(): UnusualActivity[] {
    return [...this.activities.values()].sort((a, b) => b.uoaScore - a.uoaScore);
  }

  clearOld(maxAgeMs = 3_600_000) {
    const now = Date.now();
    for (const [key, a] of this.activities.entries()) {
      if (now - a.timestamp > maxAgeMs) this.activities.delete(key);
    }
  }

  setThresholds(t: ActivityFilters) { this.thresholds = t; }
}
