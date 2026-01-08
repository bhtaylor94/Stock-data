import { NextResponse } from 'next/server';

// ============================================================
// COMPREHENSIVE STOCK ANALYSIS API
// Pulls ALL available data for professional-grade analysis:
// - Real-time price & technicals (Schwab)
// - Fundamentals (Finnhub)
// - News headlines & sentiment (Finnhub)
// - Earnings calendar (Finnhub)
// - Analyst recommendations (Finnhub)
// - Insider transactions (Finnhub)
// - Price targets (Finnhub)
// ============================================================

const FINNHUB_KEY = process.env.FINNHUB_API_KEY;
const SCHWAB_APP_KEY = process.env.SCHWAB_APP_KEY;
const SCHWAB_APP_SECRET = process.env.SCHWAB_APP_SECRET;
const SCHWAB_REFRESH_TOKEN = process.env.SCHWAB_REFRESH_TOKEN;

// ============================================================
// SCHWAB AUTH
// ============================================================
async function getSchwabToken(): Promise<string | null> {
  if (!SCHWAB_APP_KEY || !SCHWAB_APP_SECRET || !SCHWAB_REFRESH_TOKEN) return null;
  
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
    if (!response.ok) return null;
    const data = await response.json();
    return data.access_token;
  } catch { return null; }
}

async function fetchSchwabQuote(token: string, symbol: string) {
  try {
    const res = await fetch(`https://api.schwabapi.com/marketdata/v1/quotes?symbols=${symbol}&indicative=false`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data[symbol];
  } catch { return null; }
}

async function fetchSchwabPriceHistory(token: string, symbol: string): Promise<{ close: number; high: number; low: number; volume: number }[]> {
  try {
    const res = await fetch(`https://api.schwabapi.com/marketdata/v1/pricehistory?symbol=${symbol}&periodType=year&period=1&frequencyType=daily&frequency=1`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.candles || []).map((c: any) => ({ close: c.close, high: c.high, low: c.low, volume: c.volume }));
  } catch { return []; }
}

// ============================================================
// FINNHUB API CALLS
// ============================================================
async function fetchFinnhubData(endpoint: string) {
  if (!FINNHUB_KEY) return null;
  try {
    const res = await fetch(`https://finnhub.io/api/v1/${endpoint}&token=${FINNHUB_KEY}`);
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}

// Company profile
async function getCompanyProfile(symbol: string) {
  return fetchFinnhubData(`stock/profile2?symbol=${symbol}`);
}

// Basic financials
async function getFinancials(symbol: string) {
  return fetchFinnhubData(`stock/metric?symbol=${symbol}&metric=all`);
}

// Company news (last 7 days)
async function getCompanyNews(symbol: string) {
  const to = new Date().toISOString().split('T')[0];
  const from = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  return fetchFinnhubData(`company-news?symbol=${symbol}&from=${from}&to=${to}`);
}

// News sentiment
async function getNewsSentiment(symbol: string) {
  return fetchFinnhubData(`news-sentiment?symbol=${symbol}`);
}

// Analyst recommendations
async function getRecommendations(symbol: string) {
  return fetchFinnhubData(`stock/recommendation?symbol=${symbol}`);
}

// Price target
async function getPriceTarget(symbol: string) {
  return fetchFinnhubData(`stock/price-target?symbol=${symbol}`);
}

// Earnings calendar
async function getEarnings(symbol: string) {
  const from = new Date().toISOString().split('T')[0];
  const to = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  return fetchFinnhubData(`calendar/earnings?symbol=${symbol}&from=${from}&to=${to}`);
}

// Insider transactions
async function getInsiderTransactions(symbol: string) {
  return fetchFinnhubData(`stock/insider-transactions?symbol=${symbol}`);
}

// Quote (fallback)
async function getFinnhubQuote(symbol: string) {
  return fetchFinnhubData(`quote?symbol=${symbol}`);
}

// ============================================================
// TECHNICAL CALCULATIONS
// ============================================================
function calculateSMA(prices: number[], period: number): number {
  if (prices.length < period) return prices[prices.length - 1] || 0;
  return prices.slice(-period).reduce((a, b) => a + b, 0) / period;
}

function calculateEMA(prices: number[], period: number): number {
  if (prices.length < period) return prices[prices.length - 1] || 0;
  const k = 2 / (period + 1);
  let ema = prices.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < prices.length; i++) {
    ema = prices[i] * k + ema * (1 - k);
  }
  return ema;
}

function calculateRSI(prices: number[], period = 14): number {
  if (prices.length < period + 1) return 50;
  const changes = prices.slice(-period - 1).map((p, i, arr) => i > 0 ? p - arr[i-1] : 0).slice(1);
  const gains = changes.filter(c => c > 0).reduce((a, b) => a + b, 0) / period;
  const losses = Math.abs(changes.filter(c => c < 0).reduce((a, b) => a + b, 0)) / period;
  if (losses === 0) return 100;
  return 100 - (100 / (1 + gains / losses));
}

function calculateMACD(prices: number[]): { macd: number; signal: number; histogram: number } {
  const ema12 = calculateEMA(prices, 12);
  const ema26 = calculateEMA(prices, 26);
  const macd = ema12 - ema26;
  // Signal line is 9-period EMA of MACD (simplified)
  const signal = macd * 0.9; // Approximation
  return { macd, signal, histogram: macd - signal };
}

function calculateBollingerBands(prices: number[], period = 20): { upper: number; middle: number; lower: number } {
  const sma = calculateSMA(prices, period);
  const slice = prices.slice(-period);
  const stdDev = Math.sqrt(slice.reduce((sum, p) => sum + Math.pow(p - sma, 2), 0) / period);
  return { upper: sma + 2 * stdDev, middle: sma, lower: sma - 2 * stdDev };
}

function findSupportResistance(candles: { high: number; low: number }[]): { support: number; resistance: number } {
  if (candles.length === 0) return { support: 0, resistance: 0 };
  const recent = candles.slice(-20);
  return {
    support: Math.min(...recent.map(c => c.low)),
    resistance: Math.max(...recent.map(c => c.high)),
  };
}

function calculateATR(candles: { high: number; low: number; close: number }[], period = 14): number {
  if (candles.length < period + 1) return 0;
  let atr = 0;
  for (let i = candles.length - period; i < candles.length; i++) {
    const tr = Math.max(
      candles[i].high - candles[i].low,
      Math.abs(candles[i].high - candles[i - 1]?.close || 0),
      Math.abs(candles[i].low - candles[i - 1]?.close || 0)
    );
    atr += tr;
  }
  return atr / period;
}

// ============================================================
// SCORING SYSTEM (Deterministic, Piotroski-style)
// ============================================================
interface FundamentalMetrics {
  pe: number;
  pb: number;
  roe: number;
  roa: number;
  debtEquity: number;
  currentRatio: number;
  profitMargin: number;
  revenueGrowth: number;
  epsGrowth: number;
  grossMargin: number;
}

function calculateFundamentalScore(metrics: FundamentalMetrics): {
  score: number;
  maxScore: number;
  factors: { name: string; passed: boolean; value: string; threshold: string; weight: number }[];
} {
  const factors: { name: string; passed: boolean; value: string; threshold: string; weight: number }[] = [];
  
  // Profitability (3 factors)
  factors.push({ name: 'Positive ROE', passed: metrics.roe > 0, value: `${metrics.roe?.toFixed(1) || 0}%`, threshold: '> 0%', weight: 1 });
  factors.push({ name: 'Strong ROE (>15%)', passed: metrics.roe > 15, value: `${metrics.roe?.toFixed(1) || 0}%`, threshold: '> 15%', weight: 1 });
  factors.push({ name: 'Positive Profit Margin', passed: metrics.profitMargin > 0, value: `${metrics.profitMargin?.toFixed(1) || 0}%`, threshold: '> 0%', weight: 1 });
  
  // Valuation (2 factors)
  factors.push({ name: 'P/E under 25', passed: metrics.pe > 0 && metrics.pe < 25, value: metrics.pe?.toFixed(1) || 'N/A', threshold: '0-25', weight: 1 });
  factors.push({ name: 'P/B under 3', passed: metrics.pb > 0 && metrics.pb < 3, value: metrics.pb?.toFixed(2) || 'N/A', threshold: '< 3', weight: 1 });
  
  // Financial Health (2 factors)
  factors.push({ name: 'Low Debt (D/E < 1)', passed: metrics.debtEquity < 1, value: metrics.debtEquity?.toFixed(2) || 'N/A', threshold: '< 1.0', weight: 1 });
  factors.push({ name: 'Current Ratio > 1', passed: metrics.currentRatio > 1, value: metrics.currentRatio?.toFixed(2) || 'N/A', threshold: '> 1.0', weight: 1 });
  
  // Growth (2 factors)
  factors.push({ name: 'Revenue Growth', passed: metrics.revenueGrowth > 0, value: `${metrics.revenueGrowth?.toFixed(1) || 0}%`, threshold: '> 0%', weight: 1 });
  factors.push({ name: 'EPS Growth', passed: metrics.epsGrowth > 0, value: `${metrics.epsGrowth?.toFixed(1) || 0}%`, threshold: '> 0%', weight: 1 });

  const score = factors.filter(f => f.passed).length;
  return { score, maxScore: 9, factors };
}

interface TechnicalInputs {
  price: number;
  sma20: number;
  sma50: number;
  sma200: number;
  ema12: number;
  ema26: number;
  rsi: number;
  macd: { macd: number; signal: number; histogram: number };
  bbands: { upper: number; middle: number; lower: number };
  atr: number;
  previousClose: number;
  high52Week: number;
  low52Week: number;
  avgVolume: number;
  currentVolume: number;
}

function calculateTechnicalScore(inputs: TechnicalInputs): {
  score: number;
  maxScore: number;
  factors: { name: string; passed: boolean; value: string; threshold: string; weight: number }[];
} {
  const factors: { name: string; passed: boolean; value: string; threshold: string; weight: number }[] = [];
  const { price, sma20, sma50, sma200, rsi, macd, previousClose, high52Week, low52Week, avgVolume, currentVolume } = inputs;

  // Trend (3 factors)
  factors.push({ name: 'Above 20 SMA', passed: price > sma20, value: `$${price.toFixed(2)}`, threshold: `> $${sma20.toFixed(2)}`, weight: 1 });
  factors.push({ name: 'Above 50 SMA', passed: price > sma50, value: `$${price.toFixed(2)}`, threshold: `> $${sma50.toFixed(2)}`, weight: 1 });
  factors.push({ name: 'Above 200 SMA', passed: price > sma200, value: `$${price.toFixed(2)}`, threshold: `> $${sma200.toFixed(2)}`, weight: 1 });
  
  // Momentum (3 factors)
  factors.push({ name: 'Golden Cross (50>200)', passed: sma50 > sma200, value: `50: $${sma50.toFixed(2)}`, threshold: `> 200: $${sma200.toFixed(2)}`, weight: 1 });
  factors.push({ name: 'MACD Bullish', passed: macd.macd > macd.signal, value: macd.macd.toFixed(3), threshold: `> Signal`, weight: 1 });
  factors.push({ name: 'RSI Not Overbought', passed: rsi < 70, value: rsi.toFixed(0), threshold: '< 70', weight: 1 });
  
  // Position (3 factors)
  factors.push({ name: 'RSI Not Oversold', passed: rsi > 30, value: rsi.toFixed(0), threshold: '> 30', weight: 1 });
  const midpoint = (high52Week + low52Week) / 2;
  factors.push({ name: 'Above 52w Midpoint', passed: price > midpoint, value: `$${price.toFixed(2)}`, threshold: `> $${midpoint.toFixed(2)}`, weight: 1 });
  factors.push({ name: 'Near 52w High (>80%)', passed: price >= high52Week * 0.8, value: `${((price / high52Week) * 100).toFixed(0)}%`, threshold: '> 80%', weight: 1 });

  const score = factors.filter(f => f.passed).length;
  return { score, maxScore: 9, factors };
}

// ============================================================
// NEWS SENTIMENT ANALYSIS
// ============================================================
function analyzeNewsSentiment(news: any[], sentimentData: any): {
  score: number;
  signal: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  headlines: { title: string; sentiment: string; source: string; datetime: string }[];
  buzzwords: string[];
} {
  if (!news || news.length === 0) {
    return { score: 0, signal: 'NEUTRAL', headlines: [], buzzwords: [] };
  }

  // Analyze headlines for sentiment keywords
  const bullishWords = ['surge', 'soar', 'beat', 'upgrade', 'record', 'growth', 'profit', 'bullish', 'buy', 'strong', 'positive', 'rally', 'breakthrough'];
  const bearishWords = ['crash', 'plunge', 'miss', 'downgrade', 'loss', 'decline', 'bearish', 'sell', 'weak', 'negative', 'concern', 'risk', 'lawsuit', 'investigation'];
  
  let bullCount = 0;
  let bearCount = 0;
  const buzzwords: string[] = [];
  
  const headlines = news.slice(0, 10).map((item: any) => {
    const title = (item.headline || item.title || '').toLowerCase();
    let sentiment = 'NEUTRAL';
    
    bullishWords.forEach(word => {
      if (title.includes(word)) { bullCount++; sentiment = 'BULLISH'; buzzwords.push(`+${word}`); }
    });
    bearishWords.forEach(word => {
      if (title.includes(word)) { bearCount++; sentiment = 'BEARISH'; buzzwords.push(`-${word}`); }
    });
    
    return {
      title: item.headline || item.title || '',
      sentiment,
      source: item.source || 'Unknown',
      datetime: item.datetime ? new Date(item.datetime * 1000).toLocaleDateString() : '',
    };
  });

  // Use Finnhub sentiment if available
  let score = 0;
  if (sentimentData?.companyNewsScore) {
    score = Math.round(sentimentData.companyNewsScore * 100);
  } else {
    score = bullCount > bearCount ? Math.min(75, 50 + (bullCount - bearCount) * 5) :
            bearCount > bullCount ? Math.max(25, 50 - (bearCount - bullCount) * 5) : 50;
  }

  const signal = score >= 60 ? 'BULLISH' : score <= 40 ? 'BEARISH' : 'NEUTRAL';
  
  return { score, signal, headlines, buzzwords: [...new Set(buzzwords)].slice(0, 8) };
}

// ============================================================
// ANALYST ANALYSIS
// ============================================================
function analyzeAnalystRatings(recommendations: any[], priceTarget: any): {
  consensus: string;
  buyPercent: number;
  distribution: { strongBuy: number; buy: number; hold: number; sell: number; strongSell: number };
  targetPrice: number;
  targetUpside: number;
  recentChanges: { period: string; strongBuy: number; buy: number; hold: number; sell: number; strongSell: number }[];
} {
  const latest = recommendations?.[0] || {};
  const strongBuy = latest.strongBuy || 0;
  const buy = latest.buy || 0;
  const hold = latest.hold || 0;
  const sell = latest.sell || 0;
  const strongSell = latest.strongSell || 0;
  const total = strongBuy + buy + hold + sell + strongSell;
  
  const buyPercent = total > 0 ? Math.round(((strongBuy + buy) / total) * 100) : 0;
  
  let consensus = 'HOLD';
  if (buyPercent >= 70) consensus = 'STRONG BUY';
  else if (buyPercent >= 55) consensus = 'BUY';
  else if (buyPercent <= 30) consensus = 'SELL';
  
  const targetPrice = priceTarget?.targetMean || priceTarget?.targetMedian || 0;
  
  return {
    consensus,
    buyPercent,
    distribution: { strongBuy, buy, hold, sell, strongSell },
    targetPrice,
    targetUpside: 0, // Will be calculated with current price
    recentChanges: recommendations?.slice(0, 3).map((r: any) => ({
      period: r.period || '',
      strongBuy: r.strongBuy || 0,
      buy: r.buy || 0,
      hold: r.hold || 0,
      sell: r.sell || 0,
      strongSell: r.strongSell || 0,
    })) || [],
  };
}

// ============================================================
// INSIDER ANALYSIS
// ============================================================
function analyzeInsiderActivity(transactions: any): {
  netActivity: 'BUYING' | 'SELLING' | 'NEUTRAL';
  recentTransactions: { name: string; shares: number; value: number; type: string; date: string }[];
  buyCount: number;
  sellCount: number;
  netShares: number;
} {
  // Finnhub returns { data: [...] } structure
  const txData = transactions?.data || transactions || [];
  if (!Array.isArray(txData) || txData.length === 0) {
    return { netActivity: 'NEUTRAL', recentTransactions: [], buyCount: 0, sellCount: 0, netShares: 0 };
  }

  let buyCount = 0;
  let sellCount = 0;
  let netShares = 0;
  
  const recent = txData.slice(0, 10);
  const recentTransactions = recent.map((t: any) => {
    const isBuy = t.transactionCode === 'P' || t.change > 0;
    const isSell = t.transactionCode === 'S' || t.change < 0;
    
    if (isBuy) { buyCount++; netShares += Math.abs(t.change || 0); }
    if (isSell) { sellCount++; netShares -= Math.abs(t.change || 0); }
    
    return {
      name: t.name || 'Unknown',
      shares: Math.abs(t.change || 0),
      value: (t.change || 0) * (t.transactionPrice || 0),
      type: isBuy ? 'BUY' : isSell ? 'SELL' : 'OTHER',
      date: t.transactionDate || '',
    };
  });
  
  const netActivity = netShares > 0 ? 'BUYING' : netShares < 0 ? 'SELLING' : 'NEUTRAL';
  
  return { netActivity, recentTransactions, buyCount, sellCount, netShares };
}

// ============================================================
// GENERATE COMPREHENSIVE SUGGESTIONS
// ============================================================
function generateSuggestions(
  fundamentalScore: number,
  technicalScore: number,
  newsSentiment: { score: number; signal: string },
  analystRating: { consensus: string; buyPercent: number; targetUpside: number },
  insiderActivity: { netActivity: string },
  earnings: any
) {
  const suggestions: any[] = [];
  
  // Calculate composite score (weighted)
  const compositeScore = (
    fundamentalScore * 2 +      // 18 points max (x2 = 36)
    technicalScore * 2 +        // 18 points max (x2 = 36)
    (newsSentiment.score / 10) +  // 10 points max
    (analystRating.buyPercent / 10) + // 10 points max
    (insiderActivity.netActivity === 'BUYING' ? 5 : insiderActivity.netActivity === 'SELLING' ? -5 : 0)
  );
  const maxComposite = 97; // Theoretical max
  const normalizedScore = Math.round((compositeScore / maxComposite) * 100);
  
  // Main recommendation
  let mainType: 'BUY' | 'SELL' | 'HOLD' = 'HOLD';
  let strategy = 'Hold - Mixed Signals';
  let confidence = normalizedScore;
  
  if (normalizedScore >= 70) {
    mainType = 'BUY';
    strategy = 'Strong Buy - Multiple Bullish Signals';
  } else if (normalizedScore >= 55) {
    mainType = 'BUY';
    strategy = 'Buy - Favorable Conditions';
  } else if (normalizedScore <= 30) {
    mainType = 'SELL';
    strategy = 'Sell - Multiple Warning Signs';
  } else if (normalizedScore <= 45) {
    mainType = 'SELL';
    strategy = 'Reduce Position - Caution Advised';
  }
  
  const reasoning = [
    `Fundamental Score: ${fundamentalScore}/9`,
    `Technical Score: ${technicalScore}/9`,
    `News Sentiment: ${newsSentiment.signal} (${newsSentiment.score}%)`,
    `Analyst Consensus: ${analystRating.consensus} (${analystRating.buyPercent}% bullish)`,
    `Insider Activity: ${insiderActivity.netActivity}`,
  ];
  
  if (analystRating.targetUpside > 0) {
    reasoning.push(`Price Target Upside: ${analystRating.targetUpside.toFixed(1)}%`);
  }
  
  suggestions.push({
    type: mainType,
    strategy,
    confidence: Math.min(95, Math.max(5, confidence)),
    reasoning,
    riskLevel: normalizedScore >= 60 ? 'LOW' : normalizedScore >= 40 ? 'MEDIUM' : 'HIGH',
  });
  
  // Earnings alert
  if (earnings?.earningsCalendar?.[0]) {
    const nextEarnings = earnings.earningsCalendar[0];
    const daysUntil = Math.ceil((new Date(nextEarnings.date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    if (daysUntil > 0 && daysUntil <= 14) {
      suggestions.push({
        type: 'ALERT',
        strategy: `Earnings in ${daysUntil} days`,
        confidence: 0,
        reasoning: [
          `Report Date: ${nextEarnings.date}`,
          `Expected EPS: $${nextEarnings.epsEstimate || 'N/A'}`,
          `Expected Revenue: $${nextEarnings.revenueEstimate ? (nextEarnings.revenueEstimate / 1e9).toFixed(2) + 'B' : 'N/A'}`,
          'Volatility typically increases before earnings',
        ],
        riskLevel: 'WARNING',
      });
    }
  }
  
  // Divergence alerts
  if (Math.abs(fundamentalScore - technicalScore) >= 4) {
    suggestions.push({
      type: 'ALERT',
      strategy: 'Fundamental/Technical Divergence',
      confidence: 0,
      reasoning: [
        `Fundamental: ${fundamentalScore}/9 vs Technical: ${technicalScore}/9`,
        fundamentalScore > technicalScore ? 'Strong fundamentals but weak price action' : 'Strong price action but weak fundamentals',
        'This divergence may resolve - watch carefully',
      ],
      riskLevel: 'WARNING',
    });
  }
  
  return suggestions;
}

// ============================================================
// MAIN API HANDLER
// ============================================================
export async function GET(
  request: Request,
  { params }: { params: { ticker: string } }
) {
  const ticker = params.ticker.toUpperCase();
  const startTime = Date.now();
  
  let dataSource = 'none';
  let quote: any = null;
  let priceHistory: any[] = [];

  // Try Schwab first
  const schwabToken = await getSchwabToken();
  if (schwabToken) {
    quote = await fetchSchwabQuote(schwabToken, ticker);
    priceHistory = await fetchSchwabPriceHistory(schwabToken, ticker);
    if (quote) dataSource = 'schwab';
  }

  // Fetch all Finnhub data in parallel
  const [
    profile,
    financials,
    news,
    sentiment,
    recommendations,
    priceTarget,
    earnings,
    insiderTx,
    finnhubQuote,
  ] = await Promise.all([
    getCompanyProfile(ticker),
    getFinancials(ticker),
    getCompanyNews(ticker),
    getNewsSentiment(ticker),
    getRecommendations(ticker),
    getPriceTarget(ticker),
    getEarnings(ticker),
    getInsiderTransactions(ticker),
    !quote ? getFinnhubQuote(ticker) : Promise.resolve(null),
  ]);

  // Use Finnhub quote as fallback
  if (!quote && finnhubQuote && finnhubQuote.c > 0) {
    quote = { quote: { lastPrice: finnhubQuote.c, netChange: finnhubQuote.d, netPercentChange: finnhubQuote.dp, closePrice: finnhubQuote.pc } };
    dataSource = 'finnhub';
  }

  if (!quote || !quote.quote) {
    return NextResponse.json({
      error: 'Unable to fetch stock data',
      ticker,
      instructions: ['Ensure API keys are configured', 'Check if ticker symbol is valid'],
    });
  }

  const q = quote.quote;
  const price = q.lastPrice || q.mark || 0;
  const previousClose = q.closePrice || price;

  // Calculate all technicals
  const closes = priceHistory.map(c => c.close);
  const sma20 = closes.length >= 20 ? calculateSMA(closes, 20) : price * 0.98;
  const sma50 = closes.length >= 50 ? calculateSMA(closes, 50) : price * 0.95;
  const sma200 = closes.length >= 200 ? calculateSMA(closes, 200) : price * 0.90;
  const ema12 = closes.length >= 12 ? calculateEMA(closes, 12) : price;
  const ema26 = closes.length >= 26 ? calculateEMA(closes, 26) : price;
  const rsi = closes.length >= 15 ? calculateRSI(closes) : 50;
  const macd = calculateMACD(closes);
  const bbands = calculateBollingerBands(closes);
  const atr = calculateATR(priceHistory as any);
  const { support, resistance } = findSupportResistance(priceHistory as any);
  const high52Week = closes.length > 0 ? Math.max(...closes) : price * 1.2;
  const low52Week = closes.length > 0 ? Math.min(...closes) : price * 0.7;
  const avgVolume = priceHistory.length > 0 ? priceHistory.reduce((sum, c) => sum + c.volume, 0) / priceHistory.length : 0;

  // Get fundamentals
  const metrics = financials?.metric || {};
  const fundamentalMetrics: FundamentalMetrics = {
    pe: metrics.peTTM || metrics.peBasicExclExtraTTM || 0,
    pb: metrics.pbAnnual || 0,
    roe: metrics.roeTTM || 0,
    roa: metrics.roaTTM || 0,
    debtEquity: metrics.totalDebtToEquityAnnual || metrics.debtEquityAnnual || 0,
    currentRatio: metrics.currentRatioAnnual || 0,
    profitMargin: metrics.netProfitMarginTTM || 0,
    revenueGrowth: metrics.revenueGrowthTTMYoy || 0,
    epsGrowth: metrics.epsGrowthTTMYoy || 0,
    grossMargin: metrics.grossMarginTTM || 0,
  };

  const technicalInputs: TechnicalInputs = {
    price, sma20, sma50, sma200, ema12, ema26, rsi, macd, bbands, atr,
    previousClose, high52Week, low52Week, avgVolume, currentVolume: 0,
  };

  // Calculate scores
  const fundamentalAnalysis = calculateFundamentalScore(fundamentalMetrics);
  const technicalAnalysis = calculateTechnicalScore(technicalInputs);
  
  // Analyze news, analysts, insiders
  const newsAnalysis = analyzeNewsSentiment(news || [], sentiment);
  const analystAnalysis = analyzeAnalystRatings(recommendations, priceTarget);
  analystAnalysis.targetUpside = analystAnalysis.targetPrice > 0 ? ((analystAnalysis.targetPrice - price) / price) * 100 : 0;
  const insiderAnalysis = analyzeInsiderActivity(insiderTx);
  
  // Generate suggestions
  const suggestions = generateSuggestions(
    fundamentalAnalysis.score,
    technicalAnalysis.score,
    newsAnalysis,
    analystAnalysis,
    insiderAnalysis,
    earnings
  );

  return NextResponse.json({
    ticker,
    name: profile?.name || `${ticker}`,
    exchange: profile?.exchange || 'NASDAQ',
    industry: profile?.finnhubIndustry || '',
    marketCap: profile?.marketCapitalization ? profile.marketCapitalization * 1e6 : 0,
    price: Math.round(price * 100) / 100,
    change: Math.round((q.netChange || 0) * 100) / 100,
    changePercent: Math.round((q.netPercentChange || 0) * 100) / 100,

    fundamentals: {
      pe: Math.round(fundamentalMetrics.pe * 100) / 100,
      pb: Math.round(fundamentalMetrics.pb * 100) / 100,
      roe: Math.round(fundamentalMetrics.roe * 100) / 100,
      roa: Math.round(fundamentalMetrics.roa * 100) / 100,
      debtEquity: Math.round(fundamentalMetrics.debtEquity * 100) / 100,
      profitMargin: Math.round(fundamentalMetrics.profitMargin * 100) / 100,
      grossMargin: Math.round(fundamentalMetrics.grossMargin * 100) / 100,
      revenueGrowth: Math.round(fundamentalMetrics.revenueGrowth * 100) / 100,
      epsGrowth: Math.round(fundamentalMetrics.epsGrowth * 100) / 100,
      currentRatio: Math.round((metrics.currentRatioAnnual || 0) * 100) / 100,
      quickRatio: Math.round((metrics.quickRatioAnnual || 0) * 100) / 100,
      eps: Math.round((metrics.epsBasicExclExtraItemsTTM || 0) * 100) / 100,
      dividendYield: Math.round((metrics.dividendYieldIndicatedAnnual || 0) * 100) / 100,
      beta: Math.round((metrics.beta || 1) * 100) / 100,
      high52Week: Math.round(high52Week * 100) / 100,
      low52Week: Math.round(low52Week * 100) / 100,
    },

    technicals: {
      sma20: Math.round(sma20 * 100) / 100,
      sma50: Math.round(sma50 * 100) / 100,
      sma200: Math.round(sma200 * 100) / 100,
      ema12: Math.round(ema12 * 100) / 100,
      ema26: Math.round(ema26 * 100) / 100,
      rsi: Math.round(rsi),
      macd: Math.round(macd.macd * 1000) / 1000,
      macdSignal: Math.round(macd.signal * 1000) / 1000,
      macdHistogram: Math.round(macd.histogram * 1000) / 1000,
      bollingerUpper: Math.round(bbands.upper * 100) / 100,
      bollingerMiddle: Math.round(bbands.middle * 100) / 100,
      bollingerLower: Math.round(bbands.lower * 100) / 100,
      atr: Math.round(atr * 100) / 100,
      support: Math.round(support * 100) / 100,
      resistance: Math.round(resistance * 100) / 100,
      goldenCross: sma50 > sma200,
      priceVsSma50: Math.round(((price / sma50 - 1) * 100) * 100) / 100,
      priceVsSma200: Math.round(((price / sma200 - 1) * 100) * 100) / 100,
    },

    analysis: {
      fundamental: {
        score: fundamentalAnalysis.score,
        maxScore: fundamentalAnalysis.maxScore,
        rating: fundamentalAnalysis.score >= 7 ? 'STRONG' : fundamentalAnalysis.score >= 5 ? 'GOOD' : fundamentalAnalysis.score >= 3 ? 'FAIR' : 'WEAK',
        factors: fundamentalAnalysis.factors,
      },
      technical: {
        score: technicalAnalysis.score,
        maxScore: technicalAnalysis.maxScore,
        rating: technicalAnalysis.score >= 7 ? 'STRONG_BUY' : technicalAnalysis.score >= 5 ? 'BUY' : technicalAnalysis.score >= 3 ? 'HOLD' : 'SELL',
        factors: technicalAnalysis.factors,
      },
      combined: {
        score: fundamentalAnalysis.score + technicalAnalysis.score,
        maxScore: 18,
        rating: (fundamentalAnalysis.score + technicalAnalysis.score) >= 14 ? 'STRONG_BUY' :
                (fundamentalAnalysis.score + technicalAnalysis.score) >= 11 ? 'BUY' :
                (fundamentalAnalysis.score + technicalAnalysis.score) >= 7 ? 'HOLD' :
                (fundamentalAnalysis.score + technicalAnalysis.score) >= 4 ? 'SELL' : 'STRONG_SELL',
      },
    },

    news: {
      sentiment: newsAnalysis.signal,
      score: newsAnalysis.score,
      buzzwords: newsAnalysis.buzzwords,
      headlines: newsAnalysis.headlines,
    },

    analysts: {
      consensus: analystAnalysis.consensus,
      buyPercent: analystAnalysis.buyPercent,
      distribution: analystAnalysis.distribution,
      targetPrice: Math.round(analystAnalysis.targetPrice * 100) / 100,
      targetUpside: Math.round(analystAnalysis.targetUpside * 100) / 100,
      history: analystAnalysis.recentChanges,
    },

    insiders: {
      netActivity: insiderAnalysis.netActivity,
      buyCount: insiderAnalysis.buyCount,
      sellCount: insiderAnalysis.sellCount,
      recentTransactions: insiderAnalysis.recentTransactions.slice(0, 5),
    },

    earnings: earnings?.earningsCalendar?.[0] ? {
      date: earnings.earningsCalendar[0].date,
      epsEstimate: earnings.earningsCalendar[0].epsEstimate,
      revenueEstimate: earnings.earningsCalendar[0].revenueEstimate,
      hour: earnings.earningsCalendar[0].hour,
    } : null,

    suggestions,

    lastUpdated: new Date().toISOString(),
    dataSource,
    responseTimeMs: Date.now() - startTime,
  });
}
