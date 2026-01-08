import { NextResponse } from 'next/server';

// ============================================================
// STOCK ANALYSIS API - Fundamentals + Technical Analysis
// ============================================================

// Types
interface StockQuote {
  c: number;  // Current price
  d: number;  // Change
  dp: number; // Percent change
  h: number;  // High
  l: number;  // Low
  o: number;  // Open
  pc: number; // Previous close
  t: number;  // Timestamp
}

interface CompanyProfile {
  name: string;
  ticker: string;
  exchange: string;
  industry: string;
  marketCapitalization: number;
  logo: string;
}

interface BasicFinancials {
  metric: {
    '10DayAverageTradingVolume': number;
    '52WeekHigh': number;
    '52WeekLow': number;
    'beta': number;
    'peBasicExclExtraTTM': number;
    'peTTM': number;
    'pbAnnual': number;
    'psAnnual': number;
    'dividendYieldIndicatedAnnual': number;
    'epsBasicExclExtraItemsTTM': number;
    'roeTTM': number;
    'roaTTM': number;
    'currentRatioAnnual': number;
    'quickRatioAnnual': number;
    'debtEquityAnnual': number;
    'netProfitMarginTTM': number;
    'grossMarginTTM': number;
    'revenueGrowthTTMYoy': number;
    'epsGrowthTTMYoy': number;
  };
}

// ============================================================
// FUNDAMENTAL ANALYSIS SCORING LOGIC
// Based on research: PE, PEG, ROE, Debt/Equity, Profit Margin
// ============================================================
function analyzeFundamentals(metrics: BasicFinancials['metric'], price: number) {
  let bullishPoints = 0;
  let bearishPoints = 0;
  const signals: string[] = [];
  const warnings: string[] = [];

  // P/E Ratio Analysis
  const pe = metrics.peTTM || metrics.peBasicExclExtraTTM;
  if (pe) {
    if (pe < 15) {
      bullishPoints += 2;
      signals.push(`Low P/E (${pe.toFixed(1)}) - potentially undervalued`);
    } else if (pe < 25) {
      bullishPoints += 1;
      signals.push(`Reasonable P/E (${pe.toFixed(1)}) - fairly valued`);
    } else if (pe > 40) {
      bearishPoints += 2;
      warnings.push(`High P/E (${pe.toFixed(1)}) - potentially overvalued`);
    } else if (pe > 25) {
      bearishPoints += 1;
      warnings.push(`Elevated P/E (${pe.toFixed(1)}) - priced for growth`);
    }
  }

  // ROE Analysis (Return on Equity)
  const roe = metrics.roeTTM;
  if (roe) {
    if (roe > 20) {
      bullishPoints += 2;
      signals.push(`Strong ROE (${roe.toFixed(1)}%) - efficient capital use`);
    } else if (roe > 15) {
      bullishPoints += 1;
      signals.push(`Good ROE (${roe.toFixed(1)}%) - above average returns`);
    } else if (roe < 10) {
      bearishPoints += 1;
      warnings.push(`Low ROE (${roe.toFixed(1)}%) - weak profitability`);
    }
  }

  // Debt/Equity Analysis
  const debtEquity = metrics.debtEquityAnnual;
  if (debtEquity !== undefined) {
    if (debtEquity < 0.5) {
      bullishPoints += 2;
      signals.push(`Low debt (D/E: ${debtEquity.toFixed(2)}) - financially stable`);
    } else if (debtEquity < 1) {
      bullishPoints += 1;
      signals.push(`Moderate debt (D/E: ${debtEquity.toFixed(2)}) - manageable`);
    } else if (debtEquity > 2) {
      bearishPoints += 2;
      warnings.push(`High debt (D/E: ${debtEquity.toFixed(2)}) - leverage risk`);
    } else if (debtEquity > 1) {
      bearishPoints += 1;
      warnings.push(`Elevated debt (D/E: ${debtEquity.toFixed(2)}) - monitor closely`);
    }
  }

  // Profit Margin Analysis
  const profitMargin = metrics.netProfitMarginTTM;
  if (profitMargin) {
    if (profitMargin > 20) {
      bullishPoints += 2;
      signals.push(`Excellent margins (${profitMargin.toFixed(1)}%) - strong pricing power`);
    } else if (profitMargin > 10) {
      bullishPoints += 1;
      signals.push(`Good margins (${profitMargin.toFixed(1)}%) - healthy business`);
    } else if (profitMargin < 5) {
      bearishPoints += 1;
      warnings.push(`Thin margins (${profitMargin.toFixed(1)}%) - competitive pressure`);
    }
  }

  // Revenue Growth
  const revenueGrowth = metrics.revenueGrowthTTMYoy;
  if (revenueGrowth) {
    if (revenueGrowth > 20) {
      bullishPoints += 2;
      signals.push(`Strong growth (${revenueGrowth.toFixed(1)}% YoY) - expanding business`);
    } else if (revenueGrowth > 10) {
      bullishPoints += 1;
      signals.push(`Solid growth (${revenueGrowth.toFixed(1)}% YoY) - healthy expansion`);
    } else if (revenueGrowth < 0) {
      bearishPoints += 2;
      warnings.push(`Revenue declining (${revenueGrowth.toFixed(1)}% YoY) - concerning`);
    }
  }

  // EPS Growth
  const epsGrowth = metrics.epsGrowthTTMYoy;
  if (epsGrowth) {
    if (epsGrowth > 25) {
      bullishPoints += 2;
      signals.push(`Strong EPS growth (${epsGrowth.toFixed(1)}% YoY)`);
    } else if (epsGrowth > 10) {
      bullishPoints += 1;
      signals.push(`Solid EPS growth (${epsGrowth.toFixed(1)}% YoY)`);
    } else if (epsGrowth < -10) {
      bearishPoints += 2;
      warnings.push(`EPS declining (${epsGrowth.toFixed(1)}% YoY)`);
    }
  }

  // Price to Book
  const pb = metrics.pbAnnual;
  if (pb) {
    if (pb < 1) {
      bullishPoints += 1;
      signals.push(`Trading below book value (P/B: ${pb.toFixed(2)})`);
    } else if (pb > 10) {
      bearishPoints += 1;
      warnings.push(`High P/B ratio (${pb.toFixed(2)}) - premium valuation`);
    }
  }

  // 52-Week Position
  const high52 = metrics['52WeekHigh'];
  const low52 = metrics['52WeekLow'];
  if (high52 && low52 && price) {
    const position = ((price - low52) / (high52 - low52)) * 100;
    if (position < 30) {
      bullishPoints += 1;
      signals.push(`Near 52-week low (${position.toFixed(0)}% of range) - potential value`);
    } else if (position > 90) {
      warnings.push(`Near 52-week high (${position.toFixed(0)}% of range) - extended`);
    }
  }

  const totalPoints = bullishPoints + bearishPoints;
  const score = totalPoints > 0 ? Math.round((bullishPoints / totalPoints) * 100) : 50;

  let fundamentalRating: 'STRONG_BUY' | 'BUY' | 'HOLD' | 'SELL' | 'STRONG_SELL';
  if (score >= 75) fundamentalRating = 'STRONG_BUY';
  else if (score >= 60) fundamentalRating = 'BUY';
  else if (score >= 40) fundamentalRating = 'HOLD';
  else if (score >= 25) fundamentalRating = 'SELL';
  else fundamentalRating = 'STRONG_SELL';

  return {
    score,
    rating: fundamentalRating,
    bullishPoints,
    bearishPoints,
    signals,
    warnings
  };
}

// ============================================================
// TECHNICAL ANALYSIS SCORING LOGIC
// Based on research: RSI, MACD, Moving Averages, Golden/Death Cross
// ============================================================
function analyzeTechnicals(
  price: number,
  sma50: number,
  sma200: number,
  rsi: number,
  macdLine: number,
  macdSignal: number,
  previousClose: number
) {
  let bullishPoints = 0;
  let bearishPoints = 0;
  const signals: string[] = [];
  const warnings: string[] = [];

  // Moving Average Analysis
  if (sma50 && sma200) {
    // Golden Cross / Death Cross
    if (sma50 > sma200) {
      bullishPoints += 2;
      signals.push('Golden Cross active (50 SMA > 200 SMA) - bullish trend');
    } else {
      bearishPoints += 2;
      warnings.push('Death Cross active (50 SMA < 200 SMA) - bearish trend');
    }

    // Price vs Moving Averages
    if (price > sma50 && price > sma200) {
      bullishPoints += 2;
      signals.push('Price above both SMAs - strong uptrend');
    } else if (price < sma50 && price < sma200) {
      bearishPoints += 2;
      warnings.push('Price below both SMAs - strong downtrend');
    } else if (price > sma50) {
      bullishPoints += 1;
      signals.push('Price above 50 SMA - short-term bullish');
    } else if (price > sma200) {
      bullishPoints += 1;
      signals.push('Price above 200 SMA - long-term support holding');
    }
  }

  // RSI Analysis
  if (rsi) {
    if (rsi < 30) {
      bullishPoints += 2;
      signals.push(`RSI oversold (${rsi.toFixed(0)}) - potential bounce`);
    } else if (rsi < 40) {
      bullishPoints += 1;
      signals.push(`RSI approaching oversold (${rsi.toFixed(0)})`);
    } else if (rsi > 70) {
      bearishPoints += 2;
      warnings.push(`RSI overbought (${rsi.toFixed(0)}) - potential pullback`);
    } else if (rsi > 60) {
      bearishPoints += 1;
      warnings.push(`RSI elevated (${rsi.toFixed(0)}) - momentum strong but watch for reversal`);
    } else {
      signals.push(`RSI neutral (${rsi.toFixed(0)}) - no extreme`);
    }
  }

  // MACD Analysis
  if (macdLine !== undefined && macdSignal !== undefined) {
    if (macdLine > macdSignal) {
      bullishPoints += 2;
      signals.push('MACD bullish crossover - momentum increasing');
    } else {
      bearishPoints += 2;
      warnings.push('MACD bearish crossover - momentum decreasing');
    }

    if (macdLine > 0) {
      bullishPoints += 1;
      signals.push('MACD above zero line - bullish territory');
    } else {
      bearishPoints += 1;
      warnings.push('MACD below zero line - bearish territory');
    }
  }

  // Daily Change Momentum
  if (previousClose && price) {
    const dailyChange = ((price - previousClose) / previousClose) * 100;
    if (dailyChange > 3) {
      bullishPoints += 1;
      signals.push(`Strong daily gain (+${dailyChange.toFixed(1)}%)`);
    } else if (dailyChange < -3) {
      bearishPoints += 1;
      warnings.push(`Strong daily loss (${dailyChange.toFixed(1)}%)`);
    }
  }

  const totalPoints = bullishPoints + bearishPoints;
  const score = totalPoints > 0 ? Math.round((bullishPoints / totalPoints) * 100) : 50;

  let technicalRating: 'STRONG_BUY' | 'BUY' | 'HOLD' | 'SELL' | 'STRONG_SELL';
  if (score >= 75) technicalRating = 'STRONG_BUY';
  else if (score >= 60) technicalRating = 'BUY';
  else if (score >= 40) technicalRating = 'HOLD';
  else if (score >= 25) technicalRating = 'SELL';
  else technicalRating = 'STRONG_SELL';

  return {
    score,
    rating: technicalRating,
    bullishPoints,
    bearishPoints,
    signals,
    warnings
  };
}

// ============================================================
// GENERATE TRADE SUGGESTIONS
// ============================================================
function generateSuggestions(
  fundamentalScore: number,
  technicalScore: number,
  price: number,
  ticker: string
) {
  const combinedScore = (fundamentalScore + technicalScore) / 2;
  const suggestions: Array<{
    type: 'BUY' | 'SELL' | 'HOLD' | 'ALERT';
    strategy: string;
    confidence: number;
    reasoning: string[];
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  }> = [];

  if (combinedScore >= 70) {
    suggestions.push({
      type: 'BUY',
      strategy: 'Strong Buy Signal',
      confidence: Math.min(combinedScore, 95),
      reasoning: [
        'Fundamentals and technicals aligned bullish',
        `Combined score: ${combinedScore.toFixed(0)}%`,
        'Consider entering position'
      ],
      riskLevel: 'LOW'
    });
  } else if (combinedScore >= 55) {
    suggestions.push({
      type: 'BUY',
      strategy: 'Moderate Buy Signal',
      confidence: combinedScore,
      reasoning: [
        'Slightly bullish bias overall',
        `Combined score: ${combinedScore.toFixed(0)}%`,
        'Consider smaller position size'
      ],
      riskLevel: 'MEDIUM'
    });
  } else if (combinedScore <= 30) {
    suggestions.push({
      type: 'SELL',
      strategy: 'Strong Sell Signal',
      confidence: 100 - combinedScore,
      reasoning: [
        'Both fundamentals and technicals bearish',
        `Combined score: ${combinedScore.toFixed(0)}%`,
        'Consider reducing exposure'
      ],
      riskLevel: 'HIGH'
    });
  } else if (combinedScore <= 45) {
    suggestions.push({
      type: 'SELL',
      strategy: 'Moderate Sell Signal',
      confidence: 100 - combinedScore,
      reasoning: [
        'Slightly bearish bias overall',
        `Combined score: ${combinedScore.toFixed(0)}%`,
        'Consider taking profits'
      ],
      riskLevel: 'MEDIUM'
    });
  } else {
    suggestions.push({
      type: 'HOLD',
      strategy: 'Neutral - Hold Position',
      confidence: 50,
      reasoning: [
        'Mixed signals - no clear direction',
        `Combined score: ${combinedScore.toFixed(0)}%`,
        'Wait for clearer setup'
      ],
      riskLevel: 'MEDIUM'
    });
  }

  // Add divergence alert if applicable
  if (Math.abs(fundamentalScore - technicalScore) > 30) {
    suggestions.push({
      type: 'ALERT',
      strategy: 'Fundamental/Technical Divergence',
      confidence: 0,
      reasoning: [
        `Fundamentals: ${fundamentalScore}% vs Technicals: ${technicalScore}%`,
        'Significant divergence detected',
        'Exercise extra caution'
      ],
      riskLevel: 'HIGH'
    });
  }

  return suggestions;
}

// ============================================================
// MOCK DATA GENERATOR (for when APIs are unavailable)
// ============================================================
function generateMockData(ticker: string) {
  const basePrice = ticker === 'AAPL' ? 260.33 : ticker === 'TSLA' ? 248.50 : ticker === 'NVDA' ? 138.25 : ticker === 'MSFT' ? 420.15 : ticker === 'GOOGL' ? 175.80 : 100 + Math.random() * 200;
  const change = (Math.random() * 10 - 5);
  const price = basePrice + change;

  // Generate realistic technical indicators
  const sma50 = price * (0.95 + Math.random() * 0.1);
  const sma200 = price * (0.9 + Math.random() * 0.2);
  const rsi = 30 + Math.random() * 40;
  const macdLine = (Math.random() - 0.5) * 5;
  const macdSignal = macdLine + (Math.random() - 0.5) * 2;

  // Generate realistic fundamentals
  const metrics = {
    peTTM: 15 + Math.random() * 25,
    pbAnnual: 2 + Math.random() * 8,
    psAnnual: 3 + Math.random() * 7,
    roeTTM: 10 + Math.random() * 20,
    roaTTM: 5 + Math.random() * 15,
    debtEquityAnnual: Math.random() * 2,
    netProfitMarginTTM: 5 + Math.random() * 20,
    grossMarginTTM: 20 + Math.random() * 40,
    revenueGrowthTTMYoy: -5 + Math.random() * 30,
    epsGrowthTTMYoy: -10 + Math.random() * 40,
    '52WeekHigh': price * 1.2,
    '52WeekLow': price * 0.7,
    beta: 0.8 + Math.random() * 0.8,
    dividendYieldIndicatedAnnual: Math.random() * 3,
    epsBasicExclExtraItemsTTM: 3 + Math.random() * 10,
    currentRatioAnnual: 1 + Math.random() * 2,
    quickRatioAnnual: 0.8 + Math.random() * 1.5,
  };

  const fundamentalAnalysis = analyzeFundamentals(metrics as any, price);
  const technicalAnalysis = analyzeTechnicals(price, sma50, sma200, rsi, macdLine, macdSignal, basePrice);
  const suggestions = generateSuggestions(fundamentalAnalysis.score, technicalAnalysis.score, price, ticker);

  return {
    ticker,
    name: ticker === 'AAPL' ? 'Apple Inc.' : ticker === 'TSLA' ? 'Tesla, Inc.' : ticker === 'NVDA' ? 'NVIDIA Corporation' : ticker === 'MSFT' ? 'Microsoft Corporation' : ticker === 'GOOGL' ? 'Alphabet Inc.' : `${ticker} Corporation`,
    exchange: 'NASDAQ',
    price: parseFloat(price.toFixed(2)),
    change: parseFloat(change.toFixed(2)),
    changePercent: parseFloat(((change / basePrice) * 100).toFixed(2)),
    high: parseFloat((price * 1.02).toFixed(2)),
    low: parseFloat((price * 0.98).toFixed(2)),
    open: parseFloat(basePrice.toFixed(2)),
    previousClose: parseFloat(basePrice.toFixed(2)),
    volume: Math.floor(50000000 + Math.random() * 50000000),
    marketCap: Math.floor(1000000000 + Math.random() * 3000000000000),

    // Fundamentals
    fundamentals: {
      pe: parseFloat(metrics.peTTM.toFixed(2)),
      pb: parseFloat(metrics.pbAnnual.toFixed(2)),
      ps: parseFloat(metrics.psAnnual.toFixed(2)),
      roe: parseFloat(metrics.roeTTM.toFixed(2)),
      roa: parseFloat(metrics.roaTTM.toFixed(2)),
      debtEquity: parseFloat(metrics.debtEquityAnnual.toFixed(2)),
      profitMargin: parseFloat(metrics.netProfitMarginTTM.toFixed(2)),
      grossMargin: parseFloat(metrics.grossMarginTTM.toFixed(2)),
      revenueGrowth: parseFloat(metrics.revenueGrowthTTMYoy.toFixed(2)),
      epsGrowth: parseFloat(metrics.epsGrowthTTMYoy.toFixed(2)),
      eps: parseFloat(metrics.epsBasicExclExtraItemsTTM.toFixed(2)),
      beta: parseFloat(metrics.beta.toFixed(2)),
      dividendYield: parseFloat(metrics.dividendYieldIndicatedAnnual.toFixed(2)),
      high52Week: parseFloat(metrics['52WeekHigh'].toFixed(2)),
      low52Week: parseFloat(metrics['52WeekLow'].toFixed(2)),
      currentRatio: parseFloat(metrics.currentRatioAnnual.toFixed(2)),
      quickRatio: parseFloat(metrics.quickRatioAnnual.toFixed(2)),
    },

    // Technicals
    technicals: {
      sma50: parseFloat(sma50.toFixed(2)),
      sma200: parseFloat(sma200.toFixed(2)),
      rsi: parseFloat(rsi.toFixed(2)),
      macdLine: parseFloat(macdLine.toFixed(4)),
      macdSignal: parseFloat(macdSignal.toFixed(4)),
      macdHistogram: parseFloat((macdLine - macdSignal).toFixed(4)),
      goldenCross: sma50 > sma200,
      priceVsSma50: parseFloat(((price / sma50 - 1) * 100).toFixed(2)),
      priceVsSma200: parseFloat(((price / sma200 - 1) * 100).toFixed(2)),
    },

    // Analysis Results
    analysis: {
      fundamental: fundamentalAnalysis,
      technical: technicalAnalysis,
      combined: {
        score: Math.round((fundamentalAnalysis.score + technicalAnalysis.score) / 2),
        rating: fundamentalAnalysis.score + technicalAnalysis.score >= 120 ? 'STRONG_BUY' :
                fundamentalAnalysis.score + technicalAnalysis.score >= 100 ? 'BUY' :
                fundamentalAnalysis.score + technicalAnalysis.score >= 80 ? 'HOLD' :
                fundamentalAnalysis.score + technicalAnalysis.score >= 60 ? 'SELL' : 'STRONG_SELL'
      }
    },

    suggestions,

    // Metadata
    lastUpdated: new Date().toISOString(),
    dataSource: 'mock'
  };
}

// ============================================================
// API HANDLER
// ============================================================
export async function GET(
  request: Request,
  { params }: { params: { ticker: string } }
) {
  const ticker = params.ticker.toUpperCase();
  const finnhubKey = process.env.FINNHUB_API_KEY;

  // If no API key, return mock data
  if (!finnhubKey) {
    const data = generateMockData(ticker);
    return NextResponse.json(data);
  }

  try {
    // Fetch real data from Finnhub
    const [quoteRes, profileRes, metricsRes] = await Promise.all([
      fetch(`https://finnhub.io/api/v1/quote?symbol=${ticker}&token=${finnhubKey}`),
      fetch(`https://finnhub.io/api/v1/stock/profile2?symbol=${ticker}&token=${finnhubKey}`),
      fetch(`https://finnhub.io/api/v1/stock/metric?symbol=${ticker}&metric=all&token=${finnhubKey}`)
    ]);

    if (!quoteRes.ok) {
      throw new Error('Failed to fetch quote');
    }

    const quote: StockQuote = await quoteRes.json();
    const profile: CompanyProfile = await profileRes.json();
    const metricsData: BasicFinancials = await metricsRes.json();

    // If quote is empty (invalid ticker), return error
    if (!quote.c) {
      return NextResponse.json({ error: 'Invalid ticker or no data available' }, { status: 404 });
    }

    const price = quote.c;
    const metrics = metricsData.metric || {};

    // Generate technical indicators (mock for now - would need separate API)
    const sma50 = price * (0.95 + Math.random() * 0.1);
    const sma200 = price * (0.9 + Math.random() * 0.2);
    const rsi = 30 + Math.random() * 40;
    const macdLine = (Math.random() - 0.5) * 5;
    const macdSignal = macdLine + (Math.random() - 0.5) * 2;

    const fundamentalAnalysis = analyzeFundamentals(metrics as any, price);
    const technicalAnalysis = analyzeTechnicals(price, sma50, sma200, rsi, macdLine, macdSignal, quote.pc);
    const suggestions = generateSuggestions(fundamentalAnalysis.score, technicalAnalysis.score, price, ticker);

    const data = {
      ticker,
      name: profile.name || `${ticker}`,
      exchange: profile.exchange || 'UNKNOWN',
      price: quote.c,
      change: quote.d,
      changePercent: quote.dp,
      high: quote.h,
      low: quote.l,
      open: quote.o,
      previousClose: quote.pc,
      volume: metrics['10DayAverageTradingVolume'] ? Math.floor(metrics['10DayAverageTradingVolume'] * 1000000) : 0,
      marketCap: profile.marketCapitalization ? profile.marketCapitalization * 1000000 : 0,

      fundamentals: {
        pe: metrics.peTTM || metrics.peBasicExclExtraTTM || 0,
        pb: metrics.pbAnnual || 0,
        ps: metrics.psAnnual || 0,
        roe: metrics.roeTTM || 0,
        roa: metrics.roaTTM || 0,
        debtEquity: metrics.debtEquityAnnual || 0,
        profitMargin: metrics.netProfitMarginTTM || 0,
        grossMargin: metrics.grossMarginTTM || 0,
        revenueGrowth: metrics.revenueGrowthTTMYoy || 0,
        epsGrowth: metrics.epsGrowthTTMYoy || 0,
        eps: metrics.epsBasicExclExtraItemsTTM || 0,
        beta: metrics.beta || 0,
        dividendYield: metrics.dividendYieldIndicatedAnnual || 0,
        high52Week: metrics['52WeekHigh'] || 0,
        low52Week: metrics['52WeekLow'] || 0,
        currentRatio: metrics.currentRatioAnnual || 0,
        quickRatio: metrics.quickRatioAnnual || 0,
      },

      technicals: {
        sma50: parseFloat(sma50.toFixed(2)),
        sma200: parseFloat(sma200.toFixed(2)),
        rsi: parseFloat(rsi.toFixed(2)),
        macdLine: parseFloat(macdLine.toFixed(4)),
        macdSignal: parseFloat(macdSignal.toFixed(4)),
        macdHistogram: parseFloat((macdLine - macdSignal).toFixed(4)),
        goldenCross: sma50 > sma200,
        priceVsSma50: parseFloat(((price / sma50 - 1) * 100).toFixed(2)),
        priceVsSma200: parseFloat(((price / sma200 - 1) * 100).toFixed(2)),
      },

      analysis: {
        fundamental: fundamentalAnalysis,
        technical: technicalAnalysis,
        combined: {
          score: Math.round((fundamentalAnalysis.score + technicalAnalysis.score) / 2),
          rating: fundamentalAnalysis.score + technicalAnalysis.score >= 120 ? 'STRONG_BUY' :
                  fundamentalAnalysis.score + technicalAnalysis.score >= 100 ? 'BUY' :
                  fundamentalAnalysis.score + technicalAnalysis.score >= 80 ? 'HOLD' :
                  fundamentalAnalysis.score + technicalAnalysis.score >= 60 ? 'SELL' : 'STRONG_SELL'
        }
      },

      suggestions,

      lastUpdated: new Date().toISOString(),
      dataSource: 'finnhub'
    };

    return NextResponse.json(data);

  } catch (error) {
    console.error('Error fetching stock data:', error);
    // Fallback to mock data on error
    const data = generateMockData(ticker);
    return NextResponse.json(data);
  }
}
