import { NextRequest, NextResponse } from 'next/server';

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
// TOKEN CACHE - Schwab access tokens last 30 minutes
// Note: In serverless (Vercel), this cache is per-instance
// Each cold start gets a fresh instance, so we refresh often
// ============================================================
interface TokenCache {
  accessToken: string;
  expiresAt: number; // Unix timestamp
  createdAt: number;
}

let tokenCache: TokenCache | null = null;
let tokenRefreshAttempts = 0;
const MAX_REFRESH_ATTEMPTS = 3;

// ============================================================
// SCHWAB AUTH WITH ROBUST ERROR HANDLING
// ============================================================
async function getSchwabToken(forceRefresh = false): Promise<{ token: string | null; error: string | null; errorCode: number | null }> {
  if (!SCHWAB_APP_KEY || !SCHWAB_APP_SECRET || !SCHWAB_REFRESH_TOKEN) {
    return { token: null, error: 'Missing Schwab credentials in environment variables', errorCode: null };
  }
  
  const now = Date.now();
  
  // Use cached token if valid (with 5 minute buffer for safety)
  // But in serverless, be more conservative - only use cache if very fresh
  if (!forceRefresh && tokenCache && tokenCache.expiresAt > now + 300000) {
    // Additional check: don't use tokens older than 25 minutes even if "valid"
    const tokenAge = now - tokenCache.createdAt;
    if (tokenAge < 25 * 60 * 1000) {
      console.log('[Schwab] Using cached access token, age:', Math.round(tokenAge / 1000), 's');
      return { token: tokenCache.accessToken, error: null, errorCode: null };
    }
  }
  
  // Prevent infinite refresh loops
  if (tokenRefreshAttempts >= MAX_REFRESH_ATTEMPTS) {
    const error = 'Too many token refresh attempts. The refresh token may be invalid or Schwab API is having issues.';
    console.error('[Schwab]', error);
    // Reset after 5 minutes
    setTimeout(() => { tokenRefreshAttempts = 0; }, 5 * 60 * 1000);
    return { token: null, error, errorCode: 401 };
  }
  
  tokenRefreshAttempts++;
  console.log(`[Schwab] Requesting new access token (attempt ${tokenRefreshAttempts})`);
  
  try {
    const credentials = Buffer.from(`${SCHWAB_APP_KEY}:${SCHWAB_APP_SECRET}`).toString('base64');
    const response = await fetch('https://api.schwabapi.com/v1/oauth/token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: SCHWAB_REFRESH_TOKEN,
      }).toString(),
    });

    if (!response.ok) {
      const status = response.status;
      const errorBody = await response.text().catch(() => 'No body');
      console.error(`[Schwab] Auth failed: ${status} - ${errorBody}`);
      
      // Clear cache on auth failure
      tokenCache = null;
      
      if (status === 401) {
        return { 
          token: null, 
          error: `Refresh token rejected (401). This usually means: 1) Token expired (7-day limit), 2) Token was invalidated, or 3) Schwab API is rejecting requests. You may need to generate a new refresh token. Raw error: ${errorBody}`, 
          errorCode: 401 
        };
      } else if (status === 400) {
        return { token: null, error: `Bad request (400): ${errorBody}`, errorCode: 400 };
      } else if (status === 429) {
        return { token: null, error: 'Rate limited by Schwab - wait 60 seconds and try again', errorCode: 429 };
      } else if (status === 503 || status === 502) {
        return { token: null, error: `Schwab API temporarily unavailable (${status}) - try again in a few minutes`, errorCode: status };
      }
      return { token: null, error: `Auth failed (${status}): ${errorBody}`, errorCode: status };
    }
    
    const data = await response.json();
    
    // Reset attempt counter on success
    tokenRefreshAttempts = 0;
    
    // Cache the token
    const expiresIn = data.expires_in || 1800;
    tokenCache = {
      accessToken: data.access_token,
      expiresAt: now + (expiresIn * 1000),
      createdAt: now,
    };
    
    // Note: Schwab may return a new refresh_token - in production you'd want to store this
    if (data.refresh_token && data.refresh_token !== SCHWAB_REFRESH_TOKEN) {
      console.warn('[Schwab] ⚠️ API returned a NEW refresh token. In production, you should save this to maintain access.');
    }
    
    console.log(`[Schwab] Got new access token, expires in ${expiresIn}s`);
    return { token: data.access_token, error: null, errorCode: null };
  } catch (err) {
    console.error('[Schwab] Network error:', err);
    return { token: null, error: `Network error connecting to Schwab: ${err}`, errorCode: null };
  }
}

// ============================================================
// FETCH SCHWAB DATA WITH RETRY AND TOKEN REFRESH
// ============================================================
async function fetchOptionsChain(token: string, symbol: string, retryCount = 0): Promise<{ data: any; error: string | null }> {
  const url = `https://api.schwabapi.com/marketdata/v1/chains?symbol=${symbol}&contractType=ALL&strikeCount=50&includeUnderlyingQuote=true&range=ALL`;
  
  try {
    const res = await fetch(url, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    
    if (!res.ok) {
      const status = res.status;
      const errorText = await res.text().catch(() => 'No details');
      
      // If 401 on the data endpoint, the access token might be stale
      // Try getting a fresh token and retry ONCE
      if (status === 401 && retryCount === 0) {
        console.log('[Schwab] Got 401 on market data - forcing token refresh and retrying');
        tokenCache = null; // Clear cache to force refresh
        const { token: newToken, error: tokenError } = await getSchwabToken(true);
        
        if (newToken) {
          return fetchOptionsChain(newToken, symbol, retryCount + 1);
        } else {
          return { data: null, error: `Token refresh failed after 401: ${tokenError}` };
        }
      }
      
      if (status === 401) {
        return { 
          data: null, 
          error: `Token rejected by market data API (401) even after refresh. This suggests the refresh token itself is invalid. Details: ${errorText}` 
        };
      }
      
      if (status === 429 && retryCount < 2) {
        // Rate limited - wait and retry
        await new Promise(r => setTimeout(r, 2000));
        return fetchOptionsChain(token, symbol, retryCount + 1);
      }
      
      if (status === 404) {
        return { data: null, error: `Symbol '${symbol}' not found or has no options` };
      }
      
      return { data: null, error: `Chain fetch failed (${status}): ${errorText}` };
    }
    return { data: await res.json(), error: null };
  } catch (err) {
    if (retryCount < 2) {
      // Network error - retry once
      await new Promise(r => setTimeout(r, 1000));
      return fetchOptionsChain(token, symbol, retryCount + 1);
    }
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
}

function detectUnusualActivity(calls: OptionContract[], puts: OptionContract[], currentPrice: number): UnusualActivity[] {
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
    
    const interpretation = `${convictionLevel} conviction ${sentiment.toLowerCase()} bet targeting $${c.strike} within ${c.dte} days.`;
    
    unusual.push({
      contract: c,
      signals,
      score: unusualScore,
      sentiment,
      premiumValue,
      convictionLevel,
      interpretation,
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

  const validCalls = calls.filter(c => c.dte >= 7 && c.dte <= 90 && c.bid > 0.05);
  const validPuts = puts.filter(p => p.dte >= 7 && p.dte <= 90 && p.bid > 0.05);

  const scoredCalls = validCalls.map(c => ({ contract: c, score: scoreOption(c, trend, ivAnalysis.atmIV) }));
  const scoredPuts = validPuts.map(p => ({ contract: p, score: scoreOption(p, trend, ivAnalysis.atmIV) }));

  scoredCalls.sort((a, b) => b.score.total - a.score.total);
  scoredPuts.sort((a, b) => b.score.total - a.score.total);

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
      confidence: Math.round((s.total / 12) * 100),
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
      confidence: Math.round((s.total / 12) * 100),
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
    return NextResponse.json({
      error: 'Failed to fetch options chain',
      details: chainError,
      ticker,
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
  
  const rsi = priceHistory.length > 14 ? calculateRSI(priceHistory) : 50;
  const sma20 = priceHistory.length > 20 ? calculateSMA(priceHistory, 20) : currentPrice;
  const sma50 = priceHistory.length > 50 ? calculateSMA(priceHistory, 50) : currentPrice * 0.95;
  const support = priceHistory.length > 0 ? Math.min(...priceHistory.slice(-20)) : currentPrice * 0.95;
  const resistance = priceHistory.length > 0 ? Math.max(...priceHistory.slice(-20)) : currentPrice * 1.05;
  
  let trend: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';
  if (currentPrice > sma20 && currentPrice > sma50) trend = 'BULLISH';
  else if (currentPrice < sma20 && currentPrice < sma50) trend = 'BEARISH';

  const ivAnalysis = analyzeIV(calls, puts, currentPrice);
  const marketMetrics = calculateMarketMetrics(calls, puts, currentPrice);
  const unusualActivity = detectUnusualActivity(calls, puts, currentPrice);
  const suggestions = generateSuggestions(calls, puts, trend, rsi, ivAnalysis, marketMetrics, unusualActivity);

  const firstExp = expirations[0] || '';

  return NextResponse.json({
    ticker,
    currentPrice: Math.round(currentPrice * 100) / 100,
    lastUpdated: new Date().toISOString(),
    dataSource: 'schwab-live',
    responseTimeMs: Date.now() - startTime,
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
      premium: Math.round(u.premiumValue),
      premiumFormatted: u.premiumValue >= 1000000 
        ? `$${(u.premiumValue / 1e6).toFixed(2)}M` 
        : `$${(u.premiumValue / 1e3).toFixed(0)}K`,
      signals: u.signals,
      score: u.score,
      sentiment: u.sentiment,
      convictionLevel: u.convictionLevel,
      interpretation: u.interpretation,
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
