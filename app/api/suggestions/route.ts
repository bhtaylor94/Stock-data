import { NextRequest, NextResponse } from 'next/server';
import { getSchwabAccessToken, schwabFetchJson } from '@/lib/schwab';
import { detectUnusualActivity } from '@/lib/unusualActivityDetector';

export const runtime = 'nodejs';

// Cache for suggestions (refreshed every 30 seconds)
let cachedSuggestions: any[] = [];
let lastFetchTime = 0;
const CACHE_DURATION = 30000; // 30 seconds

function baseUrlFromEnv(): string {
  // Prefer explicit base URL when set, otherwise fall back to Vercel URL or localhost.
  const explicit = (process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || '').trim();
  if (explicit) return explicit.replace(/\/$/, '');
  const vercel = (process.env.VERCEL_URL || '').trim();
  if (vercel) return `https://${vercel}`;
  return 'http://localhost:3000';
}

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
    const baseUrl = baseUrlFromEnv();
    const res = await fetch(`${baseUrl}/api/stock/${symbol}`, { cache: 'no-store' });
    const data: any = await res.json();

    // Our stock endpoint returns { ... meta.tradeDecision, analysis..., suggestions... }
    const td = data?.meta?.tradeDecision;
    const top = Array.isArray(data?.suggestions) ? data.suggestions[0] : null;

    if (!td || !td.action) return null;

    // Only bubble up high-quality stock setups (avoid noise)
    const actionable = ['BUY', 'STRONG_BUY', 'SELL', 'STRONG_SELL'].includes(td.action);
    const conf = Number(td.confidence ?? 0);
    if (!actionable || conf < 70) return null;

    const isBull = td.action === 'BUY' || td.action === 'STRONG_BUY';
    const priority = conf >= 85 ? 'HIGH' : conf >= 78 ? 'MEDIUM' : 'MEDIUM';
    const reason = top?.reasoning?.[0] ? String(top.reasoning[0]) : `${td.action} (calibrated) – ${conf}%`; 

    return {
      id: `stock_${symbol}_${Date.now()}`,
      symbol,
      companyName: data?.name || symbol,
      type: 'STOCK',
      priority,
      confidence: Math.round(conf),
      currentPrice: Number(data?.price || 0),
      reason,
      details: {
        action: td.action,
        regime: data?.meta?.regime,
        atrPct: data?.meta?.atrPct,
        targetPrice: top?.target || null,
        stop: top?.stop || null,
        timeHorizon: top?.timeHorizon || null,
        expectedReturn: data?.analysts?.targetUpside ?? null,
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

    // Build options chain array (CALLS + PUTS)
    const allOptions: any[] = [];
    const pushMap = (expDateMap: any, type: 'CALL' | 'PUT') => {
      if (!expDateMap) return;
      for (const expKey in expDateMap) {
        for (const strike in expDateMap[expKey]) {
          const arr = expDateMap[expKey][strike];
          (arr || []).forEach((opt: any) => {
            allOptions.push({
              ...opt,
              type,
              strike: parseFloat(strike),
              expiration: expKey,
            });
          });
        }
      }
    };
    pushMap(optionsData.callExpDateMap, 'CALL');
    pushMap(optionsData.putExpDateMap, 'PUT');

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

        // Schwab expiration keys often look like "YYYY-MM-DD:###".
        // If we don't strip the suffix, Date parsing can yield NaN which bypasses our DTE filter.
        const expIso = String(opt.expiration || '').split(':')[0];
        const expMs = new Date(expIso).getTime();
        const daysToExpiration = Number.isFinite(expMs)
          ? Math.ceil((expMs - Date.now()) / (1000 * 60 * 60 * 24))
          : (opt.daysToExpiration ?? 0);
        
        // INSTITUTIONAL TIME HORIZON: 30-180 days
        if (daysToExpiration < 30 || daysToExpiration > 180) return null;

        // Strike selection: Slightly OTM (2-10% from current price)
        const strikeDistance = underlyingPrice > 0 ? Math.abs(opt.strike - underlyingPrice) / underlyingPrice : 1;
        if (strikeDistance > 0.10) return null; // Skip deep OTM (lottery tickets)

        // Avoid ultra-cheap lottery tickets even if volume is high
        const premiumPerContract = (opt.last || opt.mark || 0) * 100;
        if (premiumPerContract < 40) return null;

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
