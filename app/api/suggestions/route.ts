import { NextRequest, NextResponse } from 'next/server';
import { getSchwabAccessToken, schwabFetchJson } from '@/lib/schwab';
import { detectUnusualActivity } from '@/lib/unusualActivityDetector';

export const runtime = 'nodejs';

// Cache for suggestions (refreshed every 30 seconds)
let cachedSuggestions: any[] = [];
let lastFetchTime = 0;
const CACHE_DURATION = 30000; // 30 seconds

// Top liquid stocks and ETFs to scan
const MARKET_UNIVERSE = [
  'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA', 'AMD', 'NFLX', 'DIS',
  'JPM', 'BAC', 'WMT', 'V', 'MA', 'UNH', 'HD', 'PFE', 'KO', 'PEP',
  'SPY', 'QQQ', 'IWM', 'DIA', 'VOO', 'VTI', 'XLF', 'XLE', 'XLK', 'XLV'
];

interface Suggestion {
  id: string;
  symbol: string;
  companyName: string;
  type: 'STOCK' | 'OPTIONS';
  priority: 'URGENT' | 'HIGH' | 'MEDIUM';
  confidence: number;
  currentPrice: number;
  reason: string;
  details: any;
  timestamp: string;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const minConfidence = parseInt(searchParams.get('minConfidence') || '75');
    const types = searchParams.get('types')?.split(',') || ['STOCK', 'OPTIONS'];
    const priorities = searchParams.get('priorities')?.split(',') || ['URGENT', 'HIGH', 'MEDIUM'];

    // Check cache
    const now = Date.now();
    if (now - lastFetchTime < CACHE_DURATION && cachedSuggestions.length > 0) {
      const filtered = filterSuggestions(cachedSuggestions, minConfidence, types, priorities);
      return NextResponse.json({
        success: true,
        suggestions: filtered,
        cached: true,
        nextUpdate: CACHE_DURATION - (now - lastFetchTime),
      });
    }

    // Fetch fresh suggestions
    const suggestions = await scanMarketForSuggestions();
    
    cachedSuggestions = suggestions;
    lastFetchTime = now;

    const filtered = filterSuggestions(suggestions, minConfidence, types, priorities);

    return NextResponse.json({
      success: true,
      suggestions: filtered,
      cached: false,
      totalScanned: MARKET_UNIVERSE.length,
      nextUpdate: CACHE_DURATION,
    });

  } catch (error: any) {
    console.error('[Suggestions] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

async function scanMarketForSuggestions(): Promise<Suggestion[]> {
  const suggestions: Suggestion[] = [];
  
  // Get Schwab token
  const tokenResult = await getSchwabAccessToken('options', { forceRefresh: false });
  if (!tokenResult.token) {
    console.error('[Suggestions] Auth failed');
    return [];
  }

  // Scan each symbol
  for (const symbol of MARKET_UNIVERSE.slice(0, 15)) { // Limit to first 15 to avoid rate limits
    try {
      // 1. Get stock data
      const stockSuggestion = await analyzeStock(symbol, tokenResult.token);
      if (stockSuggestion) suggestions.push(stockSuggestion);

      // 2. Get options data for unusual activity
      const optionsSuggestion = await analyzeOptions(symbol, tokenResult.token);
      if (optionsSuggestion) suggestions.push(optionsSuggestion);

      // Small delay to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error) {
      console.error(`[Suggestions] Error scanning ${symbol}:`, error);
    }
  }

  // Sort by priority and confidence
  return suggestions.sort((a, b) => {
    const priorityScore = { URGENT: 3, HIGH: 2, MEDIUM: 1 };
    const aScore = priorityScore[a.priority] * a.confidence;
    const bScore = priorityScore[b.priority] * b.confidence;
    return bScore - aScore;
  });
}

async function analyzeStock(symbol: string, token: string): Promise<Suggestion | null> {
  try {
    // Fetch stock data from our existing endpoint
    const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/stock/${symbol}`);
    const data = await res.json();

    if (!data.success) return null;

    const { analysis, suggestions: aiSuggestions } = data;
    
    // Only suggest if AI confidence is high
    if (!analysis || analysis.consensus !== 'BUY' || analysis.consensusScore < 80) {
      return null;
    }

    // Calculate priority based on consensus strength
    const priority = analysis.consensusScore >= 90 ? 'HIGH' : 'MEDIUM';

    return {
      id: `stock_${symbol}_${Date.now()}`,
      symbol,
      companyName: data.companyName || symbol,
      type: 'STOCK',
      priority,
      confidence: analysis.consensusScore,
      currentPrice: analysis.currentPrice || 0,
      reason: `${analysis.voteBreakdown.buy} of ${analysis.totalVoters} AI investors recommend BUY`,
      details: {
        targetPrice: analysis.targetPrice,
        expectedReturn: analysis.targetPrice ? ((analysis.targetPrice - analysis.currentPrice) / analysis.currentPrice) * 100 : 0,
        aiVotes: {
          total: analysis.totalVoters,
          bullish: analysis.voteBreakdown.buy,
        },
      },
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    return null;
  }
}

async function analyzeOptions(symbol: string, token: string): Promise<Suggestion | null> {
  try {
    // Fetch options data
    const optionsResult = await schwabFetchJson<any>(
      token,
      `https://api.schwabapi.com/marketdata/v1/chains?symbol=${symbol}&strikeCount=10`,
      { scope: 'options' }
    );

    if (!optionsResult.ok || !optionsResult.data) return null;

    const optionsData = optionsResult.data;
    const underlyingPrice = optionsData.underlyingPrice || 0;

    // Build options chain array
    const callMap = optionsData.callExpDateMap || {};
    const allOptions: any[] = [];

    for (const expDate in callMap) {
      for (const strike in callMap[expDate]) {
        const calls = callMap[expDate][strike];
        calls.forEach((opt: any) => {
          allOptions.push({
            ...opt,
            type: 'CALL',
            strike: parseFloat(strike),
            expiration: expDate,
          });
        });
      }
    }

    // Detect unusual activity
    const unusualActivities = allOptions
      .map(opt => {
        const volume = opt.totalVolume || 0;
        const openInterest = opt.openInterest || 1;
        const volumeOIRatio = volume / openInterest;
        const premium = (opt.last || opt.mark || 0) * volume * 100;

        // Filters for unusual activity
        if (volume < 500) return null; // Minimum volume threshold
        if (volumeOIRatio < 1.5) return null; // Must be 1.5x open interest
        if (premium < 100000) return null; // Min $100k premium

        const daysToExpiration = Math.ceil((new Date(opt.expiration).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        
        // Target 10-180 days (institutional timeframe)
        if (daysToExpiration < 10 || daysToExpiration > 180) return null;

        return {
          opt,
          volume,
          premium,
          volumeOIRatio,
          daysToExpiration,
          score: volumeOIRatio * (premium / 1000000),
        };
      })
      .filter(Boolean)
      .sort((a: any, b: any) => b.score - a.score);

    if (unusualActivities.length === 0) return null;

    const topActivity = unusualActivities[0] as any;
    const opt = topActivity.opt;

    // Determine priority
    const priority = topActivity.premium >= 2000000 ? 'URGENT' : topActivity.premium >= 500000 ? 'HIGH' : 'MEDIUM';
    
    // Calculate confidence
    const confidence = Math.min(95, 60 + (topActivity.volumeOIRatio * 5) + Math.min(20, topActivity.premium / 100000));

    return {
      id: `options_${symbol}_${opt.strike}_${Date.now()}`,
      symbol,
      companyName: symbol,
      type: 'OPTIONS',
      priority,
      confidence: Math.round(confidence),
      currentPrice: underlyingPrice,
      reason: topActivity.premium >= 1000000 
        ? `MASSIVE ${opt.type} SWEEP - Smart money detected`
        : `Unusual ${opt.type} activity - Institutional positioning`,
      details: {
        optionType: opt.type,
        strike: opt.strike,
        expiration: opt.expiration.split(':')[0],
        premium: opt.last || opt.mark || 0,
        volumeContracts: topActivity.volume,
        premiumTotal: topActivity.premium,
        daysToExpiration: topActivity.daysToExpiration,
        volumeOIRatio: topActivity.volumeOIRatio,
      },
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    return null;
  }
}

function filterSuggestions(
  suggestions: Suggestion[],
  minConfidence: number,
  types: string[],
  priorities: string[]
): Suggestion[] {
  return suggestions
    .filter(s => s.confidence >= minConfidence)
    .filter(s => types.includes(s.type))
    .filter(s => priorities.includes(s.priority))
    .slice(0, 20); // Return top 20
}
