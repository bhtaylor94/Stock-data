import { NextRequest, NextResponse } from 'next/server';

// ============================================================
// SUGGESTION TRACKER API
// Features:
// - Save tracked suggestions with entry price
// - Retrieve all tracked suggestions with current performance
// - Update suggestion status (hit target, stopped out, closed)
// - Calculate performance metrics
// ============================================================

const SCHWAB_APP_KEY = process.env.SCHWAB_APP_KEY;
const SCHWAB_APP_SECRET = process.env.SCHWAB_APP_SECRET;
const SCHWAB_REFRESH_TOKEN = process.env.SCHWAB_REFRESH_TOKEN;

// ============================================================
// IN-MEMORY STORAGE (Use database in production)
// For demo purposes, we use a global variable
// In production, use Vercel KV, Supabase, or similar
// ============================================================
interface TrackedSuggestion {
  id: string;
  ticker: string;
  type: 'STOCK_BUY' | 'STOCK_SELL' | 'CALL' | 'PUT' | 'ALERT';
  strategy: string;
  entryPrice: number;
  currentPrice?: number;
  targetPrice?: number;
  stopLoss?: number;
  confidence: number;
  reasoning: string[];
  
  // Options specific
  optionContract?: {
    strike: number;
    expiration: string;
    dte: number;
    delta: number;
    entryAsk: number;
  };
  
  // Tracking metadata
  trackedAt: string;
  status: 'ACTIVE' | 'HIT_TARGET' | 'STOPPED_OUT' | 'EXPIRED' | 'CLOSED';
  closedAt?: string;
  closedPrice?: number;
  
  // Performance
  pnl?: number;
  pnlPercent?: number;
}

// Global storage (resets on serverless cold start - use DB in production)
declare global {
  var trackedSuggestions: TrackedSuggestion[] | undefined;
}

if (!global.trackedSuggestions) {
  global.trackedSuggestions = [];
}

// ============================================================
// SCHWAB AUTH (reused from other routes)
// ============================================================
interface TokenCache {
  accessToken: string;
  expiresAt: number;
}

let tokenCache: TokenCache | null = null;

async function getSchwabToken(): Promise<string | null> {
  if (!SCHWAB_APP_KEY || !SCHWAB_APP_SECRET || !SCHWAB_REFRESH_TOKEN) return null;
  
  const now = Date.now();
  if (tokenCache && tokenCache.expiresAt > now + 120000) {
    return tokenCache.accessToken;
  }
  
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
    const expiresIn = data.expires_in || 1800;
    tokenCache = {
      accessToken: data.access_token,
      expiresAt: now + (expiresIn * 1000),
    };
    
    return data.access_token;
  } catch {
    return null;
  }
}

async function fetchCurrentPrice(token: string, symbol: string): Promise<number | null> {
  try {
    const res = await fetch(`https://api.schwabapi.com/marketdata/v1/quotes?symbols=${symbol}`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data[symbol]?.quote?.lastPrice || null;
  } catch {
    return null;
  }
}

// ============================================================
// API HANDLERS
// ============================================================

// GET - Retrieve all tracked suggestions with current prices
export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const suggestions = global.trackedSuggestions || [];
  
  // Get current prices for active suggestions
  const schwabToken = await getSchwabToken();
  const uniqueTickers = [...new Set(suggestions.filter(s => s.status === 'ACTIVE').map(s => s.ticker))];
  
  const priceMap: { [ticker: string]: number } = {};
  
  if (schwabToken && uniqueTickers.length > 0) {
    // Batch fetch prices
    for (const ticker of uniqueTickers) {
      const price = await fetchCurrentPrice(schwabToken, ticker);
      if (price) priceMap[ticker] = price;
    }
  }
  
  // Calculate performance for each suggestion
  const suggestionsWithPerformance = suggestions.map(s => {
    const currentPrice = s.status === 'ACTIVE' ? (priceMap[s.ticker] || s.entryPrice) : (s.closedPrice || s.entryPrice);
    
    let pnl = 0;
    let pnlPercent = 0;
    
    if (s.type === 'CALL' || s.type === 'PUT') {
      // Options P&L (simplified - just track underlying movement direction)
      const priceChange = currentPrice - s.entryPrice;
      const direction = s.type === 'CALL' ? 1 : -1;
      pnlPercent = (priceChange / s.entryPrice) * 100 * direction;
      pnl = priceChange * direction;
    } else if (s.type === 'STOCK_BUY') {
      pnl = currentPrice - s.entryPrice;
      pnlPercent = (pnl / s.entryPrice) * 100;
    } else if (s.type === 'STOCK_SELL') {
      pnl = s.entryPrice - currentPrice;
      pnlPercent = (pnl / s.entryPrice) * 100;
    }
    
    // Check if hit target or stop loss
    let status = s.status;
    if (s.status === 'ACTIVE') {
      if (s.targetPrice && s.type === 'STOCK_BUY' && currentPrice >= s.targetPrice) {
        status = 'HIT_TARGET';
      } else if (s.targetPrice && s.type === 'STOCK_SELL' && currentPrice <= s.targetPrice) {
        status = 'HIT_TARGET';
      } else if (s.stopLoss && s.type === 'STOCK_BUY' && currentPrice <= s.stopLoss) {
        status = 'STOPPED_OUT';
      } else if (s.stopLoss && s.type === 'STOCK_SELL' && currentPrice >= s.stopLoss) {
        status = 'STOPPED_OUT';
      }
      
      // Check options expiration
      if (s.optionContract && s.optionContract.dte <= 0) {
        status = 'EXPIRED';
      }
    }
    
    return {
      ...s,
      currentPrice,
      pnl: Math.round(pnl * 100) / 100,
      pnlPercent: Math.round(pnlPercent * 100) / 100,
      status,
    };
  });
  
  // Calculate aggregate stats
  const activeCount = suggestionsWithPerformance.filter(s => s.status === 'ACTIVE').length;
  const closedCount = suggestionsWithPerformance.filter(s => s.status !== 'ACTIVE').length;
  const winners = suggestionsWithPerformance.filter(s => s.status !== 'ACTIVE' && s.pnlPercent > 0).length;
  const winRate = closedCount > 0 ? Math.round((winners / closedCount) * 100) : 0;
  const avgReturn = suggestionsWithPerformance.length > 0 
    ? Math.round(suggestionsWithPerformance.reduce((sum, s) => sum + (s.pnlPercent || 0), 0) / suggestionsWithPerformance.length * 100) / 100
    : 0;
  
  return NextResponse.json({
    suggestions: suggestionsWithPerformance.sort((a, b) => 
      new Date(b.trackedAt).getTime() - new Date(a.trackedAt).getTime()
    ),
    stats: {
      total: suggestions.length,
      active: activeCount,
      closed: closedCount,
      winners,
      losers: closedCount - winners,
      winRate,
      avgReturn,
    },
    lastUpdated: new Date().toISOString(),
    responseTimeMs: Date.now() - startTime,
  });
}

// POST - Add a new tracked suggestion
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const {
      ticker,
      type,
      strategy,
      entryPrice,
      targetPrice,
      stopLoss,
      confidence,
      reasoning,
      optionContract,
    } = body;
    
    if (!ticker || !type || !entryPrice) {
      return NextResponse.json({ error: 'Missing required fields: ticker, type, entryPrice' }, { status: 400 });
    }
    
    const newSuggestion: TrackedSuggestion = {
      id: `${ticker}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      ticker: ticker.toUpperCase(),
      type,
      strategy: strategy || `${type} on ${ticker}`,
      entryPrice,
      targetPrice,
      stopLoss,
      confidence: confidence || 0,
      reasoning: reasoning || [],
      optionContract,
      trackedAt: new Date().toISOString(),
      status: 'ACTIVE',
    };
    
    global.trackedSuggestions = global.trackedSuggestions || [];
    global.trackedSuggestions.push(newSuggestion);
    
    return NextResponse.json({
      success: true,
      suggestion: newSuggestion,
      message: `Tracking ${type} on ${ticker} at $${entryPrice}`,
    });
  } catch (err) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
}

// PUT - Update suggestion status
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, status, closedPrice } = body;
    
    if (!id || !status) {
      return NextResponse.json({ error: 'Missing required fields: id, status' }, { status: 400 });
    }
    
    const suggestions = global.trackedSuggestions || [];
    const index = suggestions.findIndex(s => s.id === id);
    
    if (index === -1) {
      return NextResponse.json({ error: 'Suggestion not found' }, { status: 404 });
    }
    
    suggestions[index] = {
      ...suggestions[index],
      status,
      closedAt: status !== 'ACTIVE' ? new Date().toISOString() : undefined,
      closedPrice: closedPrice || suggestions[index].currentPrice,
    };
    
    return NextResponse.json({
      success: true,
      suggestion: suggestions[index],
    });
  } catch (err) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
}

// DELETE - Remove a tracked suggestion
export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  
  if (!id) {
    return NextResponse.json({ error: 'Missing id parameter' }, { status: 400 });
  }
  
  const suggestions = global.trackedSuggestions || [];
  const index = suggestions.findIndex(s => s.id === id);
  
  if (index === -1) {
    return NextResponse.json({ error: 'Suggestion not found' }, { status: 404 });
  }
  
  suggestions.splice(index, 1);
  
  return NextResponse.json({
    success: true,
    message: 'Suggestion removed',
  });
}
