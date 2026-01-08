import { NextRequest, NextResponse } from 'next/server';

// ============================================================
// OPTIONS API - Schwab Integration + Greeks-Based Suggestions
// ============================================================

const FINNHUB_KEY = process.env.FINNHUB_API_KEY;
const SCHWAB_APP_KEY = process.env.SCHWAB_APP_KEY;
const SCHWAB_APP_SECRET = process.env.SCHWAB_APP_SECRET;
const SCHWAB_REFRESH_TOKEN = process.env.SCHWAB_REFRESH_TOKEN;

// ============================================================
// SCHWAB OAUTH TOKEN REFRESH
// ============================================================
async function getSchwabToken(): Promise<string | null> {
  if (!SCHWAB_APP_KEY || !SCHWAB_APP_SECRET || !SCHWAB_REFRESH_TOKEN) {
    return null;
  }
  
  try {
    const credentials = Buffer.from(`${SCHWAB_APP_KEY}:${SCHWAB_APP_SECRET}`).toString('base64');
    const response = await fetch('https://api.schwabapi.com/v1/oauth/token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `grant_type=refresh_token&refresh_token=${SCHWAB_REFRESH_TOKEN}`,
    });
    
    if (!response.ok) return null;
    const data = await response.json();
    return data.access_token;
  } catch {
    return null;
  }
}

// ============================================================
// NEWS SENTIMENT ANALYSIS
// ============================================================
function analyzeNewsSentiment(headlines: string[]): { sentiment: string; score: number; keywords: string[] } {
  const bullishWords = ['surge', 'soar', 'jump', 'rally', 'beat', 'exceeds', 'record', 'growth', 'upgrade', 'buy', 'bullish', 'strong', 'gains', 'profit', 'success', 'boom', 'breakout', 'positive'];
  const bearishWords = ['fall', 'drop', 'plunge', 'crash', 'miss', 'decline', 'downgrade', 'sell', 'bearish', 'weak', 'loss', 'concern', 'warning', 'cut', 'layoff', 'risk', 'trouble', 'negative'];
  
  let bullish = 0, bearish = 0;
  const foundKeywords: string[] = [];
  
  headlines.forEach(headline => {
    const lower = headline.toLowerCase();
    bullishWords.forEach(word => {
      if (lower.includes(word)) {
        bullish++;
        if (!foundKeywords.includes(`+${word}`)) foundKeywords.push(`+${word}`);
      }
    });
    bearishWords.forEach(word => {
      if (lower.includes(word)) {
        bearish++;
        if (!foundKeywords.includes(`-${word}`)) foundKeywords.push(`-${word}`);
      }
    });
  });
  
  const score = bullish - bearish;
  const sentiment = score >= 2 ? 'BULLISH' : score <= -2 ? 'BEARISH' : 'NEUTRAL';
  
  return { sentiment, score, keywords: foundKeywords.slice(0, 6) };
}

// ============================================================
// TREND ANALYSIS
// ============================================================
function analyzeTrend(priceHistory: Array<{ close: number; datetime?: number }>): { trend: string; changePercent: number; volatility: number } {
  if (!priceHistory || priceHistory.length < 5) {
    return { trend: 'NEUTRAL', changePercent: 0, volatility: 0 };
  }
  
  const recent = priceHistory.slice(-30);
  const firstPrice = recent[0]?.close || 0;
  const lastPrice = recent[recent.length - 1]?.close || 0;
  const changePercent = firstPrice > 0 ? ((lastPrice - firstPrice) / firstPrice) * 100 : 0;
  
  const returns = [];
  for (let i = 1; i < recent.length; i++) {
    if (recent[i-1].close > 0) {
      returns.push((recent[i].close - recent[i-1].close) / recent[i-1].close);
    }
  }
  const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length || 0;
  const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length || 0;
  const volatility = Math.sqrt(variance) * Math.sqrt(252) * 100;
  
  const trend = changePercent > 5 ? 'BULLISH' : changePercent < -5 ? 'BEARISH' : 'NEUTRAL';
  
  return { trend, changePercent: parseFloat(changePercent.toFixed(2)), volatility: parseFloat(volatility.toFixed(1)) };
}

// ============================================================
// TYPES
// ============================================================
interface OptionContract {
  strike: number;
  bid: number;
  ask: number;
  last?: number;
  delta: number;
  gamma: number;
  theta: number;
  vega?: number;
  volume: number;
  openInterest: number;
  impliedVolatility: number;
  expiration?: string;
  dte?: number;
}

interface Suggestion {
  type: 'CALL' | 'PUT' | 'ALERT';
  strategy: string;
  strike?: number;
  expiration?: string;
  daysToExpiration?: number;
  bid?: number;
  ask?: number;
  delta?: number;
  gamma?: number;
  theta?: number;
  vega?: number;
  iv?: number;
  maxRisk?: string;
  breakeven?: string;
  reasoning: string[];
  riskLevel: 'AGGRESSIVE' | 'CONSERVATIVE' | 'WARNING';
  confidence: number;
}

// ============================================================
// SUGGESTION SCORING LOGIC
// ============================================================
function generateSuggestions(
  calls: OptionContract[],
  puts: OptionContract[],
  currentPrice: number,
  trend: { trend: string; changePercent: number },
  sentiment: { sentiment: string; score: number },
  earnings: { daysUntil: number; date: string },
  analystRating: { consensus: string; buyPercent: number },
  putCallRatio: number,
  avgIV: number
): Suggestion[] {
  const suggestions: Suggestion[] = [];

  // Calculate Bullish/Bearish Points
  let bullishPoints = 0;
  let bearishPoints = 0;

  if (trend.changePercent > 5) bullishPoints += 2;
  else if (trend.changePercent < -5) bearishPoints += 2;

  if (sentiment.sentiment === 'BULLISH') bullishPoints += 1;
  else if (sentiment.sentiment === 'BEARISH') bearishPoints += 1;

  if (putCallRatio > 1.2) bullishPoints += 1;
  else if (putCallRatio < 0.7) bearishPoints += 1;

  if (analystRating.consensus === 'buy' || analystRating.buyPercent > 60) bullishPoints += 1;
  else if (analystRating.consensus === 'sell' || analystRating.buyPercent < 30) bearishPoints += 1;

  // Find Options with Target Deltas
  const aggressiveCall = calls.find(c => c.delta >= 0.38 && c.delta <= 0.52);
  const conservativeCall = calls.find(c => c.delta >= 0.25 && c.delta <= 0.38);
  const aggressivePut = puts.find(p => Math.abs(p.delta) >= 0.38 && Math.abs(p.delta) <= 0.52);
  const conservativePut = puts.find(p => Math.abs(p.delta) >= 0.25 && Math.abs(p.delta) <= 0.38);

  // Aggressive Call
  if (aggressiveCall && bullishPoints >= bearishPoints) {
    const { delta, gamma, theta, ask = 0, dte = 10 } = aggressiveCall;
    const iv = aggressiveCall.impliedVolatility * 100;
    const askPrice = ask || aggressiveCall.last || 0;

    let confidence = 50 + (bullishPoints * 8) - (bearishPoints * 5);
    const reasoning: string[] = [];

    if (trend.trend === 'BULLISH') reasoning.push(`30-day trend UP ${trend.changePercent.toFixed(1)}%`);
    else { confidence -= 10; reasoning.push(`⚠️ Trend not aligned`); }

    if (sentiment.sentiment === 'BULLISH') reasoning.push(`Positive news sentiment`);
    reasoning.push(`Delta ${delta.toFixed(2)} offers good leverage`);

    if (avgIV > 60) { confidence -= 10; reasoning.push(`⚠️ IV elevated at ${avgIV.toFixed(0)}%`); }
    else if (avgIV < 30) { confidence += 5; reasoning.push(`IV at ${avgIV.toFixed(0)}% - fairly priced`); }
    else reasoning.push(`IV at ${avgIV.toFixed(0)}% - moderate`);

    const thetaPercent = askPrice > 0 ? (Math.abs(theta) / askPrice) * 100 : 0;
    if (thetaPercent > 10) { confidence -= 10; reasoning.push(`⚠️ High theta decay`); }

    if (gamma > 0.05 && dte < 7) reasoning.push(`⚠️ High gamma with short DTE`);
    else if (gamma > 0.04) reasoning.push(`Gamma ${gamma.toFixed(3)} accelerates gains`);

    if (earnings.daysUntil <= 7) { confidence -= 15; reasoning.push(`⚠️ Earnings in ${earnings.daysUntil}d - IV crush risk`); }
    else if (earnings.daysUntil <= 14) { confidence -= 5; reasoning.push(`Earnings in ${earnings.daysUntil} days`); }

    suggestions.push({
      type: 'CALL', strategy: 'Aggressive Call', strike: aggressiveCall.strike,
      expiration: aggressiveCall.expiration || '7-21 DTE', daysToExpiration: dte,
      bid: aggressiveCall.bid, ask: askPrice, delta, gamma, theta, vega: aggressiveCall.vega, iv,
      maxRisk: (askPrice * 100).toFixed(2), breakeven: (aggressiveCall.strike + askPrice).toFixed(2),
      reasoning, riskLevel: 'AGGRESSIVE', confidence: Math.max(15, Math.min(90, Math.round(confidence))),
    });
  }

  // Conservative Call
  if (conservativeCall && bullishPoints >= bearishPoints) {
    const { delta, gamma, theta, ask = 0, dte = 35 } = conservativeCall;
    const iv = conservativeCall.impliedVolatility * 100;
    const askPrice = ask || conservativeCall.last || 0;

    let confidence = 45 + (bullishPoints * 6) - (bearishPoints * 4);
    const reasoning: string[] = [];

    if (trend.trend === 'BULLISH') reasoning.push(`Uptrend supports bullish thesis`);
    if (analystRating.buyPercent > 60) reasoning.push(`Analyst consensus: ${analystRating.buyPercent}% bullish`);
    reasoning.push(`Extended DTE gives time for thesis`);
    reasoning.push(`Lower theta decay vs aggressive`);
    reasoning.push(`Delta ${delta.toFixed(2)} - defined risk`);

    suggestions.push({
      type: 'CALL', strategy: 'Conservative Call', strike: conservativeCall.strike,
      expiration: conservativeCall.expiration || '30-45 DTE', daysToExpiration: dte,
      bid: conservativeCall.bid, ask: askPrice, delta, gamma, theta, vega: conservativeCall.vega, iv,
      maxRisk: (askPrice * 100).toFixed(2), breakeven: (conservativeCall.strike + askPrice).toFixed(2),
      reasoning, riskLevel: 'CONSERVATIVE', confidence: Math.max(20, Math.min(85, Math.round(confidence))),
    });
  }

  // Aggressive Put
  if (aggressivePut && (bearishPoints >= bullishPoints || bullishPoints < 3)) {
    const { delta, gamma, theta, ask = 0, dte = 10 } = aggressivePut;
    const iv = aggressivePut.impliedVolatility * 100;
    const askPrice = ask || aggressivePut.last || 0;

    let confidence = 35 + (bearishPoints * 8) - (bullishPoints * 4);
    const reasoning: string[] = [];

    if (trend.trend === 'BEARISH') { reasoning.push(`Downtrend supports bearish thesis`); confidence += 10; }
    else reasoning.push(`Hedge against potential reversal`);

    if (sentiment.sentiment === 'BEARISH') reasoning.push(`Negative news sentiment`);
    reasoning.push(`Delta ${delta.toFixed(2)} provides downside exposure`);
    if (earnings.daysUntil <= 21) reasoning.push(`Earnings in ${earnings.daysUntil}d - volatility expected`);

    suggestions.push({
      type: 'PUT', strategy: 'Aggressive Put', strike: aggressivePut.strike,
      expiration: aggressivePut.expiration || '7-21 DTE', daysToExpiration: dte,
      bid: aggressivePut.bid, ask: askPrice, delta, gamma, theta, vega: aggressivePut.vega, iv,
      maxRisk: (askPrice * 100).toFixed(2), breakeven: (aggressivePut.strike - askPrice).toFixed(2),
      reasoning, riskLevel: 'AGGRESSIVE', confidence: Math.max(15, Math.min(75, Math.round(confidence))),
    });
  }

  // Alerts
  if (earnings.daysUntil <= 7 && earnings.daysUntil > 0) {
    suggestions.push({ type: 'ALERT', strategy: 'Earnings Alert', reasoning: [
      `📅 Earnings in ${earnings.daysUntil} days`, `IV typically drops 20-40% post-earnings`, `Consider closing before announcement`
    ], riskLevel: 'WARNING', confidence: 0 });
  } else if (earnings.daysUntil <= 21) {
    suggestions.push({ type: 'ALERT', strategy: 'Earnings Approaching', reasoning: [
      `📅 Earnings in ${earnings.daysUntil} days`, `IV may increase`, `Position sizing important`
    ], riskLevel: 'WARNING', confidence: 0 });
  }

  if (avgIV > 60) {
    suggestions.push({ type: 'ALERT', strategy: 'High IV Warning', reasoning: [
      `⚠️ IV at ${avgIV.toFixed(0)}% is elevated`, `Options expensive`, `Consider selling premium`
    ], riskLevel: 'WARNING', confidence: 0 });
  }

  return suggestions;
}

// ============================================================
// PARSE SCHWAB OPTIONS
// ============================================================
function parseSchwabOptions(data: any, optionType: 'call' | 'put'): OptionContract[] {
  const options: OptionContract[] = [];
  const dateMap = optionType === 'call' ? data.callExpDateMap : data.putExpDateMap;
  if (!dateMap) return options;

  for (const [expDate, strikes] of Object.entries(dateMap)) {
    for (const [strikePrice, contracts] of Object.entries(strikes as any)) {
      const contract = (contracts as any[])[0];
      if (contract) {
        options.push({
          strike: parseFloat(strikePrice), bid: contract.bid || 0, ask: contract.ask || 0, last: contract.last || 0,
          delta: contract.delta || 0, gamma: contract.gamma || 0, theta: contract.theta || 0, vega: contract.vega || 0,
          volume: contract.totalVolume || 0, openInterest: contract.openInterest || 0,
          impliedVolatility: contract.volatility || 0, expiration: expDate.split(':')[0], dte: contract.daysToExpiration || 0,
        });
      }
    }
  }
  return options.sort((a, b) => a.strike - b.strike).slice(0, 10);
}

// ============================================================
// GENERATE MOCK DATA
// ============================================================
function generateMockOptionsData(ticker: string) {
  const basePrice = ticker === 'AAPL' ? 260.33 : ticker === 'TSLA' ? 248.50 : ticker === 'NVDA' ? 138.25 : 150 + Math.random() * 100;
  const price = basePrice + (Math.random() * 4 - 2);
  const atmStrike = Math.round(price / 5) * 5;

  const generateChain = (type: 'call' | 'put'): OptionContract[] => {
    const strikes = type === 'call'
      ? [atmStrike - 10, atmStrike - 5, atmStrike, atmStrike + 5, atmStrike + 10, atmStrike + 15, atmStrike + 20]
      : [atmStrike - 20, atmStrike - 15, atmStrike - 10, atmStrike - 5, atmStrike, atmStrike + 5, atmStrike + 10];

    return strikes.map(strike => {
      const moneyness = (price - strike) / price;
      const baseDelta = type === 'call' ? Math.max(0.05, Math.min(0.95, 0.5 + moneyness * 3)) : Math.min(-0.05, Math.max(-0.95, -0.5 + moneyness * 3));
      const iv = 0.25 + Math.random() * 0.1;
      const timeValue = Math.abs(baseDelta) * price * iv * Math.sqrt(10 / 365);
      const intrinsicValue = type === 'call' ? Math.max(0, price - strike) : Math.max(0, strike - price);
      const optionPrice = intrinsicValue + timeValue;

      return {
        strike, bid: parseFloat(Math.max(0.05, optionPrice - 0.15).toFixed(2)), ask: parseFloat(Math.max(0.10, optionPrice + 0.15).toFixed(2)),
        last: parseFloat(optionPrice.toFixed(2)), delta: parseFloat(baseDelta.toFixed(2)),
        gamma: parseFloat((0.02 + 0.04 * Math.exp(-Math.pow(moneyness * 10, 2))).toFixed(3)),
        theta: parseFloat((-(0.05 + 0.15 * Math.exp(-Math.pow(moneyness * 10, 2)))).toFixed(2)),
        vega: parseFloat((0.1 + 0.2 * Math.exp(-Math.pow(moneyness * 10, 2))).toFixed(2)),
        volume: Math.floor(5000 + Math.random() * 50000), openInterest: Math.floor(20000 + Math.random() * 100000),
        impliedVolatility: parseFloat(iv.toFixed(3)), dte: 10,
      };
    });
  };

  return { calls: generateChain('call'), puts: generateChain('put'), currentPrice: parseFloat(price.toFixed(2)) };
}

// ============================================================
// MAIN API HANDLER
// ============================================================
export async function GET(request: NextRequest, { params }: { params: { ticker: string } }) {
  const ticker = params.ticker.toUpperCase();

  try {
    const schwabToken = await getSchwabToken();
    let calls: OptionContract[] = [];
    let puts: OptionContract[] = [];
    let currentPrice = 0;
    let priceHistory: any[] = [];
    let source = 'mock';

    // Try Schwab
    if (schwabToken) {
      try {
        const [chainsRes, historyRes] = await Promise.all([
          fetch(`https://api.schwabapi.com/marketdata/v1/chains?symbol=${ticker}&contractType=ALL&strikeCount=20&includeUnderlyingQuote=true`, {
            headers: { 'Authorization': `Bearer ${schwabToken}` },
          }),
          fetch(`https://api.schwabapi.com/marketdata/v1/pricehistory?symbol=${ticker}&periodType=month&period=1&frequencyType=daily&frequency=1`, {
            headers: { 'Authorization': `Bearer ${schwabToken}` },
          }),
        ]);

        if (chainsRes.ok) {
          const chainsData = await chainsRes.json();
          calls = parseSchwabOptions(chainsData, 'call');
          puts = parseSchwabOptions(chainsData, 'put');
          currentPrice = chainsData.underlyingPrice || 0;
          source = 'schwab';
        }

        if (historyRes.ok) {
          const histData = await historyRes.json();
          priceHistory = histData.candles || [];
        }
      } catch (e) { console.log('Schwab failed, using mock'); }
    }

    // Fallback to mock
    if (calls.length === 0) {
      const mockData = generateMockOptionsData(ticker);
      calls = mockData.calls;
      puts = mockData.puts;
      currentPrice = mockData.currentPrice;
      source = 'mock';
    }

    // Fetch Finnhub data
    let headlines: string[] = [];
    let earningsData = { date: '', daysUntil: 30 };
    let analystRating = { consensus: 'hold', buyPercent: 50, strongBuy: 0, buy: 0, hold: 0, sell: 0, strongSell: 0 };

    if (FINNHUB_KEY) {
      try {
        const [newsRes, earningsRes, recsRes] = await Promise.all([
          fetch(`https://finnhub.io/api/v1/company-news?symbol=${ticker}&from=${new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}&to=${new Date().toISOString().split('T')[0]}&token=${FINNHUB_KEY}`),
          fetch(`https://finnhub.io/api/v1/calendar/earnings?symbol=${ticker}&token=${FINNHUB_KEY}`),
          fetch(`https://finnhub.io/api/v1/stock/recommendation?symbol=${ticker}&token=${FINNHUB_KEY}`),
        ]);

        if (newsRes.ok) { const d = await newsRes.json(); headlines = (d || []).slice(0, 5).map((n: any) => n.headline); }
        if (earningsRes.ok) {
          const d = await earningsRes.json();
          const upcoming = d.earningsCalendar?.find((e: any) => new Date(e.date) > new Date());
          if (upcoming) earningsData = { date: upcoming.date, daysUntil: Math.ceil((new Date(upcoming.date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) };
        }
        if (recsRes.ok) {
          const d = await recsRes.json();
          const latest = d?.[0];
          if (latest) {
            const total = (latest.strongBuy || 0) + (latest.buy || 0) + (latest.hold || 0) + (latest.sell || 0) + (latest.strongSell || 0);
            analystRating = {
              consensus: latest.strongBuy + latest.buy > latest.sell + latest.strongSell ? 'buy' : 'hold',
              buyPercent: total > 0 ? Math.round(((latest.strongBuy + latest.buy) / total) * 100) : 50,
              strongBuy: latest.strongBuy || 0, buy: latest.buy || 0, hold: latest.hold || 0, sell: latest.sell || 0, strongSell: latest.strongSell || 0,
            };
          }
        }
      } catch (e) { console.log('Finnhub error'); }
    }

    if (headlines.length === 0) headlines = [`${ticker} Quarterly Update`, `Analyst Coverage on ${ticker}`, `${ticker} Market News`];

    const totalCallVolume = calls.reduce((sum, c) => sum + c.volume, 0);
    const totalPutVolume = puts.reduce((sum, p) => sum + p.volume, 0);
    const putCallRatio = totalCallVolume > 0 ? totalPutVolume / totalCallVolume : 1;
    const avgIV = [...calls, ...puts].reduce((sum, opt) => sum + opt.impliedVolatility, 0) / Math.max(1, calls.length + puts.length) * 100;

    const trend = priceHistory.length > 0 ? analyzeTrend(priceHistory) : { trend: Math.random() > 0.4 ? 'BULLISH' : 'BEARISH', changePercent: parseFloat((Math.random() * 15 - 5).toFixed(1)), volatility: 25 };
    const sentiment = analyzeNewsSentiment(headlines);
    const suggestions = generateSuggestions(calls, puts, currentPrice, trend, sentiment, earningsData, analystRating, putCallRatio, avgIV);

    return NextResponse.json({
      ticker, currentPrice: parseFloat(currentPrice.toFixed(2)),
      expiration: calls[0]?.expiration || new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      analysis: {
        trend, newsSentiment: { sentiment: sentiment.sentiment, score: sentiment.score, keywords: sentiment.keywords, recentHeadlines: headlines },
        earnings: { date: earningsData.date || 'TBD', daysUntil: earningsData.daysUntil, epsEstimate: 0 }, analystRating,
      },
      metrics: { putCallRatio: putCallRatio.toFixed(2), totalCallVolume, totalPutVolume, avgIV: avgIV.toFixed(1) },
      suggestions, calls, puts, lastUpdated: new Date().toISOString(), dataSource: source,
    });

  } catch (error) {
    console.error('Options API error:', error);
    const mockData = generateMockOptionsData(ticker);
    return NextResponse.json({
      ticker, currentPrice: mockData.currentPrice, expiration: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      analysis: { trend: { trend: 'NEUTRAL', changePercent: 0, volatility: 25 }, newsSentiment: { sentiment: 'NEUTRAL', score: 0, keywords: [], recentHeadlines: [] },
        earnings: { date: 'TBD', daysUntil: 30, epsEstimate: 0 }, analystRating: { consensus: 'hold', buyPercent: 50, strongBuy: 0, buy: 0, hold: 0, sell: 0, strongSell: 0 } },
      metrics: { putCallRatio: '1.00', totalCallVolume: 100000, totalPutVolume: 100000, avgIV: '30.0' },
      suggestions: [], calls: mockData.calls, puts: mockData.puts, lastUpdated: new Date().toISOString(), dataSource: 'mock',
    });
  }
}
