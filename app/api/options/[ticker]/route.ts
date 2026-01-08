import { NextRequest, NextResponse } from 'next/server';

// ============================================================
// LIVE OPTIONS API - SCHWAB MARKET DATA
// Deterministic scoring, no randomness
// ============================================================

const FINNHUB_KEY = process.env.FINNHUB_API_KEY;
const SCHWAB_APP_KEY = process.env.SCHWAB_APP_KEY;
const SCHWAB_APP_SECRET = process.env.SCHWAB_APP_SECRET;
const SCHWAB_REFRESH_TOKEN = process.env.SCHWAB_REFRESH_TOKEN;

// ============================================================
// SCHWAB AUTH
// ============================================================
async function getSchwabToken(): Promise<{ token: string | null; error: string | null }> {
  if (!SCHWAB_APP_KEY || !SCHWAB_APP_SECRET || !SCHWAB_REFRESH_TOKEN) {
    return { token: null, error: 'Missing Schwab credentials' };
  }
  
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
      const text = await response.text();
      return { token: null, error: `Auth failed (${response.status}): Token may be expired` };
    }
    const data = await response.json();
    return { token: data.access_token, error: null };
  } catch (err) {
    return { token: null, error: `Auth error: ${err}` };
  }
}

// ============================================================
// FETCH SCHWAB OPTIONS CHAIN
// ============================================================
async function fetchOptionsChain(token: string, symbol: string) {
  const url = `https://api.schwabapi.com/marketdata/v1/chains?symbol=${symbol}&contractType=ALL&strikeCount=30&includeUnderlyingQuote=true`;
  
  try {
    const res = await fetch(url, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    
    if (!res.ok) {
      const text = await res.text();
      return { data: null, error: `Chain fetch failed (${res.status})` };
    }
    
    return { data: await res.json(), error: null };
  } catch (err) {
    return { data: null, error: `Chain error: ${err}` };
  }
}

// ============================================================
// FETCH PRICE HISTORY FOR TECHNICALS
// ============================================================
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
// PARSE OPTIONS CHAIN INTO STRUCTURED FORMAT
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
  iv: number;
  itm: boolean;
  intrinsicValue: number;
  extrinsicValue: number;
}

function parseOptionsChain(chainData: any, currentPrice: number): {
  calls: OptionContract[];
  puts: OptionContract[];
  expirations: string[];
} {
  const calls: OptionContract[] = [];
  const puts: OptionContract[] = [];
  const expirationSet = new Set<string>();

  const parseMap = (expDateMap: any, type: 'call' | 'put') => {
    if (!expDateMap) return;
    
    for (const [expKey, strikes] of Object.entries(expDateMap)) {
      const expDate = expKey.split(':')[0];
      expirationSet.add(expDate);
      
      for (const [strikeStr, contracts] of Object.entries(strikes as any)) {
        const contractArr = contracts as any[];
        if (!contractArr || contractArr.length === 0) continue;
        
        const c = contractArr[0];
        const strike = parseFloat(strikeStr);
        
        // Only include strikes within 20% of current price
        if (Math.abs(strike - currentPrice) / currentPrice > 0.20) continue;
        
        const bid = c.bid || 0;
        const ask = c.ask || 0;
        const mark = (bid + ask) / 2;
        const itm = type === 'call' ? strike < currentPrice : strike > currentPrice;
        const intrinsic = type === 'call' 
          ? Math.max(0, currentPrice - strike)
          : Math.max(0, strike - currentPrice);
        
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
          volume: c.totalVolume || 0,
          openInterest: c.openInterest || 0,
          delta: c.delta || 0,
          gamma: c.gamma || 0,
          theta: c.theta || 0,
          vega: c.vega || 0,
          iv: (c.volatility || 0) / 100, // Schwab returns as percentage
          itm,
          intrinsicValue: intrinsic,
          extrinsicValue: Math.max(0, mark - intrinsic),
        };
        
        if (type === 'call') calls.push(contract);
        else puts.push(contract);
      }
    }
  };

  parseMap(chainData.callExpDateMap, 'call');
  parseMap(chainData.putExpDateMap, 'put');

  // Sort by strike, then by DTE
  const sortFn = (a: OptionContract, b: OptionContract) => a.strike - b.strike || a.dte - b.dte;
  
  return {
    calls: calls.sort(sortFn),
    puts: puts.sort(sortFn),
    expirations: Array.from(expirationSet).sort(),
  };
}

// ============================================================
// CALCULATE TECHNICAL INDICATORS
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
// DETERMINISTIC OPTIONS SCORING (0-10 scale)
// ============================================================
interface OptionScore {
  total: number;
  delta: number;      // 0-2: Is delta in optimal range?
  iv: number;         // 0-2: Is IV favorable?
  liquidity: number;  // 0-2: Good bid-ask spread and volume?
  timing: number;     // 0-2: Is DTE in sweet spot?
  technical: number;  // 0-2: Does trend support this trade?
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

  const absDelta = Math.abs(option.delta);
  
  // Delta score: Best is 0.40-0.60 for directional plays
  if (absDelta >= 0.40 && absDelta <= 0.60) deltaScore = 2;
  else if (absDelta >= 0.30 && absDelta <= 0.70) deltaScore = 1;
  else deltaScore = 0;

  // IV score: Compare to average IV
  const ivRatio = option.iv / (avgIV || 0.30);
  if (ivRatio < 0.9) ivScore = 2;  // IV below average = cheap options
  else if (ivRatio < 1.1) ivScore = 1;  // Near average
  else ivScore = 0;  // High IV = expensive

  // Liquidity score: Bid-ask spread and volume
  const spread = option.ask - option.bid;
  const spreadPct = option.mark > 0 ? spread / option.mark : 1;
  if (spreadPct < 0.05 && option.volume > 100) liquidityScore = 2;
  else if (spreadPct < 0.10 && option.volume > 50) liquidityScore = 1;
  else liquidityScore = 0;

  // Timing score: DTE sweet spot is 21-45 days
  if (option.dte >= 21 && option.dte <= 45) timingScore = 2;
  else if (option.dte >= 14 && option.dte <= 60) timingScore = 1;
  else timingScore = 0;

  // Technical alignment score
  if (option.type === 'call' && trend === 'BULLISH') technicalScore = 2;
  else if (option.type === 'put' && trend === 'BEARISH') technicalScore = 2;
  else if (trend === 'NEUTRAL') technicalScore = 1;
  else technicalScore = 0;

  return {
    total: deltaScore + ivScore + liquidityScore + timingScore + technicalScore,
    delta: deltaScore,
    iv: ivScore,
    liquidity: liquidityScore,
    timing: timingScore,
    technical: technicalScore,
  };
}

// ============================================================
// GENERATE TRADE SUGGESTIONS
// ============================================================
interface TradeSuggestion {
  type: 'CALL' | 'PUT' | 'ALERT';
  strategy: string;
  contract?: OptionContract;
  score?: OptionScore;
  reasoning: string[];
  warnings: string[];
  confidence: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'WARNING';
}

function generateSuggestions(
  calls: OptionContract[],
  puts: OptionContract[],
  trend: 'BULLISH' | 'BEARISH' | 'NEUTRAL',
  rsi: number,
  avgIV: number,
  currentPrice: number,
): TradeSuggestion[] {
  const suggestions: TradeSuggestion[] = [];

  // Filter to options with good DTE (14-60 days)
  const validCalls = calls.filter(c => c.dte >= 14 && c.dte <= 60 && c.bid > 0);
  const validPuts = puts.filter(p => p.dte >= 14 && p.dte <= 60 && p.bid > 0);

  // Score all valid options
  const scoredCalls = validCalls.map(c => ({ contract: c, score: scoreOption(c, trend, avgIV) }));
  const scoredPuts = validPuts.map(p => ({ contract: p, score: scoreOption(p, trend, avgIV) }));

  // Sort by score descending
  scoredCalls.sort((a, b) => b.score.total - a.score.total);
  scoredPuts.sort((a, b) => b.score.total - a.score.total);

  // Best call suggestion (if bullish or neutral)
  if (scoredCalls.length > 0 && (trend === 'BULLISH' || trend === 'NEUTRAL')) {
    const best = scoredCalls[0];
    const c = best.contract;
    const s = best.score;
    
    suggestions.push({
      type: 'CALL',
      strategy: trend === 'BULLISH' ? 'Long Call (Trend Aligned)' : 'Long Call (Speculative)',
      contract: c,
      score: s,
      reasoning: [
        `Delta: ${c.delta.toFixed(2)} (${Math.round(Math.abs(c.delta) * 100)}% ITM probability)`,
        `IV: ${(c.iv * 100).toFixed(0)}% ${c.iv < avgIV ? '(below avg - cheap)' : '(elevated)'}`,
        `DTE: ${c.dte} days ${c.dte >= 21 && c.dte <= 45 ? '(optimal)' : ''}`,
        `Trend: ${trend} | RSI: ${rsi.toFixed(0)}`,
        `Score: ${s.total}/10`,
      ],
      warnings: s.total < 6 ? ['Lower confidence setup - manage risk'] : [],
      confidence: s.total * 10,
      riskLevel: s.total >= 7 ? 'LOW' : s.total >= 5 ? 'MEDIUM' : 'HIGH',
    });
  }

  // Best put suggestion (if bearish or as hedge)
  if (scoredPuts.length > 0) {
    const best = scoredPuts[0];
    const p = best.contract;
    const s = best.score;
    
    const strategy = trend === 'BEARISH' ? 'Long Put (Trend Aligned)' : 'Protective Put (Hedge)';
    
    suggestions.push({
      type: 'PUT',
      strategy,
      contract: p,
      score: s,
      reasoning: [
        `Delta: ${p.delta.toFixed(2)} (${Math.round(Math.abs(p.delta) * 100)}% ITM probability)`,
        `IV: ${(p.iv * 100).toFixed(0)}% ${p.iv < avgIV ? '(below avg)' : '(elevated)'}`,
        `DTE: ${p.dte} days`,
        `Trend: ${trend} | RSI: ${rsi.toFixed(0)}`,
        `Score: ${s.total}/10`,
      ],
      warnings: trend !== 'BEARISH' ? ['Counter-trend trade - use as hedge only'] : [],
      confidence: s.total * 10,
      riskLevel: s.total >= 7 ? 'LOW' : s.total >= 5 ? 'MEDIUM' : 'HIGH',
    });
  }

  // High IV warning
  if (avgIV > 0.40) {
    suggestions.push({
      type: 'ALERT',
      strategy: `High IV Environment (${(avgIV * 100).toFixed(0)}%)`,
      reasoning: [
        'Options are expensive relative to typical levels',
        'Consider selling premium instead of buying',
        'Or use spreads to reduce vega exposure',
      ],
      warnings: [],
      confidence: 0,
      riskLevel: 'WARNING',
    });
  }

  // RSI extreme warning
  if (rsi > 70 || rsi < 30) {
    suggestions.push({
      type: 'ALERT',
      strategy: rsi > 70 ? 'RSI Overbought Warning' : 'RSI Oversold Warning',
      reasoning: [
        `RSI: ${rsi.toFixed(0)} - ${rsi > 70 ? 'overbought' : 'oversold'}`,
        rsi > 70 ? 'Be cautious with calls - potential pullback' : 'Be cautious with puts - potential bounce',
        'Consider waiting for RSI to normalize',
      ],
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

  // Get Schwab token
  const { token, error: tokenError } = await getSchwabToken();
  
  if (!token) {
    return NextResponse.json({
      error: 'Schwab authentication failed',
      details: tokenError,
      ticker,
      instructions: [
        'Set SCHWAB_APP_KEY in Vercel environment variables',
        'Set SCHWAB_APP_SECRET in Vercel environment variables', 
        'Set SCHWAB_REFRESH_TOKEN in Vercel environment variables',
        'Note: Refresh tokens expire every 7 days',
      ],
      lastUpdated: new Date().toISOString(),
      dataSource: 'none',
    });
  }

  // Fetch options chain
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
    return NextResponse.json({
      error: 'Invalid underlying price',
      ticker,
      lastUpdated: new Date().toISOString(),
      dataSource: 'none',
    });
  }

  // Parse options chain
  const { calls, puts, expirations } = parseOptionsChain(chainData, currentPrice);

  // Fetch price history for technicals
  const priceHistory = await fetchPriceHistory(token, ticker);
  
  // Calculate technicals
  const rsi = priceHistory.length > 14 ? calculateRSI(priceHistory) : 50;
  const sma20 = priceHistory.length > 20 ? calculateSMA(priceHistory, 20) : currentPrice;
  const sma50 = priceHistory.length > 50 ? calculateSMA(priceHistory, 50) : currentPrice * 0.95;
  
  // Determine trend
  let trend: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';
  if (currentPrice > sma20 && currentPrice > sma50) trend = 'BULLISH';
  else if (currentPrice < sma20 && currentPrice < sma50) trend = 'BEARISH';

  // Calculate average IV
  const allIVs = [...calls, ...puts].filter(o => o.iv > 0).map(o => o.iv);
  const avgIV = allIVs.length > 0 ? allIVs.reduce((a, b) => a + b, 0) / allIVs.length : 0.30;

  // Calculate IV rank (simplified - would need historical IV for accuracy)
  const ivRank = Math.min(100, Math.max(0, ((avgIV - 0.15) / 0.45) * 100));

  // Calculate put/call ratio
  const totalCallVol = calls.reduce((sum, c) => sum + c.volume, 0);
  const totalPutVol = puts.reduce((sum, p) => sum + p.volume, 0);
  const putCallRatio = totalCallVol > 0 ? totalPutVol / totalCallVol : 1;

  // Generate suggestions
  const suggestions = generateSuggestions(calls, puts, trend, rsi, avgIV, currentPrice);

  // Get nearest expiration data for display
  const nearestExp = expirations[0] || '';
  const callsNearExp = calls.filter(c => c.expiration === nearestExp);
  const putsNearExp = puts.filter(p => p.expiration === nearestExp);

  return NextResponse.json({
    ticker,
    currentPrice: Math.round(currentPrice * 100) / 100,
    lastUpdated: new Date().toISOString(),
    dataSource: 'schwab-live',
    responseTimeMs: Date.now() - startTime,

    // Expirations available
    expirations,
    selectedExpiration: nearestExp,

    // Technical context
    technicals: {
      trend,
      rsi: Math.round(rsi),
      sma20: Math.round(sma20 * 100) / 100,
      sma50: Math.round(sma50 * 100) / 100,
      support: Math.round(Math.min(...priceHistory.slice(-20)) * 100) / 100 || currentPrice * 0.95,
      resistance: Math.round(Math.max(...priceHistory.slice(-20)) * 100) / 100 || currentPrice * 1.05,
    },

    // IV Analysis
    ivAnalysis: {
      currentIV: Math.round(avgIV * 1000) / 10,
      ivRank: Math.round(ivRank),
      ivSignal: ivRank > 70 ? 'HIGH' : ivRank > 50 ? 'ELEVATED' : ivRank < 30 ? 'LOW' : 'NORMAL',
      recommendation: ivRank < 30 ? 'BUY_PREMIUM' : ivRank > 70 ? 'SELL_PREMIUM' : 'NEUTRAL',
    },

    // Metrics
    metrics: {
      putCallRatio: putCallRatio.toFixed(2),
      totalCallVolume: totalCallVol,
      totalPutVolume: totalPutVol,
      avgIV: (avgIV * 100).toFixed(1),
      ivRank: ivRank.toFixed(0),
    },

    // Trade suggestions with scores
    suggestions,

    // Full options chain for display
    optionsChain: {
      calls: callsNearExp.slice(0, 20),
      puts: putsNearExp.slice(0, 20),
    },

    // All expirations data
    allCalls: calls,
    allPuts: puts,
  });
}
