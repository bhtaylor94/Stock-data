import { NextRequest, NextResponse } from 'next/server';
import { getSchwabAccessToken, schwabFetchJson } from '@/lib/schwab';
import { detectUnusualActivity } from '@/lib/unusualActivityDetector';
import { getRedis, isRedisAvailable } from '@/lib/redis';

export const runtime = 'nodejs';

const CACHE_DURATION = 30000; // 30 seconds
const REDIS_CACHE_KEY = 'cache:suggestions';

// In-process fallback cache (used when Redis is unavailable)
let cachedSuggestions: any[] = [];
let lastFetchTime = 0;

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

    const now = Date.now();

    // ── Redis cache check ──────────────────────────────────────────────────
    if (isRedisAvailable()) {
      try {
        const cached = await getRedis().get<Suggestion[]>(REDIS_CACHE_KEY);
        if (cached && Array.isArray(cached)) {
          const filtered = filterSuggestions(cached, minConfidence, types, priorities);
          return NextResponse.json({
            success: true,
            suggestions: filtered,
            cached: true,
            nextUpdate: CACHE_DURATION,
          });
        }
      } catch (err) {
        console.error('[Suggestions] Redis cache read error:', err);
      }
    } else {
      // In-process fallback
      if (now - lastFetchTime < CACHE_DURATION && cachedSuggestions.length > 0) {
        const filtered = filterSuggestions(cachedSuggestions, minConfidence, types, priorities);
        return NextResponse.json({
          success: true,
          suggestions: filtered,
          cached: true,
          nextUpdate: CACHE_DURATION - (now - lastFetchTime),
        });
      }
    }

    // ── Fetch fresh suggestions ────────────────────────────────────────────
    const suggestions = await scanMarketForSuggestions();

    if (isRedisAvailable()) {
      try {
        await getRedis().set(REDIS_CACHE_KEY, JSON.stringify(suggestions), { ex: 30 });
      } catch (err) {
        console.error('[Suggestions] Redis cache write error:', err);
      }
    } else {
      cachedSuggestions = suggestions;
      lastFetchTime = now;
    }

    const filtered = filterSuggestions(suggestions, minConfidence, types, priorities);

    return NextResponse.json({
      success: true,
      suggestions: filtered,
      cached: false,
      totalScanned: suggestions.length > 0 ? suggestions.length : MARKET_UNIVERSE.length,
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

async function fetchSchwabMovers(token: string): Promise<string[]> {
  const headers = {
    'Authorization': `Bearer ${token}`,
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Accept': 'application/json',
  };
  const results: string[] = [];
  try {
    const [spxRes, ndxRes] = await Promise.all([
      fetch('https://api.schwabapi.com/marketdata/v1/movers/%24SPX?sort=VOLUME&frequency=0', { headers }),
      fetch('https://api.schwabapi.com/marketdata/v1/movers/%24NDX?sort=PERCENT_CHANGE_UP&frequency=0', { headers }),
    ]);
    for (const res of [spxRes, ndxRes]) {
      if (!res.ok) continue;
      const data = await res.json();
      const movers: any[] = data?.screeners || data?.movers || [];
      for (const m of movers.slice(0, 10)) {
        const sym = m.symbol || m.Symbol || '';
        if (sym && !results.includes(sym)) results.push(sym);
      }
    }
  } catch (err) {
    console.error('[Suggestions] Movers fetch failed:', err);
  }
  return results;
}

async function scanMarketForSuggestions(): Promise<Suggestion[]> {
  const suggestions: Suggestion[] = [];

  // Get Schwab token
  const tokenResult = await getSchwabAccessToken('options', { forceRefresh: false });
  if (!tokenResult.token) {
    console.error('[Suggestions] Auth failed');
    return [];
  }

  // Try live movers; fall back to static universe
  let symbolsToScan: string[] = await fetchSchwabMovers(tokenResult.token);
  let scannedFromMovers = symbolsToScan.length > 0;
  if (!scannedFromMovers) {
    console.log('[Suggestions] Movers unavailable, using static universe');
    symbolsToScan = MARKET_UNIVERSE.slice(0, 15);
  }

  // Scan each symbol
  for (const symbol of symbolsToScan.slice(0, 20)) { // Limit to avoid rate limits
    try {
      // 1. Get options data for unusual activity
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
    
    // Only suggest if AI confidence is reasonable
    if (!analysis || analysis.consensus !== 'BUY' || analysis.consensusScore < 65) {
      return null;
    }

    // Calculate priority based on consensus strength
    const priority = analysis.consensusScore >= 85 ? 'HIGH' : analysis.consensusScore >= 75 ? 'MEDIUM' : 'MEDIUM';

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

    // Detect unusual activity with INSTITUTIONAL filters
    const unusualActivities = allOptions
      .map(opt => {
        const volume = opt.totalVolume || 0;
        const openInterest = opt.openInterest || 1;
        const volumeOIRatio = volume / openInterest;
        const premium = (opt.last || opt.mark || 0) * volume * 100;

        // INSTITUTIONAL FILTERS (based on research)
        if (volume < 50) return null; // Minimum 50 contracts (institutional size)
        if (volumeOIRatio < 5) return null; // Must be 5x open interest (significant new positioning)
        if (premium < 500000) return null; // Min $500k premium (institutional threshold)

        const daysToExpiration = Math.ceil((new Date(opt.expiration).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        
        // INSTITUTIONAL TIME HORIZON: 30-180 days
        if (daysToExpiration < 30 || daysToExpiration > 180) return null;

        // Strike selection: Slightly OTM (2-10% from current price)
        const strikeDistance = Math.abs(opt.strike - underlyingPrice) / underlyingPrice;
        if (strikeDistance > 0.10) return null; // Skip deep OTM (lottery tickets)

        return {
          opt,
          volume,
          premium,
          volumeOIRatio,
          daysToExpiration,
          strikeDistance,
          score: volumeOIRatio * (premium / 1000000), // Score by size and urgency
        };
      })
      .filter(Boolean)
      .sort((a: any, b: any) => b.score - a.score);

    if (unusualActivities.length === 0) return null;

    const topActivity = unusualActivities[0] as any;
    const opt = topActivity.opt;

    // Determine priority based on premium size
    const priority = topActivity.premium >= 2000000 ? 'URGENT' : topActivity.premium >= 1000000 ? 'HIGH' : 'MEDIUM';
    
    // Calculate confidence score
    let confidence = 60; // Base
    if (topActivity.premium >= 1000000) confidence += 10; // $1M+ premium
    if (topActivity.daysToExpiration >= 30 && topActivity.daysToExpiration <= 90) confidence += 10; // Sweet spot DTE
    if (topActivity.volumeOIRatio >= 10) confidence += 5; // Extremely unusual
    if (topActivity.strikeDistance >= 0.02 && topActivity.strikeDistance <= 0.05) confidence += 5; // Slightly OTM (conviction)
    confidence = Math.min(95, confidence);

    return {
      id: `options_${symbol}_${opt.strike}_${Date.now()}`,
      symbol,
      companyName: symbol,
      type: 'OPTIONS',
      priority,
      confidence: Math.round(confidence),
      currentPrice: underlyingPrice,
      reason: topActivity.premium >= 1000000 
        ? `MAJOR ${opt.type} SWEEP - Institutional positioning detected`
        : `Unusual ${opt.type} activity - Smart money flow detected`,
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
