import { NextRequest, NextResponse } from 'next/server';

const FINNHUB_KEY = process.env.FINNHUB_API_KEY;
const SCHWAB_APP_KEY = process.env.SCHWAB_APP_KEY;
const SCHWAB_APP_SECRET = process.env.SCHWAB_APP_SECRET;
const SCHWAB_REFRESH_TOKEN = process.env.SCHWAB_REFRESH_TOKEN;

// Get Schwab access token
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

// Analyze news sentiment from headlines
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

// Calculate 30-day trend from price history
function analyzeTrend(priceHistory: any[]): { trend: string; changePercent: number; volatility: number } {
  if (!priceHistory || priceHistory.length < 2) {
    return { trend: 'NEUTRAL', changePercent: 0, volatility: 0 };
  }
  
  const firstPrice = priceHistory[0]?.close || priceHistory[0]?.c || 0;
  const lastPrice = priceHistory[priceHistory.length - 1]?.close || priceHistory[priceHistory.length - 1]?.c || 0;
  
  if (!firstPrice || !lastPrice) {
    return { trend: 'NEUTRAL', changePercent: 0, volatility: 0 };
  }
  
  const changePercent = ((lastPrice - firstPrice) / firstPrice) * 100;
  
  // Calculate volatility (standard deviation of daily returns)
  const returns: number[] = [];
  for (let i = 1; i < priceHistory.length; i++) {
    const prev = priceHistory[i - 1]?.close || priceHistory[i - 1]?.c || 0;
    const curr = priceHistory[i]?.close || priceHistory[i]?.c || 0;
    if (prev && curr) {
      returns.push((curr - prev) / prev);
    }
  }
  
  const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
  const volatility = Math.sqrt(variance) * Math.sqrt(252) * 100; // Annualized
  
  const trend = changePercent >= 5 ? 'BULLISH' : changePercent <= -5 ? 'BEARISH' : 'NEUTRAL';
  
  return { trend, changePercent: Math.round(changePercent * 10) / 10, volatility: Math.round(volatility * 10) / 10 };
}

// Generate trade suggestions based on all data + Greeks
function generateSuggestions(
  calls: any[],
  puts: any[],
  currentPrice: number,
  trend: any,
  sentiment: any,
  earnings: any,
  analystRating: any,
  avgIV: number,
  putCallRatio: number
): any[] {
  const suggestions: any[] = [];
  
  // Calculate bias score
  let bullishPoints = 0;
  let bearishPoints = 0;
  
  // Trend signals (weight: 2)
  if (trend.trend === 'BULLISH' && trend.changePercent > 5) bullishPoints += 2;
  else if (trend.trend === 'BEARISH' && trend.changePercent < -5) bearishPoints += 2;
  
  // News sentiment (weight: 1)
  if (sentiment.sentiment === 'BULLISH') bullishPoints += 1;
  else if (sentiment.sentiment === 'BEARISH') bearishPoints += 1;
  
  // Put/Call ratio - contrarian (weight: 1)
  if (putCallRatio > 1.2) bullishPoints += 1; // Excessive fear = contrarian bullish
  else if (putCallRatio < 0.7) bearishPoints += 1; // Excessive greed = contrarian bearish
  
  // Analyst consensus (weight: 1)
  if (analystRating.consensus === 'buy' || analystRating.consensus === 'strongBuy') bullishPoints += 1;
  else if (analystRating.consensus === 'sell' || analystRating.consensus === 'strongSell') bearishPoints += 1;
  
  const netBias = bullishPoints - bearishPoints;
  const isBullish = netBias >= 1;
  const isBearish = netBias <= -1;
  
  // IV assessment for reasoning
  const ivAssessment = avgIV > 50 ? 'HIGH' : avgIV > 30 ? 'MODERATE' : 'LOW';
  const ivReasoning = avgIV > 50 
    ? `IV at ${avgIV.toFixed(0)}% is elevated - options expensive` 
    : avgIV < 25 
      ? `IV at ${avgIV.toFixed(0)}% is low - options cheap, good for buying` 
      : `IV at ${avgIV.toFixed(0)}% is moderate`;
  
  // Earnings warning
  const earningsWarning = earnings.daysUntil <= 7 && earnings.daysUntil > 0
    ? `⚠️ Earnings in ${earnings.daysUntil} days - IV crush risk`
    : null;
  
  // Find options for suggestions using delta targeting
  // Aggressive: ~0.40-0.50 delta, shorter DTE
  // Conservative: ~0.25-0.35 delta, longer DTE
  
  if (calls.length > 0 && (isBullish || netBias === 0)) {
    // Find aggressive call (delta ~0.40-0.50, ATM or slightly OTM)
    const aggressiveCall = calls.find(c => c.strike >= currentPrice && c.strike <= currentPrice * 1.03) || calls[0];
    
    // Find conservative call (delta ~0.25-0.35, more OTM)
    const conservativeCall = calls.find(c => c.strike >= currentPrice * 1.03 && c.strike <= currentPrice * 1.08) || calls[Math.min(2, calls.length - 1)];
    
    if (aggressiveCall) {
      const delta = aggressiveCall.delta || 0.45;
      const gamma = aggressiveCall.gamma || 0.04;
      const theta = aggressiveCall.theta || -0.15;
      const iv = aggressiveCall.impliedVolatility ? aggressiveCall.impliedVolatility * 100 : avgIV;
      const ask = aggressiveCall.ask || aggressiveCall.last || 0;
      
      // Greeks-based confidence adjustments
      let confidence = 50 + (bullishPoints * 8) - (bearishPoints * 5);
      const reasoning: string[] = [];
      
      // Trend reasoning
      if (trend.changePercent > 5) reasoning.push(`30-day trend UP ${trend.changePercent}%`);
      else if (trend.changePercent > 0) reasoning.push(`Slight uptrend +${trend.changePercent}%`);
      
      // Sentiment reasoning
      if (sentiment.sentiment === 'BULLISH') reasoning.push(`Positive news sentiment (${sentiment.keywords.slice(0, 2).join(', ')})`);
      
      // IV reasoning
      if (iv < 30) {
        reasoning.push(`IV ${iv.toFixed(0)}% is low - cheap options`);
        confidence += 5;
      } else if (iv > 50) {
        reasoning.push(`⚠️ IV ${iv.toFixed(0)}% is high - expensive`);
        confidence -= 8;
      } else {
        reasoning.push(`IV ${iv.toFixed(0)}% moderate`);
      }
      
      // Delta reasoning
      reasoning.push(`Delta ${delta.toFixed(2)} offers good leverage`);
      
      // Gamma reasoning (aggressive)
      if (gamma > 0.04) {
        reasoning.push(`High gamma ${gamma.toFixed(3)} - accelerates gains if right`);
        confidence += 3;
      }
      
      // Theta warning
      if (theta < -0.20) {
        reasoning.push(`⚠️ High theta decay $${Math.abs(theta).toFixed(2)}/day`);
        confidence -= 5;
      }
      
      // Earnings warning
      if (earningsWarning) {
        reasoning.push(earningsWarning);
        confidence -= 10;
      }
      
      // Analyst support
      if (analystRating.buyPercent > 60) reasoning.push(`${analystRating.buyPercent}% analyst buy ratings`);
      
      confidence = Math.max(25, Math.min(90, confidence));
      
      suggestions.push({
        type: 'CALL',
        strategy: 'Aggressive Call',
        strike: aggressiveCall.strike,
        expiration: aggressiveCall.expiration || 'Near-term',
        daysToExpiration: aggressiveCall.dte || 14,
        bid: aggressiveCall.bid || 0,
        ask: ask,
        delta: delta,
        gamma: gamma,
        theta: theta,
        iv: iv,
        maxRisk: (ask * 100).toFixed(2),
        breakeven: (aggressiveCall.strike + ask).toFixed(2),
        reasoning,
        riskLevel: 'AGGRESSIVE',
        confidence: Math.round(confidence),
      });
    }
    
    if (conservativeCall && conservativeCall !== aggressiveCall) {
      const delta = conservativeCall.delta || 0.30;
      const gamma = conservativeCall.gamma || 0.03;
      const theta = conservativeCall.theta || -0.08;
      const iv = conservativeCall.impliedVolatility ? conservativeCall.impliedVolatility * 100 : avgIV;
      const ask = conservativeCall.ask || conservativeCall.last || 0;
      
      let confidence = 45 + (bullishPoints * 7) - (bearishPoints * 4);
      const reasoning: string[] = [];
      
      if (trend.trend === 'BULLISH') reasoning.push(`Uptrend supports bullish thesis`);
      if (analystRating.buyPercent > 50) reasoning.push(`Analyst consensus: ${analystRating.buyPercent}% bullish`);
      reasoning.push(`30-45 DTE gives time for thesis to play out`);
      reasoning.push(`Lower theta decay (-$${Math.abs(theta).toFixed(2)}/day) vs aggressive`);
      reasoning.push(`Delta ${delta.toFixed(2)} - lower risk profile`);
      
      if (gamma < 0.035) {
        reasoning.push(`Stable gamma ${gamma.toFixed(3)} - predictable delta`);
        confidence += 3;
      }
      
      if (iv < 35) {
        confidence += 5;
      }
      
      if (earningsWarning) {
        reasoning.push(earningsWarning);
        confidence -= 5;
      }
      
      confidence = Math.max(25, Math.min(85, confidence));
      
      suggestions.push({
        type: 'CALL',
        strategy: 'Conservative Call',
        strike: conservativeCall.strike,
        expiration: conservativeCall.expiration || '30-45 DTE',
        daysToExpiration: conservativeCall.dte || 35,
        bid: conservativeCall.bid || 0,
        ask: ask,
        delta: delta,
        gamma: gamma,
        theta: theta,
        iv: iv,
        maxRisk: (ask * 100).toFixed(2),
        breakeven: (conservativeCall.strike + ask).toFixed(2),
        reasoning,
        riskLevel: 'CONSERVATIVE',
        confidence: Math.round(confidence),
      });
    }
  }
  
  if (puts.length > 0 && (isBearish || netBias === 0)) {
    // Find aggressive put (delta ~-0.40 to -0.50, ATM or slightly OTM)
    const aggressivePut = puts.find(p => p.strike <= currentPrice && p.strike >= currentPrice * 0.97) || puts[0];
    
    // Find conservative put (delta ~-0.25 to -0.35, more OTM)
    const conservativePut = puts.find(p => p.strike <= currentPrice * 0.97 && p.strike >= currentPrice * 0.92) || puts[Math.min(2, puts.length - 1)];
    
    if (aggressivePut) {
      const delta = aggressivePut.delta || -0.45;
      const gamma = aggressivePut.gamma || 0.04;
      const theta = aggressivePut.theta || -0.15;
      const iv = aggressivePut.impliedVolatility ? aggressivePut.impliedVolatility * 100 : avgIV;
      const ask = aggressivePut.ask || aggressivePut.last || 0;
      
      let confidence = 40 + (bearishPoints * 8) - (bullishPoints * 5);
      const reasoning: string[] = [];
      
      if (trend.changePercent < -5) reasoning.push(`30-day trend DOWN ${Math.abs(trend.changePercent)}%`);
      if (sentiment.sentiment === 'BEARISH') reasoning.push(`Negative news sentiment`);
      if (putCallRatio > 1.2) reasoning.push(`High put/call ratio ${putCallRatio.toFixed(2)} - fear in market`);
      
      reasoning.push(`Delta ${delta.toFixed(2)} for downside exposure`);
      
      if (gamma > 0.04) {
        reasoning.push(`High gamma accelerates gains on drop`);
        confidence += 3;
      }
      
      if (theta < -0.20) {
        reasoning.push(`⚠️ High theta decay`);
        confidence -= 5;
      }
      
      if (earningsWarning) {
        reasoning.push(earningsWarning);
        confidence -= 8;
      }
      
      confidence = Math.max(20, Math.min(80, confidence));
      
      suggestions.push({
        type: 'PUT',
        strategy: 'Aggressive Put',
        strike: aggressivePut.strike,
        expiration: aggressivePut.expiration || 'Near-term',
        daysToExpiration: aggressivePut.dte || 14,
        bid: aggressivePut.bid || 0,
        ask: ask,
        delta: delta,
        gamma: gamma,
        theta: theta,
        iv: iv,
        maxRisk: (ask * 100).toFixed(2),
        breakeven: (aggressivePut.strike - ask).toFixed(2),
        reasoning,
        riskLevel: 'AGGRESSIVE',
        confidence: Math.round(confidence),
      });
    }
    
    if (conservativePut && conservativePut !== aggressivePut) {
      const delta = conservativePut.delta || -0.30;
      const gamma = conservativePut.gamma || 0.03;
      const theta = conservativePut.theta || -0.08;
      const iv = conservativePut.impliedVolatility ? conservativePut.impliedVolatility * 100 : avgIV;
      const ask = conservativePut.ask || conservativePut.last || 0;
      
      let confidence = 35 + (bearishPoints * 6) - (bullishPoints * 3);
      const reasoning: string[] = [];
      
      if (trend.trend === 'BEARISH') reasoning.push(`Downtrend supports bearish thesis`);
      reasoning.push(`Extended DTE reduces theta risk`);
      reasoning.push(`Delta ${delta.toFixed(2)} - defined risk profile`);
      
      if (gamma < 0.035) {
        reasoning.push(`Stable gamma - predictable movement`);
      }
      
      confidence = Math.max(20, Math.min(75, confidence));
      
      suggestions.push({
        type: 'PUT',
        strategy: 'Conservative Put',
        strike: conservativePut.strike,
        expiration: conservativePut.expiration || '30-45 DTE',
        daysToExpiration: conservativePut.dte || 35,
        bid: conservativePut.bid || 0,
        ask: ask,
        delta: delta,
        gamma: gamma,
        theta: theta,
        iv: iv,
        maxRisk: (ask * 100).toFixed(2),
        breakeven: (conservativePut.strike - ask).toFixed(2),
        reasoning,
        riskLevel: 'CONSERVATIVE',
        confidence: Math.round(confidence),
      });
    }
  }
  
  // Add alerts/warnings
  if (earnings.daysUntil <= 7 && earnings.daysUntil > 0) {
    suggestions.push({
      type: 'ALERT',
      strategy: 'Earnings Alert',
      reasoning: [
        `📅 Earnings in ${earnings.daysUntil} days (${earnings.date})`,
        `IV typically drops 20-40% post-earnings (IV crush)`,
        `Consider closing positions before announcement`,
        `Or size positions expecting volatility loss`,
      ],
      riskLevel: 'WARNING',
      confidence: 0,
    });
  }
  
  if (avgIV > 60) {
    suggestions.push({
      type: 'ALERT',
      strategy: 'High IV Warning',
      reasoning: [
        `⚠️ IV at ${avgIV.toFixed(0)}% is significantly elevated`,
        `Options are expensive - poor risk/reward for buyers`,
        `Consider selling premium or waiting for IV to normalize`,
        `High vega exposure - positions sensitive to IV changes`,
      ],
      riskLevel: 'WARNING',
      confidence: 0,
    });
  }
  
  return suggestions;
}

export async function GET(
  request: NextRequest,
  { params }: { params: { ticker: string } }
) {
  const ticker = params.ticker.toUpperCase();
  
  try {
    // Try Schwab first, fall back to Yahoo
    const schwabToken = await getSchwabToken();
    let optionsData: any = null;
    let priceHistory: any[] = [];
    let source = 'yahoo';
    
    if (schwabToken) {
      // Fetch from Schwab
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
          optionsData = chainsData;
          source = 'schwab';
        }
        
        if (historyRes.ok) {
          const histData = await historyRes.json();
          priceHistory = histData.candles || [];
        }
      } catch (e) {
        console.log('Schwab fetch failed, falling back to Yahoo');
      }
    }
    
    // Fallback to Yahoo if Schwab didn't work
    if (!optionsData) {
      const yahooRes = await fetch(
        `https://query1.finance.yahoo.com/v7/finance/options/${ticker}`,
        { 
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
          next: { revalidate: 60 }
        }
      );
      
      if (yahooRes.ok) {
        const yahooData = await yahooRes.json();
        optionsData = yahooData.optionChain?.result?.[0];
        source = 'yahoo';
      }
    }
    
    if (!optionsData) {
      return NextResponse.json({ error: 'No options data available' }, { status: 404 });
    }
    
    // Fetch Finnhub data (news, earnings, recommendations)
    const [newsRes, earningsRes, recsRes] = await Promise.all([
      FINNHUB_KEY ? fetch(`https://finnhub.io/api/v1/company-news?symbol=${ticker}&from=${new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}&to=${new Date().toISOString().split('T')[0]}&token=${FINNHUB_KEY}`)
        .then(r => r.ok ? r.json() : []).catch(() => []) : Promise.resolve([]),
      FINNHUB_KEY ? fetch(`https://finnhub.io/api/v1/calendar/earnings?symbol=${ticker}&token=${FINNHUB_KEY}`)
        .then(r => r.ok ? r.json() : null).catch(() => null) : Promise.resolve(null),
      FINNHUB_KEY ? fetch(`https://finnhub.io/api/v1/stock/recommendation?symbol=${ticker}&token=${FINNHUB_KEY}`)
        .then(r => r.ok ? r.json() : []).catch(() => []) : Promise.resolve([]),
    ]);
    
    // Process options data based on source
    let calls: any[] = [];
    let puts: any[] = [];
    let currentPrice = 0;
    let expiration = '';
    let expirations: string[] = [];
    
    if (source === 'schwab') {
      currentPrice = optionsData.underlying?.last || optionsData.underlyingPrice || 0;
      
      // Process Schwab format
      const callMap = optionsData.callExpDateMap || {};
      const putMap = optionsData.putExpDateMap || {};
      
      // Get first expiration
      const callExpDates = Object.keys(callMap);
      if (callExpDates.length > 0) {
        expiration = callExpDates[0].split(':')[0];
        expirations = callExpDates.slice(0, 6).map(d => d.split(':')[0]);
        
        const callStrikes = callMap[callExpDates[0]] || {};
        calls = Object.values(callStrikes).flat().map((c: any) => ({
          strike: c.strikePrice,
          last: c.last,
          bid: c.bid,
          ask: c.ask,
          volume: c.totalVolume,
          openInterest: c.openInterest,
          impliedVolatility: c.volatility,
          delta: c.delta,
          gamma: c.gamma,
          theta: c.theta,
          vega: c.vega,
          itm: c.inTheMoney,
          dte: c.daysToExpiration,
        }));
      }
      
      const putExpDates = Object.keys(putMap);
      if (putExpDates.length > 0) {
        const putStrikes = putMap[putExpDates[0]] || {};
        puts = Object.values(putStrikes).flat().map((p: any) => ({
          strike: p.strikePrice,
          last: p.last,
          bid: p.bid,
          ask: p.ask,
          volume: p.totalVolume,
          openInterest: p.openInterest,
          impliedVolatility: p.volatility,
          delta: p.delta,
          gamma: p.gamma,
          theta: p.theta,
          vega: p.vega,
          itm: p.inTheMoney,
          dte: p.daysToExpiration,
        }));
      }
    } else {
      // Yahoo format
      currentPrice = optionsData.quote?.regularMarketPrice || 0;
      const options = optionsData.options?.[0] || {};
      expiration = new Date((optionsData.expirationDates?.[0] || 0) * 1000).toISOString().split('T')[0];
      expirations = (optionsData.expirationDates || []).slice(0, 6).map((ts: number) => 
        new Date(ts * 1000).toISOString().split('T')[0]
      );
      
      calls = (options.calls || []).slice(0, 20).map((c: any) => ({
        strike: c.strike,
        last: c.lastPrice || 0,
        bid: c.bid || 0,
        ask: c.ask || 0,
        volume: c.volume || 0,
        openInterest: c.openInterest || 0,
        impliedVolatility: c.impliedVolatility || 0,
        delta: c.delta || (c.strike < currentPrice ? 0.6 : c.strike > currentPrice * 1.05 ? 0.25 : 0.45),
        gamma: c.gamma || 0.04,
        theta: c.theta || -0.12,
        vega: c.vega || 0.08,
        itm: c.inTheMoney || false,
        dte: Math.ceil((new Date(expiration).getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
      }));
      
      puts = (options.puts || []).slice(0, 20).map((p: any) => ({
        strike: p.strike,
        last: p.lastPrice || 0,
        bid: p.bid || 0,
        ask: p.ask || 0,
        volume: p.volume || 0,
        openInterest: p.openInterest || 0,
        impliedVolatility: p.impliedVolatility || 0,
        delta: p.delta || (p.strike > currentPrice ? -0.6 : p.strike < currentPrice * 0.95 ? -0.25 : -0.45),
        gamma: p.gamma || 0.04,
        theta: p.theta || -0.12,
        vega: p.vega || 0.08,
        itm: p.inTheMoney || false,
        dte: Math.ceil((new Date(expiration).getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
      }));
    }
    
    // Calculate metrics
    const totalCallVolume = calls.reduce((sum, c) => sum + (c.volume || 0), 0);
    const totalPutVolume = puts.reduce((sum, p) => sum + (p.volume || 0), 0);
    const totalCallOI = calls.reduce((sum, c) => sum + (c.openInterest || 0), 0);
    const totalPutOI = puts.reduce((sum, p) => sum + (p.openInterest || 0), 0);
    
    const callIVs = calls.filter(c => c.impliedVolatility > 0).map(c => c.impliedVolatility);
    const putIVs = puts.filter(p => p.impliedVolatility > 0).map(p => p.impliedVolatility);
    const allIVs = [...callIVs, ...putIVs];
    const avgIV = allIVs.length > 0 ? (allIVs.reduce((a, b) => a + b, 0) / allIVs.length) * 100 : 25;
    
    const putCallRatio = totalCallVolume > 0 ? totalPutVolume / totalCallVolume : 1;
    
    // Analyze data
    const trend = analyzeTrend(priceHistory);
    const headlines = (newsRes || []).slice(0, 10).map((n: any) => n.headline || '');
    const sentiment = analyzeNewsSentiment(headlines);
    
    // Process earnings
    const earningsData = earningsRes?.earningsCalendar?.[0] || {};
    const earningsDate = earningsData.date || null;
    const daysUntilEarnings = earningsDate 
      ? Math.ceil((new Date(earningsDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
      : null;
    
    const earnings = {
      date: earningsDate,
      daysUntil: daysUntilEarnings,
      epsEstimate: earningsData.epsEstimate || null,
    };
    
    // Process analyst ratings
    const latestRec = (recsRes || [])[0] || {};
    const totalRecs = (latestRec.strongBuy || 0) + (latestRec.buy || 0) + (latestRec.hold || 0) + (latestRec.sell || 0) + (latestRec.strongSell || 0);
    const buyPercent = totalRecs > 0 ? Math.round(((latestRec.strongBuy || 0) + (latestRec.buy || 0)) / totalRecs * 100) : 50;
    
    const analystRating = {
      consensus: buyPercent >= 70 ? 'buy' : buyPercent >= 50 ? 'hold' : 'sell',
      buyPercent: buyPercent.toString(),
      strongBuy: latestRec.strongBuy || 0,
      buy: latestRec.buy || 0,
      hold: latestRec.hold || 0,
      sell: latestRec.sell || 0,
      strongSell: latestRec.strongSell || 0,
    };
    
    // Generate suggestions
    const suggestions = generateSuggestions(
      calls, puts, currentPrice, trend, sentiment, earnings, analystRating, avgIV, putCallRatio
    );
    
    const response = {
      ticker,
      currentPrice,
      expiration,
      expirations,
      source,
      
      calls,
      puts,
      
      metrics: {
        putCallRatio: putCallRatio.toFixed(2),
        putCallOIRatio: totalCallOI > 0 ? (totalPutOI / totalCallOI).toFixed(2) : '1.00',
        totalCallVolume,
        totalPutVolume,
        totalCallOI,
        totalPutOI,
        avgIV: avgIV.toFixed(1),
      },
      
      analysis: {
        trend,
        newsSentiment: { ...sentiment, recentHeadlines: headlines.slice(0, 5) },
        earnings,
        analystRating,
      },
      
      suggestions,
      
      timestamp: new Date().toISOString(),
    };
    
    return NextResponse.json(response);
    
  } catch (error) {
    console.error('Options API error:', error);
    return NextResponse.json({ error: 'Failed to fetch options data', ticker }, { status: 500 });
  }
}
