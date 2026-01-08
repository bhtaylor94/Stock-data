import { NextResponse } from 'next/server';

// ============================================================
// DETERMINISTIC STOCK ANALYSIS API
// Uses Piotroski F-Score style binary scoring (no randomness)
// All scores are 100% reproducible with same input data
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

// ============================================================
// PIOTROSKI-STYLE FUNDAMENTAL SCORE (0-9 scale, deterministic)
// Each criterion is BINARY: 1 point if met, 0 if not
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
  rating: string;
  factors: { name: string; passed: boolean; value: string; threshold: string }[];
} {
  const factors: { name: string; passed: boolean; value: string; threshold: string }[] = [];
  
  // Profitability (3 points max)
  // 1. Positive ROE (> 0%)
  const roePass = metrics.roe > 0;
  factors.push({ name: 'Positive ROE', passed: roePass, value: `${metrics.roe?.toFixed(1)}%`, threshold: '> 0%' });
  
  // 2. Positive ROA (> 0%)
  const roaPass = metrics.roa > 0;
  factors.push({ name: 'Positive ROA', passed: roaPass, value: `${metrics.roa?.toFixed(1)}%`, threshold: '> 0%' });
  
  // 3. Positive Profit Margin (> 0%)
  const marginPass = metrics.profitMargin > 0;
  factors.push({ name: 'Positive Margin', passed: marginPass, value: `${metrics.profitMargin?.toFixed(1)}%`, threshold: '> 0%' });

  // Leverage/Liquidity (3 points max)
  // 4. Low Debt/Equity (< 1.0)
  const debtPass = metrics.debtEquity < 1.0;
  factors.push({ name: 'Low Debt/Equity', passed: debtPass, value: metrics.debtEquity?.toFixed(2), threshold: '< 1.0' });
  
  // 5. Current Ratio > 1 (can pay short-term debts)
  const currentPass = metrics.currentRatio > 1.0;
  factors.push({ name: 'Current Ratio > 1', passed: currentPass, value: metrics.currentRatio?.toFixed(2), threshold: '> 1.0' });
  
  // 6. Reasonable P/E (< 30)
  const pePass = metrics.pe > 0 && metrics.pe < 30;
  factors.push({ name: 'Reasonable P/E', passed: pePass, value: metrics.pe?.toFixed(1), threshold: '0-30' });

  // Growth (3 points max)
  // 7. Positive Revenue Growth
  const revGrowthPass = metrics.revenueGrowth > 0;
  factors.push({ name: 'Revenue Growing', passed: revGrowthPass, value: `${metrics.revenueGrowth?.toFixed(1)}%`, threshold: '> 0%' });
  
  // 8. Positive EPS Growth
  const epsGrowthPass = metrics.epsGrowth > 0;
  factors.push({ name: 'EPS Growing', passed: epsGrowthPass, value: `${metrics.epsGrowth?.toFixed(1)}%`, threshold: '> 0%' });
  
  // 9. Strong Gross Margin (> 20%)
  const grossPass = metrics.grossMargin > 20;
  factors.push({ name: 'Strong Gross Margin', passed: grossPass, value: `${metrics.grossMargin?.toFixed(1)}%`, threshold: '> 20%' });

  const score = factors.filter(f => f.passed).length;
  const maxScore = 9;
  
  // Rating based on Piotroski scale
  let rating: string;
  if (score >= 8) rating = 'STRONG';
  else if (score >= 6) rating = 'GOOD';
  else if (score >= 4) rating = 'FAIR';
  else if (score >= 2) rating = 'WEAK';
  else rating = 'POOR';

  return { score, maxScore, rating, factors };
}

// ============================================================
// TECHNICAL SCORE (0-9 scale, deterministic)
// Each criterion is BINARY: 1 point if met, 0 if not
// ============================================================
interface TechnicalMetrics {
  price: number;
  sma20: number;
  sma50: number;
  sma200: number;
  rsi: number;
  previousClose: number;
  high52Week: number;
  low52Week: number;
}

function calculateTechnicalScore(metrics: TechnicalMetrics): {
  score: number;
  maxScore: number;
  rating: string;
  factors: { name: string; passed: boolean; value: string; threshold: string }[];
} {
  const factors: { name: string; passed: boolean; value: string; threshold: string }[] = [];
  const { price, sma20, sma50, sma200, rsi, previousClose, high52Week, low52Week } = metrics;

  // Trend (3 points max)
  // 1. Price above 20 SMA (short-term trend)
  const above20 = price > sma20;
  factors.push({ name: 'Above 20 SMA', passed: above20, value: `$${price.toFixed(2)}`, threshold: `> $${sma20.toFixed(2)}` });
  
  // 2. Price above 50 SMA (medium-term trend)
  const above50 = price > sma50;
  factors.push({ name: 'Above 50 SMA', passed: above50, value: `$${price.toFixed(2)}`, threshold: `> $${sma50.toFixed(2)}` });
  
  // 3. Price above 200 SMA (long-term trend)
  const above200 = price > sma200;
  factors.push({ name: 'Above 200 SMA', passed: above200, value: `$${price.toFixed(2)}`, threshold: `> $${sma200.toFixed(2)}` });

  // Momentum (3 points max)
  // 4. Golden Cross (50 SMA > 200 SMA)
  const goldenCross = sma50 > sma200;
  factors.push({ name: 'Golden Cross', passed: goldenCross, value: `50SMA: $${sma50.toFixed(2)}`, threshold: `> 200SMA: $${sma200.toFixed(2)}` });
  
  // 5. RSI not overbought (< 70)
  const rsiNotOverbought = rsi < 70;
  factors.push({ name: 'RSI < 70', passed: rsiNotOverbought, value: rsi.toFixed(0), threshold: '< 70' });
  
  // 6. RSI not oversold (> 30)
  const rsiNotOversold = rsi > 30;
  factors.push({ name: 'RSI > 30', passed: rsiNotOversold, value: rsi.toFixed(0), threshold: '> 30' });

  // Position (3 points max)
  // 7. Positive daily change
  const positiveDay = price > previousClose;
  const dailyChange = ((price - previousClose) / previousClose) * 100;
  factors.push({ name: 'Positive Day', passed: positiveDay, value: `${dailyChange >= 0 ? '+' : ''}${dailyChange.toFixed(2)}%`, threshold: '> 0%' });
  
  // 8. Above 52-week midpoint
  const midpoint = (high52Week + low52Week) / 2;
  const aboveMid = price > midpoint;
  factors.push({ name: 'Above 52w Mid', passed: aboveMid, value: `$${price.toFixed(2)}`, threshold: `> $${midpoint.toFixed(2)}` });
  
  // 9. Within 20% of 52-week high
  const nearHigh = price >= high52Week * 0.8;
  const pctFromHigh = ((price - high52Week) / high52Week) * 100;
  factors.push({ name: 'Near 52w High', passed: nearHigh, value: `${pctFromHigh.toFixed(1)}%`, threshold: '> -20%' });

  const score = factors.filter(f => f.passed).length;
  const maxScore = 9;
  
  let rating: string;
  if (score >= 8) rating = 'STRONG_BUY';
  else if (score >= 6) rating = 'BUY';
  else if (score >= 4) rating = 'HOLD';
  else if (score >= 2) rating = 'SELL';
  else rating = 'STRONG_SELL';

  return { score, maxScore, rating, factors };
}

// ============================================================
// GENERATE DETERMINISTIC SUGGESTIONS
// ============================================================
function generateSuggestions(
  fundamentalScore: number,
  technicalScore: number,
  fundamentalFactors: { name: string; passed: boolean }[],
  technicalFactors: { name: string; passed: boolean }[]
) {
  const suggestions: Array<{
    type: 'BUY' | 'SELL' | 'HOLD' | 'ALERT';
    strategy: string;
    confidence: number;
    reasoning: string[];
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  }> = [];

  const combinedScore = fundamentalScore + technicalScore; // 0-18
  const bullishFactors = fundamentalFactors.filter(f => f.passed).map(f => f.name);
  const bearishFactors = fundamentalFactors.filter(f => !f.passed).map(f => f.name);
  const techBullish = technicalFactors.filter(f => f.passed).map(f => f.name);
  const techBearish = technicalFactors.filter(f => !f.passed).map(f => f.name);

  // Strong Buy: 14+ points (78%+)
  if (combinedScore >= 14) {
    suggestions.push({
      type: 'BUY',
      strategy: 'Strong Buy',
      confidence: Math.round((combinedScore / 18) * 100),
      reasoning: [
        `Fundamental Score: ${fundamentalScore}/9`,
        `Technical Score: ${technicalScore}/9`,
        `Combined: ${combinedScore}/18 (${Math.round((combinedScore/18)*100)}%)`,
        `Key Strengths: ${bullishFactors.slice(0, 3).join(', ')}`,
      ],
      riskLevel: 'LOW'
    });
  }
  // Buy: 11-13 points (61-72%)
  else if (combinedScore >= 11) {
    suggestions.push({
      type: 'BUY',
      strategy: 'Buy',
      confidence: Math.round((combinedScore / 18) * 100),
      reasoning: [
        `Fundamental Score: ${fundamentalScore}/9`,
        `Technical Score: ${technicalScore}/9`,
        `Combined: ${combinedScore}/18 (${Math.round((combinedScore/18)*100)}%)`,
        `Watch: ${bearishFactors.slice(0, 2).join(', ') || 'None'}`,
      ],
      riskLevel: 'MEDIUM'
    });
  }
  // Hold: 7-10 points (39-56%)
  else if (combinedScore >= 7) {
    suggestions.push({
      type: 'HOLD',
      strategy: 'Hold / Neutral',
      confidence: Math.round((combinedScore / 18) * 100),
      reasoning: [
        `Fundamental Score: ${fundamentalScore}/9`,
        `Technical Score: ${technicalScore}/9`,
        `Mixed signals - wait for clearer direction`,
        `Concerns: ${bearishFactors.slice(0, 2).join(', ')}`,
      ],
      riskLevel: 'MEDIUM'
    });
  }
  // Sell: 4-6 points (22-33%)
  else if (combinedScore >= 4) {
    suggestions.push({
      type: 'SELL',
      strategy: 'Sell / Reduce',
      confidence: Math.round(((18 - combinedScore) / 18) * 100),
      reasoning: [
        `Fundamental Score: ${fundamentalScore}/9`,
        `Technical Score: ${technicalScore}/9`,
        `Multiple warning signs present`,
        `Issues: ${bearishFactors.slice(0, 3).join(', ')}`,
      ],
      riskLevel: 'HIGH'
    });
  }
  // Strong Sell: 0-3 points (<22%)
  else {
    suggestions.push({
      type: 'SELL',
      strategy: 'Strong Sell',
      confidence: Math.round(((18 - combinedScore) / 18) * 100),
      reasoning: [
        `Fundamental Score: ${fundamentalScore}/9`,
        `Technical Score: ${technicalScore}/9`,
        `Severe fundamental and technical weakness`,
        `Major Issues: ${bearishFactors.slice(0, 3).join(', ')}`,
      ],
      riskLevel: 'HIGH'
    });
  }

  // Add divergence alert if scores differ significantly
  if (Math.abs(fundamentalScore - technicalScore) >= 4) {
    suggestions.push({
      type: 'ALERT',
      strategy: 'Divergence Warning',
      confidence: 0,
      reasoning: [
        `Fundamental: ${fundamentalScore}/9 vs Technical: ${technicalScore}/9`,
        fundamentalScore > technicalScore 
          ? 'Fundamentals strong but price action weak'
          : 'Price action strong but fundamentals weak',
        'Consider both factors before trading',
      ],
      riskLevel: 'HIGH'
    });
  }

  return suggestions;
}

// ============================================================
// FETCH LIVE DATA FROM SCHWAB
// ============================================================
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

async function fetchSchwabPriceHistory(token: string, symbol: string): Promise<number[]> {
  try {
    const res = await fetch(`https://api.schwabapi.com/marketdata/v1/pricehistory?symbol=${symbol}&periodType=year&period=1&frequencyType=daily&frequency=1`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.candles || []).map((c: any) => c.close);
  } catch { return []; }
}

// ============================================================
// CALCULATE SMAs FROM PRICE HISTORY
// ============================================================
function calculateSMA(prices: number[], period: number): number {
  if (prices.length < period) return prices[prices.length - 1] || 0;
  const slice = prices.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / period;
}

function calculateRSI(prices: number[], period = 14): number {
  if (prices.length < period + 1) return 50;
  
  const changes = [];
  for (let i = prices.length - period; i < prices.length; i++) {
    changes.push(prices[i] - prices[i - 1]);
  }
  
  let gains = 0, losses = 0;
  for (const change of changes) {
    if (change > 0) gains += change;
    else losses += Math.abs(change);
  }
  
  const avgGain = gains / period;
  const avgLoss = losses / period;
  
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

// ============================================================
// MAIN API HANDLER
// ============================================================
export async function GET(
  request: Request,
  { params }: { params: { ticker: string } }
) {
  const ticker = params.ticker.toUpperCase();
  
  let dataSource = 'none';
  let quote: any = null;
  let priceHistory: number[] = [];
  let fundamentalsData: any = null;

  // Try Schwab first for real-time data
  const schwabToken = await getSchwabToken();
  if (schwabToken) {
    quote = await fetchSchwabQuote(schwabToken, ticker);
    priceHistory = await fetchSchwabPriceHistory(schwabToken, ticker);
    if (quote) dataSource = 'schwab';
  }

  // Fallback to Finnhub for fundamentals
  if (FINNHUB_KEY) {
    try {
      const [quoteRes, metricsRes, profileRes] = await Promise.all([
        !quote ? fetch(`https://finnhub.io/api/v1/quote?symbol=${ticker}&token=${FINNHUB_KEY}`) : Promise.resolve(null),
        fetch(`https://finnhub.io/api/v1/stock/metric?symbol=${ticker}&metric=all&token=${FINNHUB_KEY}`),
        fetch(`https://finnhub.io/api/v1/stock/profile2?symbol=${ticker}&token=${FINNHUB_KEY}`),
      ]);

      if (quoteRes && quoteRes.ok && !quote) {
        const data = await quoteRes.json();
        if (data.c > 0) {
          quote = {
            quote: {
              lastPrice: data.c,
              netChange: data.d,
              netPercentChange: data.dp,
              highPrice: data.h,
              lowPrice: data.l,
              openPrice: data.o,
              closePrice: data.pc,
            }
          };
          dataSource = 'finnhub';
        }
      }

      if (metricsRes.ok) {
        fundamentalsData = await metricsRes.json();
      }
    } catch (e) {
      console.log('Finnhub error:', e);
    }
  }

  // If no data at all, return error
  if (!quote || !quote.quote) {
    return NextResponse.json({
      error: 'Unable to fetch stock data',
      ticker,
      instructions: [
        'Ensure SCHWAB_APP_KEY, SCHWAB_APP_SECRET, SCHWAB_REFRESH_TOKEN are set',
        'Or ensure FINNHUB_API_KEY is set',
        'Refresh tokens expire every 7 days',
      ],
    }, { status: 200 });
  }

  const q = quote.quote;
  const price = q.lastPrice || q.mark || 0;
  const previousClose = q.closePrice || price;
  
  // Calculate technical indicators from price history
  const sma20 = priceHistory.length >= 20 ? calculateSMA(priceHistory, 20) : price * 0.98;
  const sma50 = priceHistory.length >= 50 ? calculateSMA(priceHistory, 50) : price * 0.95;
  const sma200 = priceHistory.length >= 200 ? calculateSMA(priceHistory, 200) : price * 0.90;
  const rsi = priceHistory.length >= 15 ? calculateRSI(priceHistory) : 50;
  const high52Week = priceHistory.length > 0 ? Math.max(...priceHistory) : price * 1.2;
  const low52Week = priceHistory.length > 0 ? Math.min(...priceHistory) : price * 0.7;

  // Get fundamentals
  const metrics = fundamentalsData?.metric || {};
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

  const technicalMetrics: TechnicalMetrics = {
    price,
    sma20,
    sma50,
    sma200,
    rsi,
    previousClose,
    high52Week,
    low52Week,
  };

  // Calculate scores
  const fundamentalAnalysis = calculateFundamentalScore(fundamentalMetrics);
  const technicalAnalysis = calculateTechnicalScore(technicalMetrics);
  const suggestions = generateSuggestions(
    fundamentalAnalysis.score,
    technicalAnalysis.score,
    fundamentalAnalysis.factors,
    technicalAnalysis.factors
  );

  // Build response
  return NextResponse.json({
    ticker,
    name: quote.reference?.description || `${ticker}`,
    exchange: quote.reference?.exchange || 'NASDAQ',
    price: parseFloat(price.toFixed(2)),
    change: parseFloat((q.netChange || 0).toFixed(2)),
    changePercent: parseFloat((q.netPercentChange || 0).toFixed(2)),

    fundamentals: {
      pe: parseFloat(fundamentalMetrics.pe.toFixed(2)),
      pb: parseFloat(fundamentalMetrics.pb.toFixed(2)),
      roe: parseFloat(fundamentalMetrics.roe.toFixed(2)),
      roa: parseFloat(fundamentalMetrics.roa.toFixed(2)),
      debtEquity: parseFloat(fundamentalMetrics.debtEquity.toFixed(2)),
      profitMargin: parseFloat(fundamentalMetrics.profitMargin.toFixed(2)),
      revenueGrowth: parseFloat(fundamentalMetrics.revenueGrowth.toFixed(2)),
      epsGrowth: parseFloat(fundamentalMetrics.epsGrowth.toFixed(2)),
      high52Week: parseFloat(high52Week.toFixed(2)),
      low52Week: parseFloat(low52Week.toFixed(2)),
      beta: parseFloat((metrics.beta || 1).toFixed(2)),
    },

    technicals: {
      sma50: parseFloat(sma50.toFixed(2)),
      sma200: parseFloat(sma200.toFixed(2)),
      rsi: parseFloat(rsi.toFixed(2)),
      macdLine: 0,
      macdSignal: 0,
      goldenCross: sma50 > sma200,
      priceVsSma50: parseFloat(((price / sma50 - 1) * 100).toFixed(2)),
      priceVsSma200: parseFloat(((price / sma200 - 1) * 100).toFixed(2)),
    },

    analysis: {
      fundamental: {
        score: fundamentalAnalysis.score,
        maxScore: fundamentalAnalysis.maxScore,
        rating: fundamentalAnalysis.rating,
        factors: fundamentalAnalysis.factors,
        signals: fundamentalAnalysis.factors.filter(f => f.passed).map(f => `✓ ${f.name}: ${f.value}`),
        warnings: fundamentalAnalysis.factors.filter(f => !f.passed).map(f => `✗ ${f.name}: ${f.value} (needs ${f.threshold})`),
      },
      technical: {
        score: technicalAnalysis.score,
        maxScore: technicalAnalysis.maxScore,
        rating: technicalAnalysis.rating,
        factors: technicalAnalysis.factors,
        signals: technicalAnalysis.factors.filter(f => f.passed).map(f => `✓ ${f.name}: ${f.value}`),
        warnings: technicalAnalysis.factors.filter(f => !f.passed).map(f => `✗ ${f.name}: ${f.value} (needs ${f.threshold})`),
      },
      combined: {
        score: fundamentalAnalysis.score + technicalAnalysis.score,
        maxScore: 18,
        rating: fundamentalAnalysis.score + technicalAnalysis.score >= 14 ? 'STRONG_BUY' :
                fundamentalAnalysis.score + technicalAnalysis.score >= 11 ? 'BUY' :
                fundamentalAnalysis.score + technicalAnalysis.score >= 7 ? 'HOLD' :
                fundamentalAnalysis.score + technicalAnalysis.score >= 4 ? 'SELL' : 'STRONG_SELL',
      }
    },

    suggestions,

    lastUpdated: new Date().toISOString(),
    dataSource,
  });
}
