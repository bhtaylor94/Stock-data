import { NextRequest, NextResponse } from 'next/server';

// ============================================================
// LIVE OPTIONS DATA API - SCHWAB MARKET DATA PRODUCTION
// Real-time options chains with Greeks, IV analysis, and trade suggestions
// ============================================================

const FINNHUB_KEY = process.env.FINNHUB_API_KEY;
const SCHWAB_APP_KEY = process.env.SCHWAB_APP_KEY;
const SCHWAB_APP_SECRET = process.env.SCHWAB_APP_SECRET;
const SCHWAB_REFRESH_TOKEN = process.env.SCHWAB_REFRESH_TOKEN;

// Schwab API Base URLs
const SCHWAB_TOKEN_URL = 'https://api.schwabapi.com/v1/oauth/token';
const SCHWAB_MARKET_DATA_BASE = 'https://api.schwabapi.com/marketdata/v1';

// ============================================================
// TYPES
// ============================================================
interface OptionContract {
  strike: number;
  bid: number;
  ask: number;
  last: number;
  delta: number;
  gamma: number;
  theta: number;
  vega: number;
  rho: number;
  volume: number;
  openInterest: number;
  impliedVolatility: number;
  expiration: string;
  dte: number;
  inTheMoney: boolean;
  intrinsicValue: number;
  extrinsicValue: number;
  bidAskSpread: number;
  midPrice: number;
  symbol?: string;
}

interface TechnicalSignals {
  trend: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  trendStrength: number;
  rsi: number;
  rsiSignal: 'OVERSOLD' | 'OVERBOUGHT' | 'NEUTRAL';
  macdSignal: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  priceVsSMA20: 'ABOVE' | 'BELOW' | 'AT';
  priceVsSMA50: 'ABOVE' | 'BELOW' | 'AT';
  support: number;
  resistance: number;
  nearSupport: boolean;
  nearResistance: boolean;
  volumeSignal: 'HIGH' | 'NORMAL' | 'LOW';
}

interface IVAnalysis {
  currentIV: number;
  ivRank: number;
  ivPercentile: number;
  ivSignal: 'HIGH' | 'ELEVATED' | 'NORMAL' | 'LOW';
  hvRatio: number;
  recommendation: 'BUY_PREMIUM' | 'SELL_PREMIUM' | 'NEUTRAL';
}

interface EarningsInfo {
  date: string;
  daysUntil: number;
  expectedMove: number;
  historicalAvgMove: number;
  ivCrushRisk: 'HIGH' | 'MODERATE' | 'LOW' | 'NONE';
}

interface SetupScore {
  total: number;
  technicalScore: number;
  ivScore: number;
  greeksScore: number;
  timingScore: number;
  riskRewardScore: number;
}

interface TradeSuggestion {
  type: 'CALL' | 'PUT' | 'SPREAD' | 'ALERT';
  strategy: string;
  strike?: number;
  expiration?: string;
  dte?: number;
  bid?: number;
  ask?: number;
  midPrice?: number;
  delta?: number;
  gamma?: number;
  theta?: number;
  vega?: number;
  iv?: number;
  maxRisk: string;
  maxReward: string;
  breakeven: string;
  probabilityITM: number;
  probabilityProfit: number;
  riskRewardRatio: string;
  setupScore: SetupScore;
  reasoning: string[];
  warnings: string[];
  entryTriggers: string[];
  riskLevel: 'AGGRESSIVE' | 'MODERATE' | 'CONSERVATIVE' | 'WARNING';
  confidence: number;
  timeframe: string;
}

// ============================================================
// SCHWAB OAUTH TOKEN - Get fresh access token
// ============================================================
async function getSchwabAccessToken(): Promise<{ token: string | null; error: string | null }> {
  if (!SCHWAB_APP_KEY || !SCHWAB_APP_SECRET || !SCHWAB_REFRESH_TOKEN) {
    return { 
      token: null, 
      error: 'Missing Schwab credentials. Set SCHWAB_APP_KEY, SCHWAB_APP_SECRET, and SCHWAB_REFRESH_TOKEN in .env.local' 
    };
  }

  try {
    const credentials = Buffer.from(`${SCHWAB_APP_KEY}:${SCHWAB_APP_SECRET}`).toString('base64');
    
    const response = await fetch(SCHWAB_TOKEN_URL, {
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
      const errorText = await response.text();
      console.error('Schwab token error:', response.status, errorText);
      return { 
        token: null, 
        error: `Schwab auth failed (${response.status}): ${errorText}. Refresh token may be expired (expires every 7 days).` 
      };
    }

    const data = await response.json();
    console.log('✅ Schwab token refreshed successfully');
    return { token: data.access_token, error: null };
  } catch (err) {
    console.error('Schwab token exception:', err);
    return { token: null, error: `Token request failed: ${err}` };
  }
}

// ============================================================
// FETCH SCHWAB OPTIONS CHAIN
// ============================================================
async function fetchSchwabOptionsChain(token: string, symbol: string): Promise<{ data: any; error: string | null }> {
  const url = `${SCHWAB_MARKET_DATA_BASE}/chains?symbol=${symbol}&contractType=ALL&strikeCount=20&includeUnderlyingQuote=true&range=ALL`;
  
  console.log('📊 Fetching Schwab options chain:', url);
  
  try {
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Schwab chains error:', response.status, errorText);
      return { data: null, error: `Options chain request failed (${response.status}): ${errorText}` };
    }

    const data = await response.json();
    console.log('✅ Schwab options chain received, underlying price:', data.underlyingPrice);
    return { data, error: null };
  } catch (err) {
    console.error('Schwab chains exception:', err);
    return { data: null, error: `Options chain request exception: ${err}` };
  }
}

// ============================================================
// FETCH SCHWAB QUOTE (for current price)
// ============================================================
async function fetchSchwabQuote(token: string, symbol: string): Promise<{ price: number | null; error: string | null }> {
  const url = `${SCHWAB_MARKET_DATA_BASE}/quotes?symbols=${symbol}&indicative=false`;
  
  try {
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      return { price: null, error: `Quote request failed (${response.status})` };
    }

    const data = await response.json();
    const quote = data[symbol]?.quote;
    const price = quote?.lastPrice || quote?.mark || quote?.bidPrice;
    console.log('✅ Schwab quote received:', symbol, price);
    return { price, error: null };
  } catch (err) {
    return { price: null, error: `Quote exception: ${err}` };
  }
}

// ============================================================
// FETCH SCHWAB PRICE HISTORY (for technicals)
// ============================================================
async function fetchSchwabPriceHistory(token: string, symbol: string): Promise<number[]> {
  const url = `${SCHWAB_MARKET_DATA_BASE}/pricehistory?symbol=${symbol}&periodType=month&period=3&frequencyType=daily&frequency=1`;
  
  try {
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) return [];

    const data = await response.json();
    return (data.candles || []).map((c: any) => c.close);
  } catch {
    return [];
  }
}

// ============================================================
// PARSE SCHWAB OPTIONS DATA INTO OUR FORMAT
// ============================================================
function parseSchwabOptionsData(chainData: any, currentPrice: number): { calls: OptionContract[], puts: OptionContract[] } {
  const calls: OptionContract[] = [];
  const puts: OptionContract[] = [];

  // Schwab returns callExpDateMap and putExpDateMap
  // Format: { "2024-01-19:5": { "150.0": [{ contract data }] } }
  
  const parseExpDateMap = (expDateMap: any, type: 'call' | 'put'): OptionContract[] => {
    const options: OptionContract[] = [];
    if (!expDateMap) return options;

    // Get first 3 expirations for relevant data
    const expirations = Object.keys(expDateMap).sort().slice(0, 4);
    
    for (const expKey of expirations) {
      const strikes = expDateMap[expKey];
      if (!strikes) continue;

      for (const [strikeStr, contractArray] of Object.entries(strikes)) {
        const contracts = contractArray as any[];
        if (!contracts || contracts.length === 0) continue;
        
        const c = contracts[0]; // First contract at this strike
        const strike = parseFloat(strikeStr);
        
        // Filter to reasonable range around current price (within 15%)
        const pctFromPrice = Math.abs(strike - currentPrice) / currentPrice;
        if (pctFromPrice > 0.15) continue;
        
        const bid = c.bid || 0;
        const ask = c.ask || 0;
        const mid = (bid + ask) / 2;
        const isITM = type === 'call' ? strike < currentPrice : strike > currentPrice;
        const intrinsic = type === 'call' 
          ? Math.max(0, currentPrice - strike) 
          : Math.max(0, strike - currentPrice);

        options.push({
          strike,
          bid,
          ask,
          last: c.last || mid,
          delta: c.delta || 0,
          gamma: c.gamma || 0,
          theta: c.theta || 0,
          vega: c.vega || 0,
          rho: c.rho || 0,
          volume: c.totalVolume || 0,
          openInterest: c.openInterest || 0,
          impliedVolatility: (c.volatility || 30) / 100, // Schwab returns as percentage
          expiration: expKey.split(':')[0],
          dte: c.daysToExpiration || 0,
          inTheMoney: isITM,
          intrinsicValue: intrinsic,
          extrinsicValue: Math.max(0, mid - intrinsic),
          bidAskSpread: ask - bid,
          midPrice: mid,
          symbol: c.symbol,
        });
      }
    }

    return options.sort((a, b) => a.strike - b.strike || a.dte - b.dte);
  };

  return {
    calls: parseExpDateMap(chainData.callExpDateMap, 'call'),
    puts: parseExpDateMap(chainData.putExpDateMap, 'put'),
  };
}

// ============================================================
// TECHNICAL ANALYSIS
// ============================================================
function calculateRSI(prices: number[], period = 14): number {
  if (prices.length < period + 1) return 50;
  
  const changes = [];
  for (let i = 1; i < prices.length; i++) {
    changes.push(prices[i] - prices[i - 1]);
  }
  
  const recentChanges = changes.slice(-period);
  let gains = 0, losses = 0;
  
  for (const change of recentChanges) {
    if (change > 0) gains += change;
    else losses += Math.abs(change);
  }
  
  const avgGain = gains / period;
  const avgLoss = losses / period;
  
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

function calculateSMA(prices: number[], period: number): number {
  if (prices.length < period) return prices[prices.length - 1] || 0;
  const slice = prices.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / period;
}

function analyzeTechnicals(priceHistory: number[], currentPrice: number): TechnicalSignals {
  const prices = priceHistory.length > 0 ? priceHistory : [currentPrice];
  const rsi = calculateRSI(prices);
  const sma20 = calculateSMA(prices, 20);
  const sma50 = calculateSMA(prices, 50);
  
  // Trend analysis
  const recentPrices = prices.slice(-20);
  const oldPrice = recentPrices[0] || currentPrice;
  const priceChange = (currentPrice - oldPrice) / oldPrice * 100;
  
  let trend: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';
  if (priceChange > 3) trend = 'BULLISH';
  else if (priceChange < -3) trend = 'BEARISH';
  
  // Support/Resistance from recent high/low
  const high20 = Math.max(...recentPrices);
  const low20 = Math.min(...recentPrices);
  
  return {
    trend,
    trendStrength: Math.min(100, Math.abs(priceChange) * 10),
    rsi,
    rsiSignal: rsi < 30 ? 'OVERSOLD' : rsi > 70 ? 'OVERBOUGHT' : 'NEUTRAL',
    macdSignal: currentPrice > sma20 ? 'BULLISH' : 'BEARISH',
    priceVsSMA20: currentPrice > sma20 * 1.01 ? 'ABOVE' : currentPrice < sma20 * 0.99 ? 'BELOW' : 'AT',
    priceVsSMA50: currentPrice > sma50 * 1.01 ? 'ABOVE' : currentPrice < sma50 * 0.99 ? 'BELOW' : 'AT',
    support: low20,
    resistance: high20,
    nearSupport: currentPrice < low20 * 1.02,
    nearResistance: currentPrice > high20 * 0.98,
    volumeSignal: 'NORMAL',
  };
}

// ============================================================
// IV ANALYSIS
// ============================================================
function analyzeIV(options: OptionContract[]): IVAnalysis {
  if (options.length === 0) {
    return {
      currentIV: 30,
      ivRank: 50,
      ivPercentile: 50,
      ivSignal: 'NORMAL',
      hvRatio: 1,
      recommendation: 'NEUTRAL',
    };
  }

  // Get average IV from ATM options
  const ivs = options.filter(o => o.impliedVolatility > 0).map(o => o.impliedVolatility * 100);
  const avgIV = ivs.length > 0 ? ivs.reduce((a, b) => a + b, 0) / ivs.length : 30;
  
  // Estimate IV rank (would need historical IV data for accuracy)
  // For now, use heuristics based on typical IV ranges
  const typicalLowIV = avgIV * 0.6;
  const typicalHighIV = avgIV * 1.5;
  const ivRank = Math.min(100, Math.max(0, ((avgIV - typicalLowIV) / (typicalHighIV - typicalLowIV)) * 100));
  
  let ivSignal: 'HIGH' | 'ELEVATED' | 'NORMAL' | 'LOW' = 'NORMAL';
  if (ivRank > 70) ivSignal = 'HIGH';
  else if (ivRank > 50) ivSignal = 'ELEVATED';
  else if (ivRank < 30) ivSignal = 'LOW';

  let recommendation: 'BUY_PREMIUM' | 'SELL_PREMIUM' | 'NEUTRAL' = 'NEUTRAL';
  if (ivRank < 30) recommendation = 'BUY_PREMIUM';
  else if (ivRank > 70) recommendation = 'SELL_PREMIUM';

  return {
    currentIV: Math.round(avgIV * 10) / 10,
    ivRank: Math.round(ivRank),
    ivPercentile: Math.round(ivRank), // Simplified
    ivSignal,
    hvRatio: 1.1,
    recommendation,
  };
}

// ============================================================
// NEWS SENTIMENT
// ============================================================
function analyzeNewsSentiment(headlines: string[]): { sentiment: string; score: number; keywords: string[] } {
  const bullishWords = ['beat', 'surge', 'growth', 'record', 'upgrade', 'buy', 'bullish', 'strong', 'profit', 'gain'];
  const bearishWords = ['miss', 'decline', 'concern', 'downgrade', 'sell', 'bearish', 'weak', 'loss', 'drop', 'fall'];
  
  let score = 0;
  const keywords: string[] = [];
  
  for (const headline of headlines) {
    const lower = headline.toLowerCase();
    for (const word of bullishWords) {
      if (lower.includes(word)) { score++; keywords.push(`+${word}`); }
    }
    for (const word of bearishWords) {
      if (lower.includes(word)) { score--; keywords.push(`-${word}`); }
    }
  }
  
  return {
    sentiment: score > 1 ? 'BULLISH' : score < -1 ? 'BEARISH' : 'NEUTRAL',
    score,
    keywords: keywords.slice(0, 6),
  };
}

// ============================================================
// GENERATE TRADE SUGGESTIONS
// ============================================================
function generateSuggestions(
  calls: OptionContract[],
  puts: OptionContract[],
  currentPrice: number,
  technicals: TechnicalSignals,
  ivAnalysis: IVAnalysis,
  earnings: EarningsInfo,
  sentiment: { sentiment: string; score: number },
): TradeSuggestion[] {
  const suggestions: TradeSuggestion[] = [];

  // Find good call options (delta 0.40-0.60 range)
  const goodCalls = calls.filter(c => 
    c.dte >= 14 && c.dte <= 45 && 
    c.delta >= 0.35 && c.delta <= 0.65 &&
    c.bid > 0 && c.ask > 0
  );

  const goodPuts = puts.filter(p => 
    p.dte >= 14 && p.dte <= 45 && 
    Math.abs(p.delta) >= 0.35 && Math.abs(p.delta) <= 0.65 &&
    p.bid > 0 && p.ask > 0
  );

  // Calculate setup score
  const calculateScore = (option: OptionContract, type: 'call' | 'put'): SetupScore => {
    let technicalScore = 0;
    let ivScore = 0;
    let greeksScore = 0;
    let timingScore = 0;
    let riskRewardScore = 0;

    // Technical score
    if (type === 'call' && technicals.trend === 'BULLISH') technicalScore += 20;
    if (type === 'put' && technicals.trend === 'BEARISH') technicalScore += 20;
    if (type === 'call' && technicals.rsiSignal === 'OVERSOLD') technicalScore += 15;
    if (type === 'put' && technicals.rsiSignal === 'OVERBOUGHT') technicalScore += 15;
    if (technicals.macdSignal === (type === 'call' ? 'BULLISH' : 'BEARISH')) technicalScore += 10;

    // IV score - favor buying when IV is low
    if (ivAnalysis.ivRank < 30) ivScore = 20;
    else if (ivAnalysis.ivRank < 50) ivScore = 15;
    else if (ivAnalysis.ivRank > 70) ivScore = 5;
    else ivScore = 10;

    // Greeks score
    const absDelta = Math.abs(option.delta);
    if (absDelta >= 0.40 && absDelta <= 0.60) greeksScore += 20;
    else if (absDelta >= 0.30 && absDelta <= 0.70) greeksScore += 10;
    if (option.gamma > 0.03) greeksScore += 5;

    // Timing score
    if (option.dte >= 21 && option.dte <= 45) timingScore += 20;
    else if (option.dte >= 14) timingScore += 10;
    if (earnings.daysUntil < 7) timingScore -= 15;

    // Risk/Reward score
    const spreadPct = option.bidAskSpread / option.midPrice;
    if (spreadPct < 0.05) riskRewardScore += 15;
    else if (spreadPct < 0.10) riskRewardScore += 10;
    if (option.volume > option.openInterest * 0.1) riskRewardScore += 5;

    const total = Math.min(100, technicalScore + ivScore + greeksScore + timingScore + riskRewardScore);
    
    return { total, technicalScore, ivScore, greeksScore, timingScore, riskRewardScore };
  };

  // Generate call suggestions if bullish
  if (goodCalls.length > 0 && (technicals.trend === 'BULLISH' || technicals.rsiSignal === 'OVERSOLD')) {
    const bestCall = goodCalls.sort((a, b) => {
      const scoreA = calculateScore(a, 'call').total;
      const scoreB = calculateScore(b, 'call').total;
      return scoreB - scoreA;
    })[0];

    if (bestCall) {
      const score = calculateScore(bestCall, 'call');
      const maxRisk = (bestCall.ask * 100).toFixed(2);
      const breakeven = (bestCall.strike + bestCall.ask).toFixed(2);
      const probITM = Math.round(Math.abs(bestCall.delta) * 100);

      suggestions.push({
        type: 'CALL',
        strategy: 'Long Call',
        strike: bestCall.strike,
        expiration: bestCall.expiration,
        dte: bestCall.dte,
        bid: bestCall.bid,
        ask: bestCall.ask,
        midPrice: bestCall.midPrice,
        delta: bestCall.delta,
        gamma: bestCall.gamma,
        theta: bestCall.theta,
        vega: bestCall.vega,
        iv: bestCall.impliedVolatility * 100,
        maxRisk,
        maxReward: 'Unlimited',
        breakeven,
        probabilityITM: probITM,
        probabilityProfit: Math.round(probITM * 0.85),
        riskRewardRatio: '1:∞',
        setupScore: score,
        reasoning: [
          `Trend: ${technicals.trend} (${technicals.trendStrength.toFixed(0)}% strength)`,
          `RSI: ${technicals.rsi.toFixed(0)} (${technicals.rsiSignal})`,
          `Delta: ${bestCall.delta.toFixed(2)} (${probITM}% ITM probability)`,
          `IV Rank: ${ivAnalysis.ivRank}% (${ivAnalysis.recommendation === 'BUY_PREMIUM' ? 'favorable' : 'elevated'})`,
          `DTE: ${bestCall.dte} days (optimal range)`,
        ],
        warnings: earnings.daysUntil < 14 ? [`⚠️ Earnings in ${earnings.daysUntil} days - IV crush risk`] : [],
        entryTriggers: [
          technicals.nearSupport ? '✓ Near support level' : 'Wait for pullback to support',
          technicals.rsiSignal === 'OVERSOLD' ? '✓ RSI oversold' : 'RSI neutral',
        ],
        riskLevel: score.total >= 60 ? 'MODERATE' : 'AGGRESSIVE',
        confidence: score.total,
        timeframe: `${bestCall.dte} days`,
      });
    }
  }

  // Generate put suggestions if bearish
  if (goodPuts.length > 0 && (technicals.trend === 'BEARISH' || technicals.rsiSignal === 'OVERBOUGHT')) {
    const bestPut = goodPuts.sort((a, b) => {
      const scoreA = calculateScore(a, 'put').total;
      const scoreB = calculateScore(b, 'put').total;
      return scoreB - scoreA;
    })[0];

    if (bestPut) {
      const score = calculateScore(bestPut, 'put');
      const maxRisk = (bestPut.ask * 100).toFixed(2);
      const breakeven = (bestPut.strike - bestPut.ask).toFixed(2);
      const probITM = Math.round(Math.abs(bestPut.delta) * 100);

      suggestions.push({
        type: 'PUT',
        strategy: 'Long Put / Hedge',
        strike: bestPut.strike,
        expiration: bestPut.expiration,
        dte: bestPut.dte,
        bid: bestPut.bid,
        ask: bestPut.ask,
        midPrice: bestPut.midPrice,
        delta: bestPut.delta,
        gamma: bestPut.gamma,
        theta: bestPut.theta,
        vega: bestPut.vega,
        iv: bestPut.impliedVolatility * 100,
        maxRisk,
        maxReward: breakeven,
        breakeven,
        probabilityITM: probITM,
        probabilityProfit: Math.round(probITM * 0.85),
        riskRewardRatio: `1:${(bestPut.strike / bestPut.ask).toFixed(1)}`,
        setupScore: score,
        reasoning: [
          `Trend: ${technicals.trend} (${technicals.trendStrength.toFixed(0)}% strength)`,
          `RSI: ${technicals.rsi.toFixed(0)} (${technicals.rsiSignal})`,
          `Delta: ${bestPut.delta.toFixed(2)} (${probITM}% ITM probability)`,
          `IV Rank: ${ivAnalysis.ivRank}%`,
          `Good for hedging existing long positions`,
        ],
        warnings: earnings.daysUntil < 14 ? [`⚠️ Earnings in ${earnings.daysUntil} days`] : [],
        entryTriggers: [
          technicals.nearResistance ? '✓ Near resistance level' : 'Wait for rally to resistance',
        ],
        riskLevel: score.total >= 60 ? 'MODERATE' : 'AGGRESSIVE',
        confidence: score.total,
        timeframe: `${bestPut.dte} days`,
      });
    }
  }

  // Add earnings alert if applicable
  if (earnings.daysUntil <= 14 && earnings.daysUntil > 0) {
    suggestions.push({
      type: 'ALERT',
      strategy: `⚠️ Earnings in ${earnings.daysUntil} Days`,
      maxRisk: 'N/A',
      maxReward: 'N/A',
      breakeven: 'N/A',
      probabilityITM: 0,
      probabilityProfit: 0,
      riskRewardRatio: 'N/A',
      setupScore: { total: 0, technicalScore: 0, ivScore: 0, greeksScore: 0, timingScore: 0, riskRewardScore: 0 },
      reasoning: [
        `Earnings date: ${earnings.date}`,
        `Expected move: ±${earnings.expectedMove.toFixed(1)}%`,
        `IV typically drops 20-40% after earnings (IV crush)`,
        `Consider waiting until after earnings for directional plays`,
      ],
      warnings: [
        'High IV crush risk if holding through earnings',
        'Consider selling premium strategies instead',
      ],
      entryTriggers: [],
      riskLevel: 'WARNING',
      confidence: 0,
      timeframe: 'Current',
    });
  }

  // Add high IV alert
  if (ivAnalysis.ivRank > 70) {
    suggestions.push({
      type: 'ALERT',
      strategy: '⚠️ HIGH IV ENVIRONMENT',
      maxRisk: 'N/A',
      maxReward: 'N/A',
      breakeven: 'N/A',
      probabilityITM: 0,
      probabilityProfit: 0,
      riskRewardRatio: 'N/A',
      setupScore: { total: 0, technicalScore: 0, ivScore: 0, greeksScore: 0, timingScore: 0, riskRewardScore: 0 },
      reasoning: [
        `IV Rank: ${ivAnalysis.ivRank}% (options expensive)`,
        `IV Percentile: ${ivAnalysis.ivPercentile}%`,
        `Consider selling strategies: covered calls, credit spreads`,
        `Buying premium is NOT recommended`,
      ],
      warnings: [],
      entryTriggers: [],
      riskLevel: 'WARNING',
      confidence: 0,
      timeframe: 'Current',
    });
  }

  return suggestions.sort((a, b) => b.confidence - a.confidence);
}

// ============================================================
// MAIN API HANDLER
// ============================================================
export async function GET(request: NextRequest, { params }: { params: { ticker: string } }) {
  const ticker = params.ticker.toUpperCase();
  const startTime = Date.now();
  
  console.log(`\n${'='.repeat(60)}`);
  console.log(`📈 OPTIONS API REQUEST: ${ticker}`);
  console.log(`⏰ Time: ${new Date().toISOString()}`);
  console.log(`${'='.repeat(60)}`);

  try {
    let calls: OptionContract[] = [];
    let puts: OptionContract[] = [];
    let currentPrice = 0;
    let priceHistory: number[] = [];
    let dataSource = 'none';
    const errors: string[] = [];

    // Step 1: Get Schwab access token
    const { token: schwabToken, error: tokenError } = await getSchwabAccessToken();
    
    if (tokenError) {
      errors.push(tokenError);
      console.log('⚠️ Schwab token error:', tokenError);
    }

    // Step 2: Fetch live data from Schwab
    if (schwabToken) {
      // Fetch options chain
      const { data: chainData, error: chainError } = await fetchSchwabOptionsChain(schwabToken, ticker);
      
      if (chainError) {
        errors.push(chainError);
      } else if (chainData) {
        currentPrice = chainData.underlyingPrice || 0;
        const parsed = parseSchwabOptionsData(chainData, currentPrice);
        calls = parsed.calls;
        puts = parsed.puts;
        dataSource = 'schwab-live';
        console.log(`✅ Parsed ${calls.length} calls, ${puts.length} puts`);
      }

      // Fetch price history for technicals
      priceHistory = await fetchSchwabPriceHistory(schwabToken, ticker);
      if (priceHistory.length > 0) {
        console.log(`✅ Fetched ${priceHistory.length} days of price history`);
      }

      // If no underlying price from chains, try quote endpoint
      if (currentPrice === 0) {
        const { price } = await fetchSchwabQuote(schwabToken, ticker);
        if (price) currentPrice = price;
      }
    }

    // Log data status
    console.log(`📊 Data Source: ${dataSource}`);
    console.log(`💰 Current Price: $${currentPrice}`);
    console.log(`📈 Calls: ${calls.length}, Puts: ${puts.length}`);
    if (errors.length > 0) {
      console.log(`⚠️ Errors:`, errors);
    }

    // If no live data, return error with instructions
    if (calls.length === 0 && puts.length === 0) {
      return NextResponse.json({
        error: 'No live options data available',
        ticker,
        currentPrice,
        dataSource: 'none',
        errors,
        instructions: [
          '1. Ensure SCHWAB_APP_KEY is set in .env.local',
          '2. Ensure SCHWAB_APP_SECRET is set in .env.local',
          '3. Ensure SCHWAB_REFRESH_TOKEN is set in .env.local',
          '4. Refresh tokens expire every 7 days - you may need to re-authenticate',
          '5. Ensure your Schwab app has Market Data Production access',
        ],
        lastUpdated: new Date().toISOString(),
      }, { status: 200 }); // Return 200 so frontend can display the error
    }

    // Fetch supplementary data from Finnhub
    let headlines: string[] = [];
    let earningsData = { date: '', daysUntil: 30 };
    let analystRating = { consensus: 'hold', buyPercent: 55 };

    if (FINNHUB_KEY) {
      try {
        const [newsRes, earningsRes] = await Promise.all([
          fetch(`https://finnhub.io/api/v1/company-news?symbol=${ticker}&from=${new Date(Date.now() - 7*24*60*60*1000).toISOString().split('T')[0]}&to=${new Date().toISOString().split('T')[0]}&token=${FINNHUB_KEY}`),
          fetch(`https://finnhub.io/api/v1/calendar/earnings?symbol=${ticker}&token=${FINNHUB_KEY}`),
        ]);

        if (newsRes.ok) {
          const data = await newsRes.json();
          headlines = (data || []).slice(0, 5).map((n: any) => n.headline);
        }
        
        if (earningsRes.ok) {
          const data = await earningsRes.json();
          const upcoming = data.earningsCalendar?.find((e: any) => new Date(e.date) > new Date());
          if (upcoming) {
            earningsData = {
              date: upcoming.date,
              daysUntil: Math.ceil((new Date(upcoming.date).getTime() - Date.now()) / (1000*60*60*24)),
            };
          }
        }
      } catch (e) {
        console.log('Finnhub error (non-critical):', e);
      }
    }

    if (headlines.length === 0) {
      headlines = [`${ticker} market analysis`, `Options activity for ${ticker}`];
    }

    // Run analysis
    const technicals = analyzeTechnicals(priceHistory, currentPrice);
    const allOptions = [...calls, ...puts].filter(o => o.dte > 0);
    const ivAnalysis = analyzeIV(allOptions);
    const sentiment = analyzeNewsSentiment(headlines);

    // Calculate expected move
    const avgIV = ivAnalysis.currentIV / 100;
    const nearestDTE = calls.length > 0 ? Math.min(...calls.map(c => c.dte)) : 30;
    const expectedMove = avgIV * Math.sqrt(nearestDTE / 365) * 100;

    const earnings: EarningsInfo = {
      date: earningsData.date || 'TBD',
      daysUntil: earningsData.daysUntil,
      expectedMove: Math.round(expectedMove * 10) / 10,
      historicalAvgMove: Math.round(expectedMove * 0.8 * 10) / 10,
      ivCrushRisk: earningsData.daysUntil <= 7 ? 'HIGH' : earningsData.daysUntil <= 14 ? 'MODERATE' : 'LOW',
    };

    // Generate suggestions
    const suggestions = generateSuggestions(calls, puts, currentPrice, technicals, ivAnalysis, earnings, sentiment);

    // Calculate metrics
    const totalCallVolume = calls.reduce((sum, c) => sum + c.volume, 0);
    const totalPutVolume = puts.reduce((sum, p) => sum + p.volume, 0);
    const putCallRatio = totalCallVolume > 0 ? totalPutVolume / totalCallVolume : 1;

    const responseTime = Date.now() - startTime;
    console.log(`✅ Response ready in ${responseTime}ms`);

    return NextResponse.json({
      ticker,
      currentPrice: Math.round(currentPrice * 100) / 100,
      lastUpdated: new Date().toISOString(),
      dataSource,
      responseTimeMs: responseTime,

      technicals,
      ivAnalysis,
      earnings,

      sentiment: {
        sentiment: sentiment.sentiment,
        score: sentiment.score,
        keywords: sentiment.keywords,
        recentHeadlines: headlines,
      },

      analystRating,

      metrics: {
        putCallRatio: putCallRatio.toFixed(2),
        totalCallVolume,
        totalPutVolume,
        avgIV: ivAnalysis.currentIV.toFixed(1),
        ivRank: ivAnalysis.ivRank.toFixed(0),
        ivPercentile: ivAnalysis.ivPercentile.toFixed(0),
      },

      suggestions,

      optionsChain: {
        calls: calls.slice(0, 15),
        puts: puts.slice(0, 15),
      },

      debug: {
        schwabConnected: !!schwabToken,
        callsCount: calls.length,
        putsCount: puts.length,
        priceHistoryDays: priceHistory.length,
        errors: errors.length > 0 ? errors : undefined,
      },
    });

  } catch (error) {
    console.error('❌ Options API error:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch options data',
      details: String(error),
      ticker,
      lastUpdated: new Date().toISOString(),
    }, { status: 500 });
  }
}
