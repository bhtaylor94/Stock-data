import { NextRequest, NextResponse } from 'next/server';
import { getSchwabAccessToken, schwabFetchJson } from '@/lib/schwab';

export const runtime = 'nodejs';

// Expected move helper: IV * sqrt(T) using annualized IV.
// Returns percent move over `dte` days. Used for conservative risk gating.
function expectedMovePct(atmIV: number, dte: number): number {
  const t = Math.max(1, dte) / 365;
  const pct = Math.max(0, atmIV) * Math.sqrt(t) * 100;
  return Math.round(pct * 100) / 100;
}

// ============================================================
// COMPREHENSIVE OPTIONS API
// Features:
// - All expiration dates
// - Unusual options activity detection
// - Volume/OI analysis
// - Smart money indicators
// - IV analysis
// - Put/Call skew
// - Professional-grade scoring
// ============================================================

const FINNHUB_KEY = process.env.FINNHUB_API_KEY;

// ============================================================
// FETCH SCHWAB DATA
// 401 retry is handled inside schwabFetchJson (lib/schwab.ts).
// ============================================================
async function fetchOptionsChain(token: string, symbol: string): Promise<{ data: any; error: string | null }> {
  const url = `https://api.schwabapi.com/marketdata/v1/chains?symbol=${symbol}&contractType=ALL&strikeCount=50&includeUnderlyingQuote=true&range=ALL`;
  const result = await schwabFetchJson<any>(token, url, { scope: 'options' });

  if (!result.ok) {
    const vercelEnv = process.env.VERCEL_ENV || process.env.NODE_ENV || 'unknown';
    if (result.status === 401) {
      return {
        data: null,
        error: `Market data API rejected the access token (401) even after a forced refresh. Env: ${vercelEnv}. ` +
               `Check: (1) env vars set for the same environment, (2) refresh token created for this app key/secret, ` +
               `(3) refresh-token rotation, (4) temporary Schwab auth outage.`,
      };
    }
    if (result.status === 404) return { data: null, error: `Symbol '${symbol}' not found or has no options` };
    if (result.status === 429) return { data: null, error: 'Rate limited by Schwab - wait 60 seconds and try again' };
    return { data: null, error: result.error };
  }

  return { data: result.data, error: null };
}

async function fetchPriceHistory(token: string, symbol: string): Promise<{ close: number; high: number; low: number; volume: number }[]> {
  const url = `https://api.schwabapi.com/marketdata/v1/pricehistory?symbol=${symbol}&periodType=month&period=3&frequencyType=daily&frequency=1`;
  const result = await schwabFetchJson<any>(token, url, { scope: 'options' });
  if (!result.ok) return [];
  return (result.data?.candles || []).map((c: any) => ({ close: c.close, high: c.high || c.close, low: c.low || c.close, volume: c.volume || 0 }));
}

// ============================================================
// OPTION CONTRACT TYPE
// ============================================================
interface OptionContract {
  symbol: string;
  strike: number;
  expiration: string;
  dte: number;
  type: 'call' | 'put';
  bid: number;
  ask: number;
  last: number;
  mark: number;
  volume: number;
  openInterest: number;
  delta: number;
  gamma: number;
  theta: number;
  vega: number;
  rho: number;
  iv: number;
  itm: boolean;
  intrinsicValue: number;
  extrinsicValue: number;
  bidAskSpread: number;
  spreadPercent: number;
  // Unusual activity flags
  volumeOIRatio: number;
  isUnusual: boolean;
  unusualScore: number;
}

// ============================================================
// PARSE OPTIONS CHAIN - ALL EXPIRATIONS
// ============================================================
function parseOptionsChain(chainData: any, currentPrice: number): {
  calls: OptionContract[];
  puts: OptionContract[];
  expirations: string[];
  byExpiration: { [exp: string]: { calls: OptionContract[]; puts: OptionContract[] } };
} {
  const calls: OptionContract[] = [];
  const puts: OptionContract[] = [];
  const expirationSet = new Set<string>();
  const byExpiration: { [exp: string]: { calls: OptionContract[]; puts: OptionContract[] } } = {};

  const parseMap = (expDateMap: any, type: 'call' | 'put') => {
    if (!expDateMap) return;
    
    for (const [expKey, strikes] of Object.entries(expDateMap)) {
      const expDate = expKey.split(':')[0];
      expirationSet.add(expDate);
      
      if (!byExpiration[expDate]) {
        byExpiration[expDate] = { calls: [], puts: [] };
      }
      
      for (const [strikeStr, contracts] of Object.entries(strikes as any)) {
        const contractArr = contracts as any[];
        if (!contractArr || contractArr.length === 0) continue;
        
        const c = contractArr[0];
        const strike = parseFloat(strikeStr);
        
        // Include strikes within 30% of current price
        if (Math.abs(strike - currentPrice) / currentPrice > 0.30) continue;
        
        const bid = c.bid || 0;
        const ask = c.ask || 0;
        const mark = (bid + ask) / 2 || c.last || 0;
        const itm = type === 'call' ? strike < currentPrice : strike > currentPrice;
        const intrinsic = type === 'call' 
          ? Math.max(0, currentPrice - strike)
          : Math.max(0, strike - currentPrice);
        const volume = c.totalVolume || 0;
        const openInterest = c.openInterest || 0;
        const volumeOIRatio = openInterest > 0 ? volume / openInterest : volume > 0 ? 999 : 0;
        const bidAskSpread = ask - bid;
        const spreadPercent = mark > 0 ? (bidAskSpread / mark) * 100 : 0;
        
        // Calculate unusual score
        let unusualScore = 0;
        if (volumeOIRatio >= 3) unusualScore += 30;
        else if (volumeOIRatio >= 1.5) unusualScore += 15;
        if (volume >= 1000) unusualScore += 20;
        else if (volume >= 500) unusualScore += 10;
        if (volume >= openInterest && openInterest > 100) unusualScore += 25;
        if (mark * volume * 100 >= 100000) unusualScore += 15; // Premium > $100k
        if (Math.abs(c.delta || 0) >= 0.3 && Math.abs(c.delta || 0) <= 0.7) unusualScore += 10;
        
        const contract: OptionContract = {
          symbol: c.symbol || '',
          strike,
          expiration: expDate,
          dte: c.daysToExpiration || 0,
          type,
          bid,
          ask,
          last: c.last || mark,
          mark,
          volume,
          openInterest,
          delta: c.delta || 0,
          gamma: c.gamma || 0,
          theta: c.theta || 0,
          vega: c.vega || 0,
          rho: c.rho || 0,
          iv: (c.volatility || 0) / 100,
          itm,
          intrinsicValue: intrinsic,
          extrinsicValue: Math.max(0, mark - intrinsic),
          bidAskSpread,
          spreadPercent,
          volumeOIRatio: Math.round(volumeOIRatio * 100) / 100,
          isUnusual: unusualScore >= 50,
          unusualScore,
        };
        
        if (type === 'call') {
          calls.push(contract);
          byExpiration[expDate].calls.push(contract);
        } else {
          puts.push(contract);
          byExpiration[expDate].puts.push(contract);
        }
      }
    }
  };

  parseMap(chainData.callExpDateMap, 'call');
  parseMap(chainData.putExpDateMap, 'put');

  // Sort
  const sortFn = (a: OptionContract, b: OptionContract) => a.dte - b.dte || a.strike - b.strike;
  calls.sort(sortFn);
  puts.sort(sortFn);
  
  // Sort each expiration's options
  for (const exp of Object.keys(byExpiration)) {
    byExpiration[exp].calls.sort((a, b) => a.strike - b.strike);
    byExpiration[exp].puts.sort((a, b) => a.strike - b.strike);
  }

  return {
    calls,
    puts,
    expirations: Array.from(expirationSet).sort(),
    byExpiration,
  };
}

// ============================================================
// DETECT UNUSUAL OPTIONS ACTIVITY
// ============================================================
interface UnusualActivity {
  contract: OptionContract;
  signals: string[];
  score: number;
  sentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  premiumValue: number;
  convictionLevel: 'HIGH' | 'MEDIUM' | 'LOW';
  interpretation: string;
  // NEW: Hedge vs Directional classification
  tradeType: 'DIRECTIONAL' | 'LIKELY_HEDGE' | 'UNCERTAIN';
  tradeTypeReason: string;
  insiderProbability: 'HIGH' | 'MEDIUM' | 'LOW' | 'UNLIKELY';
  insiderSignals: string[];
}

// Research-based criteria for determining hedge vs directional
function classifyTradeType(
  contract: OptionContract, 
  currentPrice: number, 
  stockTrend: 'UP' | 'DOWN' | 'SIDEWAYS',
  isNearEarnings: boolean
): { 
  tradeType: 'DIRECTIONAL' | 'LIKELY_HEDGE' | 'UNCERTAIN'; 
  reason: string;
  insiderProbability: 'HIGH' | 'MEDIUM' | 'LOW' | 'UNLIKELY';
  insiderSignals: string[];
} {
  const insiderSignals: string[] = [];
  let hedgeScore = 0;
  let directionalScore = 0;
  let insiderScore = 0;
  
  // KEY RESEARCH FINDINGS:
  // 1. Short-dated options (< 30 DTE) = more likely directional/speculative
  // 2. Long-dated options (> 90 DTE) = more likely hedge
  // 3. Trend contradiction (puts in uptrend, calls in downtrend) = likely hedge
  // 4. Near-ATM with high volume = directional
  // 5. Deep OTM with high premium = possible insider knowledge
  
  // Factor 1: Expiration - Research shows short-term = conviction, long-term = hedge
  if (contract.dte < 14) {
    directionalScore += 3;
    insiderSignals.push('Short-dated (< 2 weeks) - high urgency');
    insiderScore += 2;
  } else if (contract.dte < 30) {
    directionalScore += 2;
    insiderSignals.push('Near-term expiration - elevated conviction');
    insiderScore += 1;
  } else if (contract.dte > 90) {
    hedgeScore += 3;
  } else if (contract.dte > 60) {
    hedgeScore += 1;
  }
  
  // Factor 2: Moneyness - Deep OTM with high premium = unusual
  const otmPercent = contract.type === 'call' 
    ? (contract.strike - currentPrice) / currentPrice * 100
    : (currentPrice - contract.strike) / currentPrice * 100;
  
  if (otmPercent > 20) {
    // Deep OTM - very speculative or hedge
    if (contract.dte < 30 && contract.volume > contract.openInterest) {
      directionalScore += 3;
      insiderSignals.push(`Deep OTM (${otmPercent.toFixed(0)}%) with new positions - possible insider knowledge`);
      insiderScore += 3;
    } else {
      hedgeScore += 2;
    }
  } else if (otmPercent > 10) {
    // Moderately OTM
    directionalScore += 1;
  } else if (otmPercent < 5) {
    // ATM or ITM - strong directional conviction
    directionalScore += 2;
  }
  
  // Factor 3: Trend contradiction - KEY HEDGE SIGNAL
  // Puts during uptrend or calls during downtrend = likely hedge
  if (contract.type === 'put' && stockTrend === 'UP') {
    hedgeScore += 3;
  } else if (contract.type === 'call' && stockTrend === 'DOWN') {
    hedgeScore += 3;
  } else {
    // Trade aligns with trend = directional
    directionalScore += 2;
  }
  
  // Factor 4: Volume vs Open Interest - New positions = directional
  if (contract.volume > contract.openInterest * 2) {
    directionalScore += 2;
    insiderSignals.push('Volume >> OI - significant new positioning');
    insiderScore += 1;
  } else if (contract.volume > contract.openInterest) {
    directionalScore += 1;
  }
  
  // Factor 5: Earnings proximity - hedging common before earnings
  if (isNearEarnings && contract.type === 'put') {
    hedgeScore += 2;
  } else if (isNearEarnings && contract.type === 'call' && contract.dte < 14) {
    directionalScore += 1;
    insiderSignals.push('Near-dated call before earnings - possible catalyst knowledge');
    insiderScore += 2;
  }
  
  // Factor 6: Premium size relative to typical - institutional or insider
  const premiumValue = contract.mark * contract.volume * 100;
  if (premiumValue > 1000000) {
    insiderSignals.push(`$${(premiumValue/1e6).toFixed(1)}M premium - institutional size`);
    if (contract.dte < 30 && otmPercent > 10) {
      insiderScore += 2;
    }
  }
  
  // Factor 7: Execution urgency (if available through spread)
  // Paying above mid-price indicates urgency
  if (contract.bid > 0 && contract.ask > 0) {
    const midPrice = (contract.bid + contract.ask) / 2;
    if (contract.last > midPrice * 1.02) {
      directionalScore += 1;
      insiderSignals.push('Paid above mid-price - urgency to enter');
      insiderScore += 1;
    }
  }
  
  // Determine trade type
  let tradeType: 'DIRECTIONAL' | 'LIKELY_HEDGE' | 'UNCERTAIN';
  let reason: string;
  
  if (directionalScore >= hedgeScore + 3) {
    tradeType = 'DIRECTIONAL';
    reason = 'Strong directional signals: short-dated, aligned with trend, new positions';
  } else if (hedgeScore >= directionalScore + 2) {
    tradeType = 'LIKELY_HEDGE';
    reason = 'Hedge characteristics: contradicts trend, longer-dated, or near earnings';
  } else {
    tradeType = 'UNCERTAIN';
    reason = 'Mixed signals - could be directional or hedge';
  }
  
  // Determine insider probability
  let insiderProbability: 'HIGH' | 'MEDIUM' | 'LOW' | 'UNLIKELY';
  if (insiderScore >= 6) {
    insiderProbability = 'HIGH';
  } else if (insiderScore >= 4) {
    insiderProbability = 'MEDIUM';
  } else if (insiderScore >= 2) {
    insiderProbability = 'LOW';
  } else {
    insiderProbability = 'UNLIKELY';
  }
  
  return { tradeType, reason, insiderProbability, insiderSignals };
}

function detectUnusualActivity(
  calls: OptionContract[], 
  puts: OptionContract[], 
  currentPrice: number,
  stockTrend: 'UP' | 'DOWN' | 'SIDEWAYS' = 'SIDEWAYS',
  isNearEarnings: boolean = false
): UnusualActivity[] {
  const unusual: UnusualActivity[] = [];
  
  const analyzeContract = (c: OptionContract) => {
    // INSTITUTIONAL FILTER: 30-180 DTE only (not 10-180)
    if (c.dte < 30 || c.dte > 180) return;
    if (c.volume < 50 || c.openInterest < 10) return;
    
    const signals: string[] = [];
    let unusualScore = 0;
    
    if (c.volumeOIRatio >= 5) {
      signals.push(`🔥🔥 Vol/OI: ${c.volumeOIRatio.toFixed(1)}x (Extreme)`);
      unusualScore += 40;
    } else if (c.volumeOIRatio >= 3) {
      signals.push(`🔥 Vol/OI: ${c.volumeOIRatio.toFixed(1)}x (Very High)`);
      unusualScore += 30;
    } else if (c.volumeOIRatio >= 1.5) {
      signals.push(`📈 Vol/OI: ${c.volumeOIRatio.toFixed(1)}x (Elevated)`);
      unusualScore += 15;
    } else {
      return;
    }
    
    const premiumValue = c.mark * c.volume * 100;
    if (premiumValue >= 1000000) {
      signals.push(`🐋 Premium: $${(premiumValue / 1e6).toFixed(2)}M (Whale)`);
      unusualScore += 35;
    } else if (premiumValue >= 500000) {
      signals.push(`💰 Premium: $${(premiumValue / 1e3).toFixed(0)}K (Institutional)`);
      unusualScore += 25;
    } else if (premiumValue >= 250000) {
      signals.push(`💵 Premium: $${(premiumValue / 1e3).toFixed(0)}K`);
      unusualScore += 15;
    } else {
      // Below $250k premium = too small for institutional
      return;
    }
    
    if (c.volume >= c.openInterest && c.openInterest > 100) {
      signals.push(`🆕 New Positions Opening`);
      unusualScore += 20;
    }
    
    if (c.volume >= 10000) {
      signals.push(`📊 Volume: ${c.volume.toLocaleString()} (Massive)`);
      unusualScore += 20;
    } else if (c.volume >= 5000) {
      signals.push(`📊 Volume: ${c.volume.toLocaleString()} (High)`);
      unusualScore += 10;
    }
    
    if (c.dte >= 30 && c.dte <= 90) {
      signals.push(`📅 ${c.dte} DTE - Optimal timeframe`);
      unusualScore += 10;
    }
    
    if (unusualScore < 40) return;
    
    const sentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = c.type === 'call' ? 'BULLISH' : 'BEARISH';
    
    let convictionLevel: 'HIGH' | 'MEDIUM' | 'LOW';
    if (unusualScore >= 80) convictionLevel = 'HIGH';
    else if (unusualScore >= 55) convictionLevel = 'MEDIUM';
    else convictionLevel = 'LOW';
    
    // NEW: Classify as hedge vs directional
    const classification = classifyTradeType(c, currentPrice, stockTrend, isNearEarnings);
    
    // Adjust interpretation based on trade type
    let interpretation = `${convictionLevel} conviction ${sentiment.toLowerCase()} bet targeting $${c.strike} within ${c.dte} days.`;
    if (classification.tradeType === 'LIKELY_HEDGE') {
      interpretation = `LIKELY HEDGE: ${sentiment.toLowerCase()} protection targeting $${c.strike}. ${classification.reason}`;
    } else if (classification.tradeType === 'DIRECTIONAL') {
      interpretation = `DIRECTIONAL BET: ${convictionLevel} conviction ${sentiment.toLowerCase()} position targeting $${c.strike}. ${classification.reason}`;
    }
    
    // Add insider warning if applicable
    if (classification.insiderProbability === 'HIGH' || classification.insiderProbability === 'MEDIUM') {
      signals.push(`🔍 Insider probability: ${classification.insiderProbability}`);
    }
    
    unusual.push({
      contract: c,
      signals,
      score: unusualScore,
      sentiment,
      premiumValue,
      convictionLevel,
      interpretation,
      tradeType: classification.tradeType,
      tradeTypeReason: classification.reason,
      insiderProbability: classification.insiderProbability,
      insiderSignals: classification.insiderSignals,
    });
  };
  
  calls.forEach(analyzeContract);
  puts.forEach(analyzeContract);
  
  unusual.sort((a, b) => b.score - a.score);
  
  return unusual.slice(0, 10);
}

// ============================================================
// IV ANALYSIS
// ============================================================
interface IVAnalysis {
  avgCallIV: number;
  avgPutIV: number;
  putCallIVSkew: number;
  ivRank: number;
  ivPercentile: number;
  ivSignal: 'HIGH' | 'ELEVATED' | 'NORMAL' | 'LOW';
  recommendation: 'BUY_PREMIUM' | 'SELL_PREMIUM' | 'NEUTRAL';
  atmIV: number;
}

function analyzeIV(calls: OptionContract[], puts: OptionContract[], currentPrice: number): IVAnalysis {
  const atmCalls = calls.filter(c => Math.abs(c.strike - currentPrice) / currentPrice < 0.05 && c.iv > 0);
  const atmPuts = puts.filter(p => Math.abs(p.strike - currentPrice) / currentPrice < 0.05 && p.iv > 0);
  
  const avgCallIV = atmCalls.length > 0 ? atmCalls.reduce((sum, c) => sum + c.iv, 0) / atmCalls.length : 0.30;
  const avgPutIV = atmPuts.length > 0 ? atmPuts.reduce((sum, p) => sum + p.iv, 0) / atmPuts.length : 0.30;
  const atmIV = (avgCallIV + avgPutIV) / 2;
  
  const putCallIVSkew = avgPutIV - avgCallIV;
  const ivRank = Math.min(100, Math.max(0, ((atmIV - 0.15) / 0.50) * 100));
  
  let ivSignal: 'HIGH' | 'ELEVATED' | 'NORMAL' | 'LOW' = 'NORMAL';
  let recommendation: 'BUY_PREMIUM' | 'SELL_PREMIUM' | 'NEUTRAL' = 'NEUTRAL';
  
  if (ivRank >= 70) {
    ivSignal = 'HIGH';
    recommendation = 'SELL_PREMIUM';
  } else if (ivRank >= 50) {
    ivSignal = 'ELEVATED';
  } else if (ivRank <= 30) {
    ivSignal = 'LOW';
    recommendation = 'BUY_PREMIUM';
  }
  
  return {
    avgCallIV: Math.round(avgCallIV * 1000) / 10,
    avgPutIV: Math.round(avgPutIV * 1000) / 10,
    putCallIVSkew: Math.round(putCallIVSkew * 1000) / 10,
    ivRank: Math.round(ivRank),
    ivPercentile: Math.round(ivRank),
    ivSignal,
    recommendation,
    atmIV: Math.round(atmIV * 1000) / 10,
  };
}

// ============================================================
// MARKET METRICS
// ============================================================
interface MarketMetrics {
  totalCallVolume: number;
  totalPutVolume: number;
  totalCallOI: number;
  totalPutOI: number;
  putCallRatio: number;
  putCallOIRatio: number;
  sentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  maxPain: number;
}

function calculateMarketMetrics(calls: OptionContract[], puts: OptionContract[], currentPrice: number): MarketMetrics {
  const totalCallVolume = calls.reduce((sum, c) => sum + c.volume, 0);
  const totalPutVolume = puts.reduce((sum, p) => sum + p.volume, 0);
  const totalCallOI = calls.reduce((sum, c) => sum + c.openInterest, 0);
  const totalPutOI = puts.reduce((sum, p) => sum + p.openInterest, 0);
  
  const putCallRatio = totalCallVolume > 0 ? totalPutVolume / totalCallVolume : 1;
  const putCallOIRatio = totalCallOI > 0 ? totalPutOI / totalCallOI : 1;
  
  let sentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';
  if (putCallRatio < 0.7) sentiment = 'BULLISH';
  else if (putCallRatio > 1.2) sentiment = 'BEARISH';
  
  const strikeOI: { [strike: number]: number } = {};
  [...calls, ...puts].forEach(c => {
    strikeOI[c.strike] = (strikeOI[c.strike] || 0) + c.openInterest;
  });
  const maxPain = Object.entries(strikeOI).reduce((max, [strike, oi]) => 
    oi > (strikeOI[max] || 0) ? parseFloat(strike) : max, currentPrice);
  
  return {
    totalCallVolume,
    totalPutVolume,
    totalCallOI,
    totalPutOI,
    putCallRatio: Math.round(putCallRatio * 100) / 100,
    putCallOIRatio: Math.round(putCallOIRatio * 100) / 100,
    sentiment,
    maxPain: Math.round(maxPain * 100) / 100,
  };
}

// ============================================================
// TECHNICAL CALCULATIONS
// ============================================================
function calculateRSI(prices: number[], period = 14): number {
  if (prices.length < period + 1) return 50;
  const changes = prices.slice(-period - 1).map((p, i, arr) => i > 0 ? p - arr[i-1] : 0).slice(1);
  const gains = changes.filter(c => c > 0).reduce((a, b) => a + b, 0) / period;
  const losses = Math.abs(changes.filter(c => c < 0).reduce((a, b) => a + b, 0)) / period;
  if (losses === 0) return 100;
  return 100 - (100 / (1 + gains / losses));
}

function calculateSMA(prices: number[], period: number): number {
  if (prices.length < period) return prices[prices.length - 1] || 0;
  return prices.slice(-period).reduce((a, b) => a + b, 0) / period;
}

// ============================================================
// GENERATE SUGGESTIONS
// ============================================================
interface OptionScore {
  total: number;
  delta: number;
  iv: number;
  liquidity: number;
  timing: number;
  technical: number;
  unusual: number;
}

function scoreOption(
  option: OptionContract,
  trend: 'BULLISH' | 'BEARISH' | 'NEUTRAL',
  avgIV: number,
): OptionScore {
  let deltaScore = 0;
  let ivScore = 0;
  let liquidityScore = 0;
  let timingScore = 0;
  let technicalScore = 0;
  let unusualScore = 0;

  // Delta scoring
  const absDelta = Math.abs(option.delta);
  if (absDelta >= 0.35 && absDelta <= 0.65) deltaScore = 2;
  else if (absDelta >= 0.25 && absDelta <= 0.75) deltaScore = 1;

  // IV scoring
  const optIV = option.iv * 100;
  if (optIV < avgIV * 0.9) ivScore = 2;
  else if (optIV <= avgIV) ivScore = 1;

  // Liquidity scoring
  if (option.spreadPercent < 3 && option.volume > 200) liquidityScore = 2;
  else if (option.spreadPercent < 5 && option.volume > 50) liquidityScore = 1;

  // Timing scoring
  if (option.dte >= 21 && option.dte <= 45) timingScore = 2;
  else if (option.dte >= 14 && option.dte <= 60) timingScore = 1;

  // Technical scoring
  if (option.type === 'call' && trend === 'BULLISH') technicalScore = 2;
  else if (option.type === 'put' && trend === 'BEARISH') technicalScore = 2;
  else if (trend === 'NEUTRAL') technicalScore = 1;

  // Unusual activity bonus
  if (option.isUnusual) unusualScore = 2;
  else if (option.unusualScore >= 30) unusualScore = 1;

  return {
    total: deltaScore + ivScore + liquidityScore + timingScore + technicalScore + unusualScore,
    delta: deltaScore,
    iv: ivScore,
    liquidity: liquidityScore,
    timing: timingScore,
    technical: technicalScore,
    unusual: unusualScore,
  };
}


function calibratedOptionConfidence(totalScore: number, trend: 'BULLISH' | 'BEARISH' | 'NEUTRAL', isTrendAligned: boolean, spreadPct: number, oi: number, volume: number) {
  // Conservative calibration to avoid overconfidence. (Measured framework placeholder - calibrate with future backtests.)
  let conf =
    totalScore >= 10 ? 76 :
    totalScore >= 8 ? 68 :
    totalScore >= 6 ? 58 :
    totalScore >= 5 ? 52 :
    44;

  if (trend === 'NEUTRAL') conf -= 10;
  if (isTrendAligned) conf += 4;

  // Tradability boosts/penalties
  if (spreadPct <= 3) conf += 3;
  else if (spreadPct >= 8) conf -= 6;

  if (oi >= 1500 || volume >= 500) conf += 3;
  else if (oi < 500 && volume < 200) conf -= 6;

  conf = Math.max(5, Math.min(95, Math.round(conf)));
  const bucket = conf >= 75 ? 'HIGH' : conf >= 60 ? 'MED' : 'LOW';
  return { confidence: conf, bucket, calibrationVersion: 'v1.0-conservative' as const };
}

function generateSuggestions(
  calls: OptionContract[],
  puts: OptionContract[],
  trend: 'BULLISH' | 'BEARISH' | 'NEUTRAL',
  rsi: number,
  ivAnalysis: IVAnalysis,
  metrics: MarketMetrics,
  unusualActivity: UnusualActivity[],
): any[] {
  const suggestions: any[] = [];

// Liquidity / tradability gate (accuracy-first: reject illiquid, wide-spread contracts)
function liquidityOk(c: OptionContract): boolean {
  const spreadOk = Number(c.spreadPercent ?? 999) <= 12;
  const interestOk = (Number(c.openInterest ?? 0) >= 500) || (Number(c.volume ?? 0) >= 200);
  const priceOk = Number(c.mark ?? 0) >= 0.10 && Number(c.bid ?? 0) >= 0.05;
  return Boolean(spreadOk && interestOk && priceOk);
}

  const validCalls = calls.filter(c => c.dte >= 7 && c.dte <= 90 && liquidityOk(c));
  const validPuts = puts.filter(p => p.dte >= 7 && p.dte <= 90 && liquidityOk(p));

  const scoredCalls = validCalls.map(c => ({ contract: c, score: scoreOption(c, trend, ivAnalysis.atmIV) }));
  const scoredPuts = validPuts.map(p => ({ contract: p, score: scoreOption(p, trend, ivAnalysis.atmIV) }));

  scoredCalls.sort((a, b) => b.score.total - a.score.total);
  scoredPuts.sort((a, b) => b.score.total - a.score.total);

  const emPct = expectedMovePct(ivAnalysis.atmIV, 30);

  // Best call
  if (scoredCalls.length > 0 && trend !== 'BEARISH') {
    const best = scoredCalls[0];
    const c = best.contract;
    const s = best.score;
    
    suggestions.push({
      type: 'CALL',
      strategy: trend === 'BULLISH' ? 'Long Call (Trend Aligned)' : 'Long Call (Speculative)',
      contract: c,
      score: s.total, // Send total score as number, not object
      maxScore: 12,
      reasoning: [
        `Delta: ${c.delta.toFixed(2)} (${Math.round(Math.abs(c.delta) * 100)}% prob ITM)`,
        `IV: ${(c.iv * 100).toFixed(0)}%`,
        `DTE: ${c.dte} days | Spread: ${c.spreadPercent.toFixed(1)}%`,
        `Score: ${s.total}/12`,
      ],
      warnings: s.total < 6 ? ['Lower confidence - manage size'] : [],
      confidence: calibratedOptionConfidence(s.total, trend, (trend === 'BULLISH'), c.spreadPercent, c.openInterest, c.volume).confidence,
      riskLevel: s.total >= 8 ? 'LOW' : s.total >= 5 ? 'MEDIUM' : 'HIGH',
    });
  }

  // Best put
  if (scoredPuts.length > 0) {
    const best = scoredPuts[0];
    const p = best.contract;
    const s = best.score;
    
    suggestions.push({
      type: 'PUT',
      strategy: trend === 'BEARISH' ? 'Long Put (Trend Aligned)' : 'Protective Put (Hedge)',
      contract: p,
      score: s.total, // Send total score as number, not object
      maxScore: 12,
      reasoning: [
        `Delta: ${p.delta.toFixed(2)} (${Math.round(Math.abs(p.delta) * 100)}% prob ITM)`,
        `IV: ${(p.iv * 100).toFixed(0)}%`,
        `DTE: ${p.dte} days | Spread: ${p.spreadPercent.toFixed(1)}%`,
        `Score: ${s.total}/12`,
      ],
      warnings: trend !== 'BEARISH' ? ['Counter-trend - use as hedge'] : [],
      confidence: calibratedOptionConfidence(s.total, trend, (trend === 'BEARISH'), p.spreadPercent, p.openInterest, p.volume).confidence,
      riskLevel: s.total >= 8 ? 'LOW' : s.total >= 5 ? 'MEDIUM' : 'HIGH',
    });
  }

  // Unusual activity alert
  if (unusualActivity.length > 0) {
    const topUnusual = unusualActivity[0];
    suggestions.push({
      type: 'ALERT',
      strategy: `🔥 Unusual Activity: ${topUnusual.contract.type.toUpperCase()} $${topUnusual.contract.strike}`,
      contract: topUnusual.contract,
      reasoning: topUnusual.signals,
      warnings: [],
      confidence: topUnusual.score,
      riskLevel: 'WARNING',
      sentiment: topUnusual.sentiment,
    });
  }

  // IV alerts
  if (ivAnalysis.ivSignal === 'HIGH') {
    suggestions.push({
      type: 'ALERT',
      strategy: `⚠️ High IV Environment (${ivAnalysis.atmIV.toFixed(0)}%)`,
      reasoning: ['Options are expensive', 'Consider selling premium or spreads'],
      warnings: [],
      confidence: 0,
      riskLevel: 'WARNING',
    });
  } else if (ivAnalysis.ivSignal === 'LOW') {
    suggestions.push({
      type: 'ALERT',
      strategy: `💡 Low IV Environment (${ivAnalysis.atmIV.toFixed(0)}%)`,
      reasoning: ['Options are cheap', 'Good time to buy premium'],
      warnings: [],
      confidence: 0,
      riskLevel: 'WARNING',
    });
  }

  // RSI alert
  if (rsi > 70 || rsi < 30) {
    suggestions.push({
      type: 'ALERT',
      strategy: rsi > 70 ? `⚠️ RSI Overbought (${rsi.toFixed(0)})` : `⚠️ RSI Oversold (${rsi.toFixed(0)})`,
      reasoning: [rsi > 70 ? 'Stock may be extended' : 'Stock may bounce'],
      warnings: [],
      confidence: 0,
      riskLevel: 'WARNING',
    });
  }

  
  const tradable = suggestions.filter(s => s.type === 'CALL' || s.type === 'PUT');
  if (tradable.length === 0) {
    const reasons: string[] = [];
    reasons.push('No contracts passed liquidity/spread gates (spread% ≤ 12, OI ≥ 500 or volume ≥ 200, mark ≥ 0.10).');
    if (trend === 'NEUTRAL') reasons.push('Underlying trend is NEUTRAL; skipping directional options suggestions for accuracy.');
    reasons.push(`Expected move (30D, IV-based): ~${emPct}%`);
    return [{
      type: 'NO_TRADE',
      strategy: 'NO_TRADE',
      confidence: 0,
      riskLevel: 'N/A',
      reasoning: reasons,
      warnings: [],
    }];
  }

  return suggestions;

}

// ============================================================
// ============================================================
// GAMMA EXPOSURE (GEX)
// ============================================================
function calculateGEX(allContracts: OptionContract[], spotPrice: number): {
  netGEX: number;
  byStrike: { strike: number; callGEX: number; putGEX: number; netGEX: number }[];
  gexWalls: { strike: number; level: number; type: 'CALL_WALL' | 'PUT_WALL' }[];
  flipPoint: number | null;
  regime: 'POSITIVE' | 'NEGATIVE';
} {
  // Group by strike
  const strikeMap = new Map<number, { callGEX: number; putGEX: number }>();

  for (const c of allContracts) {
    if (!c.gamma || !c.openInterest) continue;
    const gex = c.gamma * c.openInterest * 100 * spotPrice * spotPrice / 1e8; // Scale to readable numbers
    const entry = strikeMap.get(c.strike) || { callGEX: 0, putGEX: 0 };
    if (c.type === 'call') {
      entry.callGEX += gex;
    } else {
      entry.putGEX += gex;
    }
    strikeMap.set(c.strike, entry);
  }

  const byStrike = Array.from(strikeMap.entries())
    .map(([strike, { callGEX, putGEX }]) => ({
      strike,
      callGEX: Math.round(callGEX * 100) / 100,
      putGEX: Math.round(putGEX * 100) / 100,
      netGEX: Math.round((callGEX - putGEX) * 100) / 100,
    }))
    .sort((a, b) => a.strike - b.strike);

  const netGEX = Math.round(byStrike.reduce((sum, s) => sum + s.netGEX, 0) * 100) / 100;

  // GEX walls: top 3 by absolute netGEX
  const walls = [...byStrike]
    .sort((a, b) => Math.abs(b.netGEX) - Math.abs(a.netGEX))
    .slice(0, 3)
    .map(s => ({
      strike: s.strike,
      level: Math.abs(s.netGEX),
      type: (s.netGEX > 0 ? 'CALL_WALL' : 'PUT_WALL') as 'CALL_WALL' | 'PUT_WALL',
    }));

  // Flip point: strike where cumulative GEX crosses zero (sorted by strike)
  let cumGEX = 0;
  let flipPoint: number | null = null;
  for (const s of byStrike) {
    const prevSign = Math.sign(cumGEX);
    cumGEX += s.netGEX;
    if (prevSign !== 0 && Math.sign(cumGEX) !== prevSign) {
      flipPoint = s.strike;
      break;
    }
  }

  return {
    netGEX,
    byStrike,
    gexWalls: walls,
    flipPoint,
    regime: netGEX >= 0 ? 'POSITIVE' : 'NEGATIVE',
  };
}

// ============================================================
// IV TERM STRUCTURE
// ============================================================
function calculateIVTermStructure(
  byExpiration: Record<string, { calls: OptionContract[]; puts: OptionContract[] }>,
  spotPrice: number
): {
  term: { expiration: string; dte: number; atmIV: number }[];
  shape: 'BACKWARDATION' | 'CONTANGO' | 'FLAT' | 'HUMPED';
  nearTermIV: number;
  longerTermIV: number;
  ivSpread: number;
} {
  const term: { expiration: string; dte: number; atmIV: number }[] = [];

  for (const [expiration, { calls, puts }] of Object.entries(byExpiration)) {
    const atmWindow = spotPrice * 0.02; // 2% from spot
    const nearContracts = [...calls, ...puts].filter(c =>
      Math.abs(c.strike - spotPrice) <= atmWindow && c.iv > 0
    );
    if (nearContracts.length === 0) continue;
    const avgIV = nearContracts.reduce((sum, c) => sum + c.iv * 100, 0) / nearContracts.length;
    const dte = nearContracts[0]?.dte || 0;
    term.push({ expiration, dte, atmIV: Math.round(avgIV * 10) / 10 });
  }

  term.sort((a, b) => a.dte - b.dte);

  if (term.length < 2) {
    return { term, shape: 'FLAT', nearTermIV: term[0]?.atmIV || 0, longerTermIV: term[0]?.atmIV || 0, ivSpread: 0 };
  }

  const nearTermIV = term[0].atmIV;
  const longerTermIV = term[term.length - 1].atmIV;
  const ivSpread = Math.round((nearTermIV - longerTermIV) * 10) / 10;

  let shape: 'BACKWARDATION' | 'CONTANGO' | 'FLAT' | 'HUMPED';
  if (Math.abs(ivSpread) < 2) {
    shape = 'FLAT';
  } else if (ivSpread > 0) {
    shape = 'BACKWARDATION'; // Near > Far
  } else {
    // Check for hump (middle > both ends)
    const midIV = term[Math.floor(term.length / 2)]?.atmIV || 0;
    shape = midIV > nearTermIV && midIV > longerTermIV ? 'HUMPED' : 'CONTANGO';
  }

  return { term, shape, nearTermIV, longerTermIV, ivSpread };
}

// ============================================================
// EARNINGS IMPLIED MOVE
// ============================================================
function calculateEarningsImpliedMove(
  byExpiration: Record<string, { calls: OptionContract[]; puts: OptionContract[] }>,
  spotPrice: number
): {
  impliedMovePercent: number;
  impliedMoveDollar: number;
  upperTarget: number;
  lowerTarget: number;
  straddle: { strike: number; callAsk: number; putAsk: number; total: number };
  nearestExpiration: string;
} | null {
  const expirations = Object.keys(byExpiration).sort();
  if (expirations.length === 0) return null;

  // Use nearest expiration unless < 3 DTE, then use next one
  let targetExp = expirations[0];
  const firstDTE = byExpiration[expirations[0]]?.calls[0]?.dte || 0;
  if (firstDTE < 3 && expirations.length > 1) {
    targetExp = expirations[1];
  }

  const { calls, puts } = byExpiration[targetExp] || { calls: [], puts: [] };
  if (calls.length === 0 || puts.length === 0) return null;

  // Find ATM strike (nearest to spot)
  const allStrikes = [...new Set([...calls.map(c => c.strike), ...puts.map(p => p.strike)])].sort(
    (a, b) => Math.abs(a - spotPrice) - Math.abs(b - spotPrice)
  );
  const atmStrike = allStrikes[0];
  if (!atmStrike) return null;

  const atmCall = calls.find(c => c.strike === atmStrike);
  const atmPut = puts.find(p => p.strike === atmStrike);
  if (!atmCall || !atmPut) return null;

  const callAsk = atmCall.ask || atmCall.mark || 0;
  const putAsk = atmPut.ask || atmPut.mark || 0;
  const straddleTotal = callAsk + putAsk;

  const impliedMovePercent = spotPrice > 0 ? Math.round((straddleTotal / spotPrice) * 10000) / 100 : 0;
  const impliedMoveDollar = Math.round(straddleTotal * 100) / 100;

  return {
    impliedMovePercent,
    impliedMoveDollar,
    upperTarget: Math.round((spotPrice * (1 + impliedMovePercent / 100)) * 100) / 100,
    lowerTarget: Math.round((spotPrice * (1 - impliedMovePercent / 100)) * 100) / 100,
    straddle: {
      strike: atmStrike,
      callAsk: Math.round(callAsk * 100) / 100,
      putAsk: Math.round(putAsk * 100) / 100,
      total: straddleTotal,
    },
    nearestExpiration: targetExp,
  };
}

// ============================================================
// HISTORICAL VOLATILITY (HV20)
// ============================================================
function calculateHV20(priceHistory: { close: number }[]): number {
  if (priceHistory.length < 22) return 0;
  const closes = priceHistory.map(c => c.close);
  const logReturns: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    if (closes[i - 1] > 0) logReturns.push(Math.log(closes[i] / closes[i - 1]));
  }
  const slice = logReturns.slice(-20);
  const mean = slice.reduce((a, b) => a + b, 0) / slice.length;
  const variance = slice.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / (slice.length - 1);
  const hv20 = Math.sqrt(variance) * Math.sqrt(252) * 100;
  return Math.round(hv20 * 10) / 10;
}

// ============================================================
// MAIN API HANDLER
// ============================================================
export async function GET(request: NextRequest, { params }: { params: { ticker: string } }) {
  const ticker = params.ticker.toUpperCase();
  if (!/^[A-Z0-9.\-]{1,10}$/.test(ticker)) {
    return NextResponse.json({ error: 'Invalid ticker symbol', ticker }, { status: 400 });
  }
  const startTime = Date.now();

  const { token, error: tokenError, status: errorCode } = await getSchwabAccessToken('options');

  if (!token) {
    return NextResponse.json({
      error: 'Schwab authentication failed',
      details: tokenError,
      errorCode,
      ticker,
      instructions: errorCode === 401
        ? ['Schwab refresh token has expired (7-day limit)', 'Generate a new refresh token']
        : ['Set SCHWAB_APP_KEY, SCHWAB_APP_SECRET, SCHWAB_REFRESH_TOKEN'],
      lastUpdated: new Date().toISOString(),
      dataSource: 'none',
    });
  }

  const { data: chainData, error: chainError } = await fetchOptionsChain(token, ticker);
  
  if (!chainData || chainError) {
    const is401 = typeof chainError === 'string' && chainError.includes('(401)');
    return NextResponse.json({
      error: 'Failed to fetch options chain',
      details: chainError,
      ticker,
      instructions: is401
        ? [
            'In Vercel, confirm SCHWAB_APP_KEY / SCHWAB_APP_SECRET / SCHWAB_REFRESH_TOKEN are set in the SAME environment you are deploying (Production vs Preview).',
            'Confirm the refresh token was generated for the same Schwab app (app key/secret) you have configured.',
            'If Schwab returned a NEW refresh token during a prior refresh, update SCHWAB_REFRESH_TOKEN and redeploy.',
            'After updating env vars, trigger a fresh Production deployment (do not rely on an existing build cache).',
          ]
        : undefined,
      envFlags: {
        hasAppKey: Boolean(process.env.SCHWAB_APP_KEY?.trim()),
        hasAppSecret: Boolean(process.env.SCHWAB_APP_SECRET?.trim()),
        hasRefreshToken: Boolean(process.env.SCHWAB_REFRESH_TOKEN?.trim()),
      },
      lastUpdated: new Date().toISOString(),
      dataSource: 'none',
    });
  }

  const currentPrice = chainData.underlyingPrice || 0;
  
  if (currentPrice === 0) {
    return NextResponse.json({ error: 'Invalid underlying price', ticker });
  }

  const { calls, puts, expirations, byExpiration } = parseOptionsChain(chainData, currentPrice);
  const priceHistory = await fetchPriceHistory(token, ticker);
  const closes = priceHistory.map(c => c.close);

  const rsi = closes.length > 14 ? calculateRSI(closes) : 50;
  const sma20 = closes.length > 20 ? calculateSMA(closes, 20) : currentPrice;
  const sma50 = closes.length > 50 ? calculateSMA(closes, 50) : currentPrice * 0.95;
  const support = closes.length > 0 ? Math.min(...closes.slice(-20)) : currentPrice * 0.95;
  const resistance = closes.length > 0 ? Math.max(...closes.slice(-20)) : currentPrice * 1.05;

  // New computations
  const allContracts = [...calls, ...puts];
  const gex = calculateGEX(allContracts, currentPrice);
  const ivTermStructure = calculateIVTermStructure(byExpiration, currentPrice);
  const earningsImpliedMove = calculateEarningsImpliedMove(byExpiration, currentPrice);
  const hv20 = calculateHV20(priceHistory);
  
  let trend: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';
  if (currentPrice > sma20 && currentPrice > sma50) trend = 'BULLISH';
  else if (currentPrice < sma20 && currentPrice < sma50) trend = 'BEARISH';
  
  // Convert trend for unusual activity detection
  const stockTrend: 'UP' | 'DOWN' | 'SIDEWAYS' = trend === 'BULLISH' ? 'UP' : trend === 'BEARISH' ? 'DOWN' : 'SIDEWAYS';

  const ivAnalysis = analyzeIV(calls, puts, currentPrice);
  const marketMetrics = calculateMarketMetrics(calls, puts, currentPrice);
  const unusualActivity = detectUnusualActivity(calls, puts, currentPrice, stockTrend, false);
  const suggestions = generateSuggestions(calls, puts, trend, rsi, ivAnalysis, marketMetrics, unusualActivity);
  const tradable = suggestions.filter((s: any) => s.type === 'CALL' || s.type === 'PUT');
  const tradeDecision = tradable.length === 0 || suggestions[0]?.type === 'NO_TRADE'
    ? { action: 'NO_TRADE', confidence: 0, rationale: suggestions[0]?.reasoning || ['No trade'] }
    : { action: 'OPTIONS_TRADE', confidence: Math.max(0, Math.min(95, Math.round(tradable[0]?.confidence || 0))), rationale: tradable[0]?.reasoning || [] };


  const firstExp = expirations[0] || '';

  return NextResponse.json({
    ticker,
    currentPrice: Math.round(currentPrice * 100) / 100,
    lastUpdated: new Date().toISOString(),
    dataSource: 'schwab-live',
    responseTimeMs: Date.now() - startTime,
    meta: { asOf: new Date().toISOString(), calibrationVersion: 'v1.0-conservative', tradeDecision },
    expirations,
    selectedExpiration: firstExp,
    byExpiration,
    gex,
    ivTermStructure,
    earningsImpliedMove,
    historicalVolatility: { hv20, ivVsHV: ivAnalysis.atmIV > 0 && hv20 > 0 ? Math.round((ivAnalysis.atmIV / hv20) * 100) / 100 : null },
    technicals: {
      trend,
      rsi: Math.round(rsi),
      sma20: Math.round(sma20 * 100) / 100,
      sma50: Math.round(sma50 * 100) / 100,
      support: Math.round(support * 100) / 100,
      resistance: Math.round(resistance * 100) / 100,
    },
    ivAnalysis,
    metrics: {
      putCallRatio: marketMetrics.putCallRatio,
      putCallOIRatio: marketMetrics.putCallOIRatio,
      totalCallVolume: marketMetrics.totalCallVolume,
      totalPutVolume: marketMetrics.totalPutVolume,
      totalCallOI: marketMetrics.totalCallOI,
      totalPutOI: marketMetrics.totalPutOI,
      sentiment: marketMetrics.sentiment,
      maxPain: marketMetrics.maxPain,
      avgIV: ivAnalysis.atmIV,
      ivRank: ivAnalysis.ivRank,
    },
    unusualActivity: unusualActivity.map(u => ({
      strike: u.contract.strike,
      type: u.contract.type,
      expiration: u.contract.expiration,
      dte: u.contract.dte,
      volume: u.contract.volume,
      openInterest: u.contract.openInterest,
      volumeOIRatio: u.contract.volumeOIRatio,
      delta: u.contract.delta,
      iv: u.contract.iv,
      bid: u.contract.bid,
      ask: u.contract.ask,
      mark: u.contract.mark,
      premium: Math.round(u.premiumValue),
      premiumFormatted: u.premiumValue >= 1000000 
        ? `$${(u.premiumValue / 1e6).toFixed(2)}M` 
        : `$${(u.premiumValue / 1e3).toFixed(0)}K`,
      signals: u.signals,
      score: u.score,
      sentiment: u.sentiment,
      convictionLevel: u.convictionLevel,
      interpretation: u.interpretation,
      // NEW: Hedge vs Directional classification
      tradeType: u.tradeType,
      tradeTypeReason: u.tradeTypeReason,
      insiderProbability: u.insiderProbability,
      insiderSignals: u.insiderSignals,
      // Full contract for tracking
      contract: {
        strike: u.contract.strike,
        type: u.contract.type,
        expiration: u.contract.expiration,
        dte: u.contract.dte,
        delta: u.contract.delta,
        volume: u.contract.volume,
        openInterest: u.contract.openInterest,
        volumeOIRatio: u.contract.volumeOIRatio,
        bid: u.contract.bid,
        ask: u.contract.ask,
        mark: u.contract.mark,
      },
    })),
    suggestions,
    optionsChain: {
      calls: byExpiration[firstExp]?.calls || [],
      puts: byExpiration[firstExp]?.puts || [],
    },
    allCalls: calls,
    allPuts: puts,
  });
}