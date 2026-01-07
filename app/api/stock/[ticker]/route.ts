import { NextRequest, NextResponse } from 'next/server';

const POLYGON_KEY = process.env.POLYGON_API_KEY;
const FINNHUB_KEY = process.env.FINNHUB_API_KEY;

export async function GET(
  request: NextRequest,
  { params }: { params: { ticker: string } }
) {
  const ticker = params.ticker.toUpperCase();
  
  try {
    // Fetch from multiple sources in parallel
    const [finnhubQuote, finnhubProfile, finnhubMetrics, polygonDetails, polygonPrevClose] = await Promise.all([
      // Finnhub: Real-time quote (free tier)
      fetch(`https://finnhub.io/api/v1/quote?symbol=${ticker}&token=${FINNHUB_KEY}`)
        .then(r => r.ok ? r.json() : null)
        .catch(() => null),
      
      // Finnhub: Company profile
      fetch(`https://finnhub.io/api/v1/stock/profile2?symbol=${ticker}&token=${FINNHUB_KEY}`)
        .then(r => r.ok ? r.json() : null)
        .catch(() => null),
      
      // Finnhub: Basic financials (PE, margins, etc)
      fetch(`https://finnhub.io/api/v1/stock/metric?symbol=${ticker}&metric=all&token=${FINNHUB_KEY}`)
        .then(r => r.ok ? r.json() : null)
        .catch(() => null),
      
      // Polygon: Ticker details (market cap, description)
      fetch(`https://api.polygon.io/v3/reference/tickers/${ticker}?apiKey=${POLYGON_KEY}`)
        .then(r => r.ok ? r.json() : null)
        .catch(() => null),
      
      // Polygon: Previous day close with volume
      fetch(`https://api.polygon.io/v2/aggs/ticker/${ticker}/prev?adjusted=true&apiKey=${POLYGON_KEY}`)
        .then(r => r.ok ? r.json() : null)
        .catch(() => null),
    ]);

    // Extract Finnhub quote data
    const quote = finnhubQuote || {};
    const profile = finnhubProfile || {};
    const metrics = finnhubMetrics?.metric || {};
    
    // Extract Polygon data
    const details = polygonDetails?.results || {};
    const prevClose = polygonPrevClose?.results?.[0] || {};

    // Combine into unified response
    const stockData = {
      ticker,
      name: profile.name || details.name || ticker,
      exchange: profile.exchange || details.primary_exchange || 'N/A',
      industry: profile.finnhubIndustry || details.sic_description || 'N/A',
      
      // Price data (prefer Finnhub for real-time)
      price: quote.c || prevClose.c || 0,
      change: quote.d || (prevClose.c && prevClose.o ? prevClose.c - prevClose.o : 0),
      changePercent: quote.dp || 0,
      open: quote.o || prevClose.o || 0,
      high: quote.h || prevClose.h || 0,
      low: quote.l || prevClose.l || 0,
      previousClose: quote.pc || prevClose.c || 0,
      volume: prevClose.v || 0,
      
      // 52-week data
      high52: metrics['52WeekHigh'] || 0,
      low52: metrics['52WeekLow'] || 0,
      
      // Fundamentals
      marketCap: profile.marketCapitalization ? profile.marketCapitalization * 1e6 : details.market_cap || 0,
      pe: metrics.peBasicExclExtraTTM || metrics.peTTM || 0,
      eps: metrics.epsBasicExclExtraItemsTTM || metrics.epsTTM || 0,
      beta: metrics.beta || 0,
      
      // Financials
      roe: metrics.roeTTM ? metrics.roeTTM / 100 : 0,
      roa: metrics.roaTTM ? metrics.roaTTM / 100 : 0,
      profitMargin: metrics.netProfitMarginTTM ? metrics.netProfitMarginTTM / 100 : 0,
      grossMargin: metrics.grossMarginTTM ? metrics.grossMarginTTM / 100 : 0,
      operatingMargin: metrics.operatingMarginTTM ? metrics.operatingMarginTTM / 100 : 0,
      
      // Growth & Valuation
      revenueGrowth: metrics.revenueGrowthTTMYoy ? metrics.revenueGrowthTTMYoy / 100 : 0,
      epsGrowth: metrics.epsGrowthTTMYoy ? metrics.epsGrowthTTMYoy / 100 : 0,
      priceToBook: metrics.pbQuarterly || metrics.pbAnnual || 0,
      priceToSales: metrics.psTTM || 0,
      debtToEquity: metrics.totalDebtToEquityQuarterly || metrics.totalDebtToEquityAnnual || 0,
      currentRatio: metrics.currentRatioQuarterly || metrics.currentRatioAnnual || 0,
      
      // Dividend
      dividendYield: metrics.dividendYieldIndicatedAnnual || 0,
      payoutRatio: metrics.payoutRatioTTM || 0,
      
      // Analyst targets
      targetPrice: metrics.targetMeanPrice || 0,
      targetHigh: metrics.targetHighPrice || 0,
      targetLow: metrics.targetLowPrice || 0,
      
      // Metadata
      timestamp: new Date().toISOString(),
      sources: {
        finnhub: !!finnhubQuote,
        polygon: !!polygonDetails,
      }
    };

    return NextResponse.json(stockData);
    
  } catch (error) {
    console.error('Stock API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch stock data', ticker },
      { status: 500 }
    );
  }
}
