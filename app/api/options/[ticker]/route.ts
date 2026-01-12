import { NextRequest, NextResponse } from 'next/server';
import { getSchwabAccessToken } from '@/lib/schwab';

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
const SCHWAB_APP_KEY = process.env.SCHWAB_APP_KEY;
const SCHWAB_APP_SECRET = process.env.SCHWAB_APP_SECRET;
const SCHWAB_REFRESH_TOKEN = process.env.SCHWAB_REFRESH_TOKEN;

// ============================================================
// USE SHARED TOKEN HANDLER FROM LIB
// ============================================================
async function getSchwabToken(): Promise<{ token: string | null; error: string | null; errorCode: number | null }> {
  const result = await getSchwabAccessToken('options');
  return { 
    token: result.token, 
    error: result.error, 
    errorCode: result.status || null 
  };
}

// ============================================================
// FETCH SCHWAB DATA
// ============================================================
async function fetchOptionsChain(token: string, symbol: string): Promise<{ data: any; error: string | null }> {
  const url = `https://api.schwabapi.com/marketdata/v1/chains?symbol=${symbol}&contractType=ALL&strikeCount=50&includeUnderlyingQuote=true&range=ALL`;
  
  try {
    const res = await fetch(url, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    
    if (!res.ok) {
      const status = res.status;
      const errorText = await res.text().catch(() => 'No details');
      
      if (status === 401) {
        return { data: null, error: `Token rejected (401). Refresh token may be expired. Details: ${errorText}` };
      }
      
      if (status === 404) {
        return { data: null, error: `Symbol '${symbol}' not found or has no options` };
      }
      
      if (status === 429) {
        return { data: null, error: 'Rate limited - wait 60 seconds and try again' };
      }
      
      return { data: null, error: `Chain fetch failed (${status}): ${errorText}` };
    }
    
    return { data: await res.json(), error: null };
  } catch (err) {
    return { data: null, error: `Network error: ${err}` };
  }
}

async function fetchPriceHistory(token: string, symbol: string): Promise<number[]> {
  try {
    const res = await fetch(`https://api.schwabapi.com/marketdata/v1/pricehistory?symbol=${symbol}&periodType=month&period=2&frequencyType=daily&frequency=1`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.candles || []).map((c: any) => c.close);
  } catch { return []; }
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
    if (c.dte < 10 || c.dte > 180) return;
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
    } else if (premiumValue >= 100000) {
      signals.push(`💵 Premium: $${(premiumValue / 1e3).toFixed(0)}K`);
      unusualScore += 15;
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
      score: s,
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
      score: s,
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
// MAIN API HANDLER
// ============================================================
export async function GET(request: NextRequest, { params }: { params: { ticker: string } }) {
  const ticker = params.ticker.toUpperCase();
  const startTime = Date.now();

  const { token, error: tokenError, errorCode } = await getSchwabToken();
  
  if (!token) {
    console.error('[Options API] Schwab auth failed:', tokenError, 'Code:', errorCode);
    return NextResponse.json({
      error: 'Schwab authentication failed',
      details: tokenError,
      errorCode,
      ticker,
      instructions: errorCode === 401 
        ? [
            '🔴 Schwab refresh token is invalid or expired',
            '📋 Refresh tokens expire after 7 days of non-use',
            '🔗 Generate new token: https://developer.schwab.com/dashboard',
            '⚙️  Update SCHWAB_REFRESH_TOKEN in Vercel environment',
            '🔄 Redeploy (Vercel auto-deploys on env change)',
            '⏰ Wait 2 minutes after deploy, then try again'
          ]
        : [
            'Set SCHWAB_APP_KEY in environment variables', 
            'Set SCHWAB_APP_SECRET in environment variables',
            'Set SCHWAB_REFRESH_TOKEN in environment variables',
            'Check Schwab API status at https://developer.schwab.com'
          ],
      lastUpdated: new Date().toISOString(),
      dataSource: 'none',
    });
  }

  const { data: chainData, error: chainError } = await fetchOptionsChain(token, ticker);
  
  if (!chainData || chainError) {
    console.error('[Options API] Chain fetch failed:', chainError);
    return NextResponse.json({
      error: 'Failed to fetch options chain',
      details: chainError,
      ticker,
      instructions: [
        chainError?.includes('401') ? '🔴 Token rejected - refresh token may be invalid' : '',
        chainError?.includes('404') ? `❌ Ticker ${ticker} not found or has no options` : '',
        chainError?.includes('429') ? '⏳ Rate limited - wait 60 seconds' : '',
        chainError?.includes('Network') ? '🌐 Network error - check connection' : '',
        '🕐 Options only available 9:30 AM - 4:00 PM ET (regular market hours)',
        '✅ Try known liquid tickers: AAPL, TSLA, NVDA, SPY'
      ].filter(Boolean),
      lastUpdated: new Date().toISOString(),
      dataSource: 'none',
      marketHoursOnly: true,
    });
  }

  const currentPrice = chainData.underlyingPrice || 0;
  
  if (currentPrice === 0) {
    return NextResponse.json({ error: 'Invalid underlying price', ticker });
  }

  const { calls, puts, expirations, byExpiration } = parseOptionsChain(chainData, currentPrice);
  const priceHistory = await fetchPriceHistory(token, ticker);
  
  const rsi = priceHistory.length > 14 ? calculateRSI(priceHistory) : 50;
  const sma20 = priceHistory.length > 20 ? calculateSMA(priceHistory, 20) : currentPrice;
  const sma50 = priceHistory.length > 50 ? calculateSMA(priceHistory, 50) : currentPrice * 0.95;
  const support = priceHistory.length > 0 ? Math.min(...priceHistory.slice(-20)) : currentPrice * 0.95;
  const resistance = priceHistory.length > 0 ? Math.max(...priceHistory.slice(-20)) : currentPrice * 1.05;
  
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
  }, {
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
      'Pragma': 'no-cache',
      'Expires': '0',
    },
  });
}