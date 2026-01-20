// lib/unusualActivityDetector.ts
// Enhanced unusual options activity detection engine
// Detects: Large trades, unusual volume, aggressive sweeps, gamma squeezes

export interface UnusualActivity {
  symbol: string;
  optionSymbol: string;
  type: 'CALL' | 'PUT';
  strike: number;
  expiration: string;
  activityType: 'SWEEP' | 'BLOCK' | 'UNUSUAL_VOLUME' | 'GAMMA_SQUEEZE' | 'WHALE_TRADE';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME';
  metrics: {
    volume: number;
    openInterest: number;
    volumeOIRatio: number;
    avgVolume: number;
    volumeVsAvg: number;
    premium: number;
    impliedMove: number;
  };
  sentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  confidence: number;
  reasoning: string[];
  timestamp: number;
}

export interface ActivityFilters {
  minVolume?: number;
  minPremium?: number;
  minVolumeOIRatio?: number;
  minSeverity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME';
  types?: Array<'CALL' | 'PUT'>;
  sentiments?: Array<'BULLISH' | 'BEARISH' | 'NEUTRAL'>;
}

// ============================================================
// DETECTION ALGORITHMS
// ============================================================

/**
 * Detects unusual options activity from options chain data
 */
export function detectUnusualActivity(
  optionsChain: any[],
  underlyingPrice: number,
  filters?: ActivityFilters
): UnusualActivity[] {
  const activities: UnusualActivity[] = [];

  for (const contract of optionsChain) {
    const activity = analyzeContract(contract, underlyingPrice);
    
    if (activity && meetsFilters(activity, filters)) {
      activities.push(activity);
    }
  }

  // Sort by severity and confidence
  return activities.sort((a, b) => {
    const severityOrder = { EXTREME: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
    if (severityOrder[a.severity] !== severityOrder[b.severity]) {
      return severityOrder[b.severity] - severityOrder[a.severity];
    }
    return b.confidence - a.confidence;
  });
}

/**
 * Analyzes a single options contract for unusual activity
 */
function analyzeContract(contract: any, underlyingPrice: number): UnusualActivity | null {
  const volume = contract.totalVolume || 0;
  const openInterest = contract.openInterest || 0;
  const bid = contract.bid || 0;
  const ask = contract.ask || 0;
  const last = contract.last || 0;
  const strike = contract.strikePrice || 0;
  const isCall = contract.putCall === 'CALL';
  
  // Skip if no volume
  if (volume === 0) return null;

  // Calculate key metrics
  const volumeOIRatio = openInterest > 0 ? volume / openInterest : volume;
  const avgVolume = openInterest * 0.1; // Assume 10% of OI is normal daily volume
  const volumeVsAvg = avgVolume > 0 ? volume / avgVolume : volume;
  const midPrice = (bid + ask) / 2;
  const premium = volume * midPrice * 100; // Premium in dollars
  const impliedMove = Math.abs(strike - underlyingPrice) / underlyingPrice * 100;

  // Detection thresholds
  const VOLUME_THRESHOLD = 100; // Minimum 100 contracts
  const VOLUME_OI_THRESHOLD = 0.5; // Volume is 50% of OI
  const VOLUME_VS_AVG_THRESHOLD = 3; // Volume is 3x average
  const PREMIUM_THRESHOLD = 50000; // $50k minimum premium
  const SWEEP_THRESHOLD = 1000; // 1000+ contracts = sweep
  const WHALE_THRESHOLD = 500000; // $500k+ = whale trade

  // Skip if below minimum thresholds
  if (volume < VOLUME_THRESHOLD && premium < PREMIUM_THRESHOLD) {
    return null;
  }

  // Determine activity type
  let activityType: UnusualActivity['activityType'] = 'UNUSUAL_VOLUME';
  let severity: UnusualActivity['severity'] = 'LOW';
  const reasoning: string[] = [];

  // Sweep detection (aggressive buying/selling)
  if (volume >= SWEEP_THRESHOLD) {
    activityType = 'SWEEP';
    severity = 'HIGH';
    reasoning.push(`Large sweep: ${volume.toLocaleString()} contracts`);
  }

  // Block trade detection (institutional size)
  if (premium >= WHALE_THRESHOLD) {
    activityType = volume >= SWEEP_THRESHOLD ? 'SWEEP' : 'BLOCK';
    severity = 'EXTREME';
    reasoning.push(`Whale trade: $${(premium / 1000000).toFixed(2)}M premium`);
  }

  // Unusual volume detection
  if (volumeOIRatio >= VOLUME_OI_THRESHOLD) {
    if (activityType === 'UNUSUAL_VOLUME') {
      severity = 'MEDIUM';
    }
    reasoning.push(`Volume ${volumeOIRatio.toFixed(1)}x open interest`);
  }

  if (volumeVsAvg >= VOLUME_VS_AVG_THRESHOLD) {
    reasoning.push(`Volume ${volumeVsAvg.toFixed(1)}x average`);
  }

  // Gamma squeeze potential (near-the-money, high volume)
  const moneyness = Math.abs(strike - underlyingPrice) / underlyingPrice * 100;
  if (moneyness < 5 && volumeOIRatio > 1 && volume > 500) {
    activityType = 'GAMMA_SQUEEZE';
    severity = 'HIGH';
    reasoning.push(`Gamma squeeze potential: ${moneyness.toFixed(1)}% OTM`);
  }

  // Determine sentiment
  let sentiment: UnusualActivity['sentiment'] = 'NEUTRAL';
  
  if (isCall) {
    // Calls being bought = bullish
    // Calls being sold = bearish (hedging)
    sentiment = last >= midPrice ? 'BULLISH' : 'BEARISH';
  } else {
    // Puts being bought = bearish
    // Puts being sold = bullish (hedging)
    sentiment = last >= midPrice ? 'BEARISH' : 'BULLISH';
  }

  // Adjust sentiment based on moneyness
  if (moneyness > 10) {
    // Far OTM = speculative
    if (volume > 1000) {
      reasoning.push(`Speculative ${isCall ? 'call' : 'put'} buying (${moneyness.toFixed(1)}% OTM)`);
    }
  } else if (moneyness < 3) {
    // ATM = directional
    reasoning.push(`At-the-money ${isCall ? 'call' : 'put'} activity`);
  }

  // Calculate confidence score
  let confidence = 50;
  
  if (volumeOIRatio >= VOLUME_OI_THRESHOLD) confidence += 15;
  if (volumeVsAvg >= VOLUME_VS_AVG_THRESHOLD) confidence += 15;
  if (premium >= WHALE_THRESHOLD) confidence += 20;
  if (volume >= SWEEP_THRESHOLD) confidence += 10;
  if (moneyness < 5) confidence += 10; // Near-the-money = more significant
  
  confidence = Math.min(95, confidence);

  // Add context to reasoning
  reasoning.push(`${volume.toLocaleString()} contracts at $${midPrice.toFixed(2)}`);
  reasoning.push(`Premium: $${(premium / 1000).toFixed(0)}k`);
  reasoning.push(`Strike: $${strike.toFixed(2)} (${moneyness.toFixed(1)}% ${strike > underlyingPrice ? 'OTM' : 'ITM'})`);

  return {
    symbol: contract.symbol || 'UNKNOWN',
    optionSymbol: contract.optionSymbol || `${contract.symbol}_${contract.expirationDate}${isCall ? 'C' : 'P'}${strike}`,
    type: isCall ? 'CALL' : 'PUT',
    strike,
    expiration: contract.expirationDate || 'Unknown',
    activityType,
    severity,
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
    confidence,
    reasoning,
    timestamp: Date.now(),
  };
}

/**
 * Filters activities based on criteria
 */
function meetsFilters(activity: UnusualActivity, filters?: ActivityFilters): boolean {
  if (!filters) return true;

  if (filters.minVolume && activity.metrics.volume < filters.minVolume) {
    return false;
  }

  if (filters.minPremium && activity.metrics.premium < filters.minPremium) {
    return false;
  }

  if (filters.minVolumeOIRatio && activity.metrics.volumeOIRatio < filters.minVolumeOIRatio) {
    return false;
  }

  if (filters.minSeverity) {
    const severityOrder = { LOW: 1, MEDIUM: 2, HIGH: 3, EXTREME: 4 };
    if (severityOrder[activity.severity] < severityOrder[filters.minSeverity]) {
      return false;
    }
  }

  if (filters.types && !filters.types.includes(activity.type)) {
    return false;
  }

  if (filters.sentiments && !filters.sentiments.includes(activity.sentiment)) {
    return false;
  }

  return true;
}

// ============================================================
// REAL-TIME MONITORING
// ============================================================

/**
 * Monitors unusual activity in real-time using streaming data
 */
export class UnusualActivityMonitor {
  private activities: Map<string, UnusualActivity> = new Map();
  private callbacks: Set<(activity: UnusualActivity) => void> = new Set();
  private thresholds: ActivityFilters;

  constructor(thresholds?: ActivityFilters) {
    this.thresholds = thresholds || {
      minVolume: 100,
      minPremium: 50000,
      minSeverity: 'MEDIUM',
    };
  }

  /**
   * Process new options data
   */
  processUpdate(contract: any, underlyingPrice: number) {
    const activity = analyzeContract(contract, underlyingPrice);
    
    if (activity && meetsFilters(activity, this.thresholds)) {
      const key = activity.optionSymbol;
      
      // Check if this is new or updated activity
      const existing = this.activities.get(key);
      if (!existing || activity.metrics.volume > existing.metrics.volume) {
        this.activities.set(key, activity);
        
        // Notify callbacks
        this.callbacks.forEach(cb => cb(activity));
      }
    }
  }

  /**
   * Subscribe to unusual activity alerts
   */
  subscribe(callback: (activity: UnusualActivity) => void) {
    this.callbacks.add(callback);
    return () => this.callbacks.delete(callback);
  }

  /**
   * Get all current unusual activities
   */
  getActivities(): UnusualActivity[] {
    return Array.from(this.activities.values()).sort((a, b) => {
      const severityOrder = { EXTREME: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
      return severityOrder[b.severity] - severityOrder[a.severity];
    });
  }

  /**
   * Clear old activities
   */
  clearOld(maxAgeMs: number = 3600000) { // 1 hour default
    const now = Date.now();
    for (const [key, activity] of this.activities.entries()) {
      if (now - activity.timestamp > maxAgeMs) {
        this.activities.delete(key);
      }
    }
  }

  /**
   * Update thresholds
   */
  setThresholds(thresholds: ActivityFilters) {
    this.thresholds = thresholds;
  }
}

// ============================================================
// PATTERN DETECTION
// ============================================================

/**
 * Detects specific patterns in unusual activity
 */
export interface ActivityPattern {
  pattern: 'CALL_SWEEP' | 'PUT_SWEEP' | 'STRADDLE' | 'STRANGLE' | 'RATIO_SPREAD' | 'MIXED_SIGNALS';
  description: string;
  sentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  confidence: number;
  activities: UnusualActivity[];
}

export function detectPatterns(activities: UnusualActivity[]): ActivityPattern[] {
  const patterns: ActivityPattern[] = [];

  // Group by symbol
  const bySymbol = new Map<string, UnusualActivity[]>();
  for (const activity of activities) {
    const symbol = activity.symbol;
    if (!bySymbol.has(symbol)) {
      bySymbol.set(symbol, []);
    }
    bySymbol.get(symbol)!.push(activity);
  }

  // Analyze each symbol
  for (const [symbol, symbolActivities] of bySymbol.entries()) {
    // Call sweep pattern
    const callSweeps = symbolActivities.filter(a => 
      a.type === 'CALL' && 
      (a.activityType === 'SWEEP' || a.activityType === 'WHALE_TRADE')
    );
    
    if (callSweeps.length > 0) {
      const totalPremium = callSweeps.reduce((sum, a) => sum + a.metrics.premium, 0);
      patterns.push({
        pattern: 'CALL_SWEEP',
        description: `${callSweeps.length} call sweeps totaling $${(totalPremium / 1000000).toFixed(2)}M`,
        sentiment: 'BULLISH',
        confidence: Math.min(95, 60 + callSweeps.length * 10),
        activities: callSweeps,
      });
    }

    // Put sweep pattern
    const putSweeps = symbolActivities.filter(a => 
      a.type === 'PUT' && 
      (a.activityType === 'SWEEP' || a.activityType === 'WHALE_TRADE')
    );
    
    if (putSweeps.length > 0) {
      const totalPremium = putSweeps.reduce((sum, a) => sum + a.metrics.premium, 0);
      patterns.push({
        pattern: 'PUT_SWEEP',
        description: `${putSweeps.length} put sweeps totaling $${(totalPremium / 1000000).toFixed(2)}M`,
        sentiment: 'BEARISH',
        confidence: Math.min(95, 60 + putSweeps.length * 10),
        activities: putSweeps,
      });
    }

    // Straddle/Strangle detection (calls + puts at similar strikes)
    const calls = symbolActivities.filter(a => a.type === 'CALL');
    const puts = symbolActivities.filter(a => a.type === 'PUT');
    
    if (calls.length > 0 && puts.length > 0) {
      // Check for matching strikes (straddle)
      for (const call of calls) {
        const matchingPut = puts.find(p => Math.abs(p.strike - call.strike) < 1);
        if (matchingPut) {
          patterns.push({
            pattern: 'STRADDLE',
            description: `Straddle at $${call.strike.toFixed(2)} - expecting big move`,
            sentiment: 'NEUTRAL',
            confidence: 75,
            activities: [call, matchingPut],
          });
        }
      }
      
      // Check for near-strikes (strangle)
      for (const call of calls) {
        const nearPut = puts.find(p => 
          p.strike < call.strike && 
          Math.abs(p.strike - call.strike) / call.strike < 0.1
        );
        if (nearPut) {
          patterns.push({
            pattern: 'STRANGLE',
            description: `Strangle $${nearPut.strike.toFixed(2)}/$${call.strike.toFixed(2)} - expecting volatility`,
            sentiment: 'NEUTRAL',
            confidence: 70,
            activities: [call, nearPut],
          });
        }
      }
    }

    // Mixed signals (conflicting call and put activity)
    if (calls.length > 0 && puts.length > 0) {
      const callPremium = calls.reduce((sum, a) => sum + a.metrics.premium, 0);
      const putPremium = puts.reduce((sum, a) => sum + a.metrics.premium, 0);
      const ratio = Math.min(callPremium, putPremium) / Math.max(callPremium, putPremium);
      
      if (ratio > 0.5) { // Significant activity on both sides
        patterns.push({
          pattern: 'MIXED_SIGNALS',
          description: `Mixed signals: $${(callPremium / 1000000).toFixed(2)}M calls vs $${(putPremium / 1000000).toFixed(2)}M puts`,
          sentiment: 'NEUTRAL',
          confidence: 65,
          activities: [...calls, ...puts],
        });
      }
    }
  }

  return patterns;
}
