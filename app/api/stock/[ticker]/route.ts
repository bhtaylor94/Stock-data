import { NextResponse } from 'next/server';
import { getSchwabAccessToken } from '@/lib/schwab';

export const runtime = 'nodejs';

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

// CRITICAL FIX: Headers required for Akamai/Schwab API
// Without User-Agent, Akamai's CDN blocks requests with 403
const SCHWAB_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'application/json',
  'Accept-Language': 'en-US,en;q=0.9',
};

// ============================================================
// Accuracy-first helpers (freshness gates, regime detection, confidence calibration)
// ============================================================

type MarketRegime = 'TREND' | 'RANGE' | 'HIGH_VOL';

function computeRegime(priceHistory: { close: number; high: number; low: number }[], sma50: number, sma200: number) : { regime: MarketRegime; atrPct: number; trendStrength: number } {
  if (!priceHistory || priceHistory.length < 60) return { regime: 'RANGE', atrPct: 0, trendStrength: 0 };
  const last = priceHistory[priceHistory.length - 1];
  // ATR(14) approximate
  const n = 14;
  const start = Math.max(1, priceHistory.length - n);
  let trSum = 0;
  for (let i = start; i < priceHistory.length; i++) {
    const cur = priceHistory[i];
    const prev = priceHistory[i-1];
    const tr = Math.max(cur.high - cur.low, Math.abs(cur.high - prev.close), Math.abs(cur.low - prev.close));
    trSum += tr;
  }
  const atr = trSum / Math.max(1, (priceHistory.length - start));
  const atrPct = last.close > 0 ? (atr / last.close) * 100 : 0;

  const trendStrength = last.close > 0 ? (Math.abs(sma50 - sma200) / last.close) * 100 : 0;

  // Regime rules (simple but stable):
  // - HIGH_VOL if ATR% elevated
  // - TREND if 50/200 separation meaningful
  // - otherwise RANGE
  const regime: MarketRegime =
    atrPct >= 4 ? 'HIGH_VOL' :
    trendStrength >= 2 ? 'TREND' :
    'RANGE';

  return { regime, atrPct: Math.round(atrPct * 100) / 100, trendStrength: Math.round(trendStrength * 100) / 100 };
}

function calibratedConfidence(modelScore: number, maxScore: number, agreementCount: number, completeness: number, regime: MarketRegime) {
  // Conservative calibration: we prefer fewer high-confidence calls.
  const pct = maxScore > 0 ? (modelScore / maxScore) * 100 : 0;
  let conf =
    pct >= 80 ? 78 :
    pct >= 70 ? 68 :
    pct >= 60 ? 58 :
    pct >= 50 ? 50 :
    42;

  // Agreement and completeness are hard gates for "high accuracy"
  if (agreementCount >= 5) conf += 6;
  else if (agreementCount === 4) conf += 2;
  else conf -= 10;

  if (completeness >= 90) conf += 4;
  else if (completeness < 80) conf -= 12;

  // Regime adjustment (trend = slightly more reliable for trend-following signals)
  if (regime === 'TREND') conf += 3;
  if (regime === 'HIGH_VOL') conf -= 4;

  conf = Math.max(5, Math.min(95, Math.round(conf)));
  const bucket = conf >= 75 ? 'HIGH' : conf >= 60 ? 'MED' : 'LOW';
  return { confidence: conf, bucket, calibrationVersion: 'v1.0-conservative' as const };
}

function buildNoTrade(reason: string[], asOfIso: string) {
  return [{
    type: 'NO_TRADE',
    timeHorizon: 'N/A',
    setup: 'NO_TRADE',
    entry: null,
    target: null,
    stop: null,
    invalidation: null,
    confidence: 0,
    reasoning: reason.length ? reason : ['No trade conditions met.'],
    asOf: asOfIso
  }];
}

// ============================================================
// TOKEN CACHE - Schwab access tokens last 30 minutes
// Cache them to avoid hitting rate limits on the oauth endpoint
// ============================================================
interface TokenCache {
  accessToken: string;
  expiresAt: number; // Unix timestamp
}

let tokenCache: TokenCache | null = null;

// ============================================================
// SCHWAB AUTH WITH CACHING
// ============================================================
async function getSchwabToken(): Promise<string | null> {
  const res = await getSchwabAccessToken('stock');
  if (!res.token) {
    console.warn(res.error || '[Schwab Stock] Token error');
    return null;
  }
  return res.token;
}

async function fetchSchwabQuote(token: string, symbol: string) {
  try {
    const res = await fetch(`https://api.schwabapi.com/marketdata/v1/quotes?symbols=${symbol}&indicative=false`, {
      headers: { 
        'Authorization': `Bearer ${token}`,
        ...SCHWAB_HEADERS, // CRITICAL: Add headers for Akamai/Schwab
      },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data[symbol];
  } catch { return null; }
}

async function fetchSchwabPriceHistory(token: string, symbol: string): Promise<{ open: number; close: number; high: number; low: number; volume: number }[]> {
  try {
    const res = await fetch(`https://api.schwabapi.com/marketdata/v1/pricehistory?symbol=${symbol}&periodType=year&period=1&frequencyType=daily&frequency=1`, {
      headers: { 
        'Authorization': `Bearer ${token}`,
        ...SCHWAB_HEADERS, // CRITICAL: Add headers for Akamai/Schwab
      },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.candles || []).map((c: any) => ({ open: c.open, close: c.close, high: c.high, low: c.low, volume: c.volume }));
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


// Historical candles (Finnhub fallback when Schwab pricehistory is unavailable)
async function getFinnhubCandles(symbol: string) : Promise<{ open: number; close: number; high: number; low: number; volume: number }[]> {
  if (!FINNHUB_KEY) return [];
  const toSec = Math.floor(Date.now() / 1000);
  // ~540 calendar days gives enough daily candles for SMA200 even with holidays/weekends
  const fromSec = toSec - (540 * 24 * 60 * 60);
  try {
    const res = await fetch(`https://finnhub.io/api/v1/stock/candle?symbol=${symbol}&resolution=D&from=${fromSec}&to=${toSec}&token=${FINNHUB_KEY}`);
    if (!res.ok) return [];
    const data: any = await res.json();
    if (!data || data.s !== 'ok' || !Array.isArray(data.c)) return [];
    const out: { open: number; close: number; high: number; low: number; volume: number }[] = [];
    const n = data.c.length;
    for (let i = 0; i < n; i++) {
      out.push({
        open: Number(data.o?.[i] ?? data.c[i] ?? 0),
        close: Number(data.c?.[i] ?? 0),
        high: Number(data.h?.[i] ?? 0),
        low: Number(data.l?.[i] ?? 0),
        volume: Number(data.v?.[i] ?? 0),
      });
    }
    return out.filter(x => Number.isFinite(x.close) && x.close > 0);
  } catch {
    return [];
  }
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
// PROFESSIONAL CHART PATTERN DETECTION
// Research-backed patterns with historical success rates
// More realistic confirmation criteria based on actual market behavior
// ============================================================

interface PatternCandle {
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface PatternResult {
  detected: boolean;
  confirmed: boolean;  // Breakout/breakdown occurred
  confidence: number;  // 0-100 confidence score
  target?: number;
  stopLoss?: number;
  upside?: string;
  downside?: string;
  volumeRatio?: number;  // Current volume vs 20-day avg
  priceAboveBreakout?: number;  // % above breakout level
  status: 'CONFIRMED' | 'FORMING' | 'NOT_DETECTED';
  statusReason: string;
}

// Calculate average volume
function getAvgVolume(candles: PatternCandle[], days = 20): number {
  if (candles.length < days) return 0;
  const recentVol = candles.slice(-days).map(c => c.volume);
  return recentVol.reduce((a, b) => a + b, 0) / days;
}

// Volume confirmation - more lenient (25%+ above average is significant)
function isVolumeConfirmed(currentVolume: number, avgVolume: number): boolean {
  return avgVolume > 0 && currentVolume >= avgVolume * 1.25;
}

// Calculate volume trend (are recent volumes increasing?)
function isVolumeIncreasing(candles: PatternCandle[], lookback = 5): boolean {
  if (candles.length < lookback * 2) return false;
  const recent = candles.slice(-lookback);
  const prior = candles.slice(-(lookback * 2), -lookback);
  const recentAvg = recent.reduce((sum, c) => sum + c.volume, 0) / lookback;
  const priorAvg = prior.reduce((sum, c) => sum + c.volume, 0) / lookback;
  return recentAvg > priorAvg * 1.1; // 10% increase
}

// BULLISH: Cup & Handle (95% success rate)
function detectCupAndHandle(candles: PatternCandle[]): PatternResult {
  const notDetected: PatternResult = { detected: false, confirmed: false, confidence: 0, status: 'NOT_DETECTED', statusReason: 'Pattern not found' };
  
  if (candles.length < 40) return { ...notDetected, statusReason: 'Insufficient data (need 40+ days)' };
  
  const recent = candles.slice(-50);
  const prices = recent.map(c => c.close);
  const volumes = recent.map(c => c.volume);
  
  // Find the lowest point (cup bottom)
  const cupBottom = Math.min(...prices.slice(5, 35));
  const bottomIdx = prices.indexOf(cupBottom);
  
  // Cup start should be higher than cup bottom
  const cupStart = Math.max(...prices.slice(0, Math.max(5, bottomIdx - 5)));
  const cupEnd = Math.max(...prices.slice(Math.min(bottomIdx + 5, prices.length - 10)));
  
  // Validate cup shape
  const cupDepth = ((cupStart - cupBottom) / cupStart) * 100;
  if (cupDepth < 8 || cupDepth > 35) return { ...notDetected, statusReason: `Cup depth ${cupDepth.toFixed(1)}% outside 8-35% range` };
  
  // Cup end should recover to near cup start (within 10%)
  const recovery = (cupEnd / cupStart) * 100;
  if (recovery < 85) return { ...notDetected, statusReason: `Cup hasn't recovered (${recovery.toFixed(1)}% of start)` };
  
  // Handle: Look at last 10 days
  const handlePrices = prices.slice(-10);
  const handleHigh = Math.max(...handlePrices.slice(0, 5));
  const handleLow = Math.min(...handlePrices);
  const handleDepth = ((handleHigh - handleLow) / handleHigh) * 100;
  
  if (handleDepth > 15) return { ...notDetected, statusReason: `Handle too deep (${handleDepth.toFixed(1)}%)` };
  
  const currentPrice = prices[prices.length - 1];
  const resistance = Math.max(cupStart, cupEnd, handleHigh);
  const avgVolume = getAvgVolume(candles);
  const currentVolume = volumes[volumes.length - 1];
  const volumeRatio = avgVolume > 0 ? currentVolume / avgVolume : 1;
  
  // Check for breakout
  const breakout = currentPrice > resistance;
  const priceAboveBreakout = breakout ? ((currentPrice - resistance) / resistance * 100) : 0;
  
  // Calculate target
  const target = resistance + (cupStart - cupBottom);
  const stopLoss = handleLow * 0.98;
  
  // Determine status and confidence
  let status: 'CONFIRMED' | 'FORMING' | 'NOT_DETECTED' = 'FORMING';
  let confidence = 45;
  let statusReason = `Forming: Price at $${currentPrice.toFixed(2)}, resistance at $${resistance.toFixed(2)}`;
  
  if (breakout) {
    status = 'CONFIRMED';
    confidence = 70;
    statusReason = `CONFIRMED: Broke above $${resistance.toFixed(2)} resistance`;
    
    if (priceAboveBreakout >= 2) confidence += 10;
    if (volumeRatio >= 1.25) confidence += 10;
    if (isVolumeIncreasing(candles)) confidence += 5;
  } else {
    // Still forming - how close to breakout?
    const proximityToBreakout = ((resistance - currentPrice) / resistance * 100);
    if (proximityToBreakout < 2) {
      confidence = 55;
      statusReason = `Near breakout: ${proximityToBreakout.toFixed(1)}% from resistance`;
    }
  }
  
  return {
    detected: true,
    confirmed: breakout,
    confidence: Math.min(95, confidence),
    target,
    stopLoss,
    upside: ((target - currentPrice) / currentPrice * 100).toFixed(1),
    volumeRatio: Math.round(volumeRatio * 100) / 100,
    priceAboveBreakout: Math.round(priceAboveBreakout * 100) / 100,
    status,
    statusReason,
  };
}

// BULLISH: Double Bottom (88% success rate)
function detectDoubleBottom(candles: PatternCandle[]): PatternResult {
  const notDetected: PatternResult = { detected: false, confirmed: false, confidence: 0, status: 'NOT_DETECTED', statusReason: 'Pattern not found' };
  
  if (candles.length < 25) return { ...notDetected, statusReason: 'Insufficient data' };
  
  const recent = candles.slice(-30);
  const prices = recent.map(c => c.close);
  const volumes = recent.map(c => c.volume);
  
  // Find local minimums
  const lows: { idx: number; price: number }[] = [];
  for (let i = 2; i < prices.length - 2; i++) {
    if (prices[i] < prices[i-1] && prices[i] < prices[i-2] &&
        prices[i] < prices[i+1] && prices[i] < prices[i+2]) {
      lows.push({ idx: i, price: prices[i] });
    }
  }
  
  if (lows.length < 2) return { ...notDetected, statusReason: 'Need 2 distinct lows' };
  
  // Find two bottoms that are close in price (within 4%)
  let bestPair: { bottom1: typeof lows[0]; bottom2: typeof lows[0] } | null = null;
  for (let i = 0; i < lows.length - 1; i++) {
    for (let j = i + 1; j < lows.length; j++) {
      const diff = Math.abs(lows[i].price - lows[j].price) / lows[i].price;
      const distance = lows[j].idx - lows[i].idx;
      if (diff <= 0.04 && distance >= 7 && distance <= 25) {
        bestPair = { bottom1: lows[i], bottom2: lows[j] };
        break;
      }
    }
    if (bestPair) break;
  }
  
  if (!bestPair) return { ...notDetected, statusReason: 'No matching double bottom found' };
  
  const { bottom1, bottom2 } = bestPair;
  
  // Find the peak (neckline) between bottoms
  const middleSection = prices.slice(bottom1.idx, bottom2.idx + 1);
  const neckline = Math.max(...middleSection);
  
  const currentPrice = prices[prices.length - 1];
  const avgVolume = getAvgVolume(candles);
  const currentVolume = volumes[volumes.length - 1];
  const volumeRatio = avgVolume > 0 ? currentVolume / avgVolume : 1;
  
  const breakout = currentPrice > neckline;
  const priceAboveBreakout = breakout ? ((currentPrice - neckline) / neckline * 100) : 0;
  
  const bottomAvg = (bottom1.price + bottom2.price) / 2;
  const target = neckline + (neckline - bottomAvg);
  const stopLoss = bottomAvg * 0.98;
  
  let status: 'CONFIRMED' | 'FORMING' | 'NOT_DETECTED' = 'FORMING';
  let confidence = 45;
  let statusReason = `Forming: Neckline at $${neckline.toFixed(2)}`;
  
  if (breakout) {
    status = 'CONFIRMED';
    confidence = 70;
    statusReason = `CONFIRMED: Broke above $${neckline.toFixed(2)} neckline`;
    if (priceAboveBreakout >= 2) confidence += 10;
    if (volumeRatio >= 1.25) confidence += 10;
  }
  
  return {
    detected: true,
    confirmed: breakout,
    confidence: Math.min(90, confidence),
    target,
    stopLoss,
    upside: ((target - currentPrice) / currentPrice * 100).toFixed(1),
    volumeRatio: Math.round(volumeRatio * 100) / 100,
    priceAboveBreakout: Math.round(priceAboveBreakout * 100) / 100,
    status,
    statusReason,
  };
}

// BEARISH: Double Top (75% success rate)
function detectDoubleTop(candles: PatternCandle[]): PatternResult {
  const notDetected: PatternResult = { detected: false, confirmed: false, confidence: 0, status: 'NOT_DETECTED', statusReason: 'Pattern not found' };
  
  if (candles.length < 25) return { ...notDetected, statusReason: 'Insufficient data' };
  
  const recent = candles.slice(-30);
  const prices = recent.map(c => c.close);
  const volumes = recent.map(c => c.volume);
  
  // Find local maximums
  const highs: { idx: number; price: number }[] = [];
  for (let i = 2; i < prices.length - 2; i++) {
    if (prices[i] > prices[i-1] && prices[i] > prices[i-2] &&
        prices[i] > prices[i+1] && prices[i] > prices[i+2]) {
      highs.push({ idx: i, price: prices[i] });
    }
  }
  
  if (highs.length < 2) return { ...notDetected, statusReason: 'Need 2 distinct highs' };
  
  // Find two tops that are close in price
  let bestPair: { top1: typeof highs[0]; top2: typeof highs[0] } | null = null;
  for (let i = 0; i < highs.length - 1; i++) {
    for (let j = i + 1; j < highs.length; j++) {
      const diff = Math.abs(highs[i].price - highs[j].price) / highs[i].price;
      const distance = highs[j].idx - highs[i].idx;
      if (diff <= 0.04 && distance >= 7 && distance <= 25) {
        bestPair = { top1: highs[i], top2: highs[j] };
        break;
      }
    }
    if (bestPair) break;
  }
  
  if (!bestPair) return { ...notDetected, statusReason: 'No matching double top found' };
  
  const { top1, top2 } = bestPair;
  
  // Find the trough (neckline) between tops
  const middleSection = prices.slice(top1.idx, top2.idx + 1);
  const neckline = Math.min(...middleSection);
  
  const currentPrice = prices[prices.length - 1];
  const avgVolume = getAvgVolume(candles);
  const currentVolume = volumes[volumes.length - 1];
  const volumeRatio = avgVolume > 0 ? currentVolume / avgVolume : 1;
  
  const breakdown = currentPrice < neckline;
  const priceBelowBreakdown = breakdown ? ((neckline - currentPrice) / neckline * 100) : 0;
  
  const topAvg = (top1.price + top2.price) / 2;
  const target = neckline - (topAvg - neckline);
  const stopLoss = topAvg * 1.02;
  
  let status: 'CONFIRMED' | 'FORMING' | 'NOT_DETECTED' = 'FORMING';
  let confidence = 40;
  let statusReason = `Forming: Neckline support at $${neckline.toFixed(2)}`;
  
  if (breakdown) {
    status = 'CONFIRMED';
    confidence = 65;
    statusReason = `CONFIRMED: Broke below $${neckline.toFixed(2)} support`;
    if (priceBelowBreakdown >= 2) confidence += 10;
    if (volumeRatio >= 1.25) confidence += 10;
  }
  
  return {
    detected: true,
    confirmed: breakdown,
    confidence: Math.min(85, confidence),
    target,
    stopLoss,
    downside: ((currentPrice - target) / currentPrice * 100).toFixed(1),
    volumeRatio: Math.round(volumeRatio * 100) / 100,
    priceAboveBreakout: -Math.round(priceBelowBreakdown * 100) / 100,
    status,
    statusReason,
  };
}

// BULLISH: Inverse Head & Shoulders (89% success rate)
function detectInverseHeadShoulders(candles: PatternCandle[]): PatternResult {
  const notDetected: PatternResult = { detected: false, confirmed: false, confidence: 0, status: 'NOT_DETECTED', statusReason: 'Pattern not found' };
  
  if (candles.length < 35) return { ...notDetected, statusReason: 'Insufficient data' };
  
  const recent = candles.slice(-40);
  const prices = recent.map(c => c.close);
  const volumes = recent.map(c => c.volume);
  
  // Find local minimums (potential shoulders and head)
  const lows: { idx: number; price: number }[] = [];
  for (let i = 3; i < prices.length - 3; i++) {
    if (prices[i] < prices[i-1] && prices[i] < prices[i-2] &&
        prices[i] < prices[i+1] && prices[i] < prices[i+2]) {
      lows.push({ idx: i, price: prices[i] });
    }
  }
  
  if (lows.length < 3) return { ...notDetected, statusReason: 'Need 3 distinct lows' };
  
  // Find pattern: left shoulder - head (lowest) - right shoulder
  let bestPattern: { ls: typeof lows[0]; head: typeof lows[0]; rs: typeof lows[0] } | null = null;
  
  for (let i = 0; i < lows.length - 2; i++) {
    for (let j = i + 1; j < lows.length - 1; j++) {
      for (let k = j + 1; k < lows.length; k++) {
        const ls = lows[i];
        const head = lows[j];
        const rs = lows[k];
        
        // Head must be lower than both shoulders
        if (head.price < ls.price && head.price < rs.price) {
          // Shoulders should be similar height (within 5%)
          const shoulderDiff = Math.abs(ls.price - rs.price) / ls.price;
          // Head should be meaningfully lower (at least 3%)
          const headDepth = (ls.price - head.price) / ls.price;
          
          if (shoulderDiff <= 0.05 && headDepth >= 0.03) {
            bestPattern = { ls, head, rs };
            break;
          }
        }
      }
      if (bestPattern) break;
    }
    if (bestPattern) break;
  }
  
  if (!bestPattern) return { ...notDetected, statusReason: 'No valid inverse H&S structure' };
  
  const { ls, head, rs } = bestPattern;
  
  // Calculate neckline
  const leftPeak = Math.max(...prices.slice(ls.idx, head.idx));
  const rightPeak = Math.max(...prices.slice(head.idx, rs.idx + 1));
  const neckline = (leftPeak + rightPeak) / 2;
  
  const currentPrice = prices[prices.length - 1];
  const avgVolume = getAvgVolume(candles);
  const currentVolume = volumes[volumes.length - 1];
  const volumeRatio = avgVolume > 0 ? currentVolume / avgVolume : 1;
  
  const breakout = currentPrice > neckline;
  const priceAboveBreakout = breakout ? ((currentPrice - neckline) / neckline * 100) : 0;
  
  const target = neckline + (neckline - head.price);
  const stopLoss = rs.price * 0.98;
  
  let status: 'CONFIRMED' | 'FORMING' | 'NOT_DETECTED' = 'FORMING';
  let confidence = 50;
  let statusReason = `Forming: Neckline at $${neckline.toFixed(2)}`;
  
  if (breakout) {
    status = 'CONFIRMED';
    confidence = 75;
    statusReason = `CONFIRMED: Broke above $${neckline.toFixed(2)} neckline`;
    if (priceAboveBreakout >= 2) confidence += 10;
    if (volumeRatio >= 1.25) confidence += 5;
  }
  
  return {
    detected: true,
    confirmed: breakout,
    confidence: Math.min(90, confidence),
    target,
    stopLoss,
    upside: ((target - currentPrice) / currentPrice * 100).toFixed(1),
    volumeRatio: Math.round(volumeRatio * 100) / 100,
    priceAboveBreakout: Math.round(priceAboveBreakout * 100) / 100,
    status,
    statusReason,
  };
}

// BEARISH: Head & Shoulders (89% success rate)
function detectHeadShoulders(candles: PatternCandle[]): PatternResult {
  const notDetected: PatternResult = { detected: false, confirmed: false, confidence: 0, status: 'NOT_DETECTED', statusReason: 'Pattern not found' };
  
  if (candles.length < 35) return { ...notDetected, statusReason: 'Insufficient data' };
  
  const recent = candles.slice(-40);
  const prices = recent.map(c => c.close);
  const volumes = recent.map(c => c.volume);
  
  // Find local maximums
  const highs: { idx: number; price: number }[] = [];
  for (let i = 3; i < prices.length - 3; i++) {
    if (prices[i] > prices[i-1] && prices[i] > prices[i-2] &&
        prices[i] > prices[i+1] && prices[i] > prices[i+2]) {
      highs.push({ idx: i, price: prices[i] });
    }
  }
  
  if (highs.length < 3) return { ...notDetected, statusReason: 'Need 3 distinct highs' };
  
  // Find pattern: left shoulder - head (highest) - right shoulder
  let bestPattern: { ls: typeof highs[0]; head: typeof highs[0]; rs: typeof highs[0] } | null = null;
  
  for (let i = 0; i < highs.length - 2; i++) {
    for (let j = i + 1; j < highs.length - 1; j++) {
      for (let k = j + 1; k < highs.length; k++) {
        const ls = highs[i];
        const head = highs[j];
        const rs = highs[k];
        
        // Head must be higher than both shoulders
        if (head.price > ls.price && head.price > rs.price) {
          const shoulderDiff = Math.abs(ls.price - rs.price) / ls.price;
          const headHeight = (head.price - ls.price) / ls.price;
          
          if (shoulderDiff <= 0.05 && headHeight >= 0.03) {
            bestPattern = { ls, head, rs };
            break;
          }
        }
      }
      if (bestPattern) break;
    }
    if (bestPattern) break;
  }
  
  if (!bestPattern) return { ...notDetected, statusReason: 'No valid H&S structure' };
  
  const { ls, head, rs } = bestPattern;
  
  // Calculate neckline
  const leftTrough = Math.min(...prices.slice(ls.idx, head.idx));
  const rightTrough = Math.min(...prices.slice(head.idx, rs.idx + 1));
  const neckline = (leftTrough + rightTrough) / 2;
  
  const currentPrice = prices[prices.length - 1];
  const avgVolume = getAvgVolume(candles);
  const currentVolume = volumes[volumes.length - 1];
  const volumeRatio = avgVolume > 0 ? currentVolume / avgVolume : 1;
  
  const breakdown = currentPrice < neckline;
  const priceBelowBreakdown = breakdown ? ((neckline - currentPrice) / neckline * 100) : 0;
  
  const target = neckline - (head.price - neckline);
  const stopLoss = rs.price * 1.02;
  
  let status: 'CONFIRMED' | 'FORMING' | 'NOT_DETECTED' = 'FORMING';
  let confidence = 50;
  let statusReason = `Forming: Neckline support at $${neckline.toFixed(2)}`;
  
  if (breakdown) {
    status = 'CONFIRMED';
    confidence = 75;
    statusReason = `CONFIRMED: Broke below $${neckline.toFixed(2)} neckline`;
    if (priceBelowBreakdown >= 2) confidence += 10;
    if (volumeRatio >= 1.25) confidence += 5;
  }
  
  return {
    detected: true,
    confirmed: breakdown,
    confidence: Math.min(90, confidence),
    target,
    stopLoss,
    downside: ((currentPrice - target) / currentPrice * 100).toFixed(1),
    volumeRatio: Math.round(volumeRatio * 100) / 100,
    priceAboveBreakout: -Math.round(priceBelowBreakdown * 100) / 100,
    status,
    statusReason,
  };
}

// Main pattern detection wrapper
// CRITICAL: Only show ONE dominant pattern to avoid confusion
// Research shows conflicting patterns lead to analysis paralysis
function detectAllPatterns(candles: PatternCandle[], currentPrice: number) {
  const allPatterns: { 
    name: string; 
    type: 'BULLISH' | 'BEARISH'; 
    successRate: number;
    result: PatternResult;
  }[] = [];
  
  // Detect all patterns
  const cupHandle = detectCupAndHandle(candles);
  if (cupHandle.detected) {
    allPatterns.push({ name: 'Cup & Handle', type: 'BULLISH', successRate: 95, result: cupHandle });
  }
  
  const invHS = detectInverseHeadShoulders(candles);
  if (invHS.detected) {
    allPatterns.push({ name: 'Inverse Head & Shoulders', type: 'BULLISH', successRate: 89, result: invHS });
  }
  
  const dblBottom = detectDoubleBottom(candles);
  if (dblBottom.detected) {
    allPatterns.push({ name: 'Double Bottom', type: 'BULLISH', successRate: 88, result: dblBottom });
  }
  
  const hs = detectHeadShoulders(candles);
  if (hs.detected) {
    allPatterns.push({ name: 'Head & Shoulders', type: 'BEARISH', successRate: 89, result: hs });
  }
  
  const dblTop = detectDoubleTop(candles);
  if (dblTop.detected) {
    allPatterns.push({ name: 'Double Top', type: 'BEARISH', successRate: 75, result: dblTop });
  }
  
  // CRITICAL FIX: Only show ONE pattern - the most reliable one
  // Multiple conflicting patterns = no actionable pattern
  
  // Sort by: 1) confirmed first, 2) highest confidence, 3) highest success rate
  allPatterns.sort((a, b) => {
    // Confirmed patterns always first
    if (a.result.confirmed && !b.result.confirmed) return -1;
    if (!a.result.confirmed && b.result.confirmed) return 1;
    // Then by confidence
    if (b.result.confidence !== a.result.confidence) {
      return b.result.confidence - a.result.confidence;
    }
    // Then by success rate
    return b.successRate - a.successRate;
  });
  
  // Get the single best pattern
  const bestPattern = allPatterns.length > 0 ? allPatterns[0] : null;
  
  // Check if there are conflicting high-confidence patterns
  const highConfidencePatterns = allPatterns.filter(p => p.result.confidence >= 45);
  const bullishHighConf = highConfidencePatterns.filter(p => p.type === 'BULLISH');
  const bearishHighConf = highConfidencePatterns.filter(p => p.type === 'BEARISH');
  
  // Conflict exists if BOTH bullish and bearish patterns have high confidence
  const hasConflict = bullishHighConf.length > 0 && bearishHighConf.length > 0;
  
  let dominantDirection: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';
  let dominantPattern: typeof allPatterns[0] | null = null;
  
  if (hasConflict) {
    // Conflicting signals - don't show any pattern as reliable
    dominantDirection = 'NEUTRAL';
    dominantPattern = null;
  } else if (bestPattern) {
    dominantPattern = bestPattern;
    dominantDirection = bestPattern.type;
  }
  
  // Only return the SINGLE best pattern (or none if conflict)
  const confirmedPatterns = dominantPattern?.result.confirmed ? [dominantPattern] : [];
  const formingPatterns = dominantPattern && !dominantPattern.result.confirmed ? [dominantPattern] : [];
  
  return { 
    allDetected: hasConflict ? [] : (dominantPattern ? [dominantPattern] : []),
    confirmed: confirmedPatterns,
    forming: formingPatterns,
    dominantDirection,
    dominantPattern,
    bullishScore: dominantDirection === 'BULLISH' && dominantPattern ? 
      (dominantPattern.result.confidence / 100) * (dominantPattern.successRate / 100) : 0,
    bearishScore: dominantDirection === 'BEARISH' && dominantPattern ? 
      (dominantPattern.result.confidence / 100) * (dominantPattern.successRate / 100) : 0,
    netScore: 0,
    hasConflict,
    actionable: confirmedPatterns.length > 0 && !hasConflict,
    // NEW: Provide clear message about pattern status
    message: hasConflict 
      ? 'Conflicting patterns detected - no clear signal'
      : dominantPattern?.result.confirmed 
        ? `${dominantPattern.name} CONFIRMED - ${dominantDirection} signal`
        : dominantPattern 
          ? `${dominantPattern.name} forming - watching for breakout`
          : 'No clear chart pattern detected'
  };
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
  headlines: { title: string; headline: string; sentiment: string; source: string; datetime: string }[];
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
    
    const t = item.headline || item.title || '';
    return {
      title: t,
      headline: t,
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
  earnings: any,
  fundamentalFactors: any[],
  technicalFactors: any[],
  price: number,
  technicals: any,
  fundamentals: any
) {
  const suggestions: any[] = [];
  
  // PRIMARY SCORE: Use the combined fundamental + technical score (18 max)
  const combinedScore = fundamentalScore + technicalScore;
  
  // Secondary factors (adjust confidence only)
  let confidenceAdjustment = 0;
  const adjustmentReasons: string[] = [];
  
  // News sentiment adjustment (-10 to +10)
  if (newsSentiment.signal === 'BULLISH') {
    confidenceAdjustment += 5;
    adjustmentReasons.push('+5% confidence: Bullish news sentiment');
  } else if (newsSentiment.signal === 'BEARISH') {
    confidenceAdjustment -= 5;
    adjustmentReasons.push('-5% confidence: Bearish news sentiment');
  }
  
  // Analyst consensus adjustment (-5 to +5)
  if (analystRating.buyPercent >= 70) {
    confidenceAdjustment += 5;
    adjustmentReasons.push(`+5% confidence: Strong analyst support (${analystRating.buyPercent}% bullish)`);
  } else if (analystRating.buyPercent <= 30) {
    confidenceAdjustment -= 5;
    adjustmentReasons.push(`-5% confidence: Weak analyst support (${analystRating.buyPercent}% bullish)`);
  }
  
  // Insider activity adjustment
  if (insiderActivity.netActivity === 'BUYING') {
    confidenceAdjustment += 3;
    adjustmentReasons.push('+3% confidence: Insider buying detected');
  } else if (insiderActivity.netActivity === 'SELLING') {
    confidenceAdjustment -= 2;
    adjustmentReasons.push('-2% confidence: Insider selling (often for personal reasons)');
  }
  
  // Price target adjustment
  if (analystRating.targetUpside > 20) {
    confidenceAdjustment += 5;
    adjustmentReasons.push(`+5% confidence: High upside potential (${analystRating.targetUpside.toFixed(1)}%)`);
  } else if (analystRating.targetUpside < -10) {
    confidenceAdjustment -= 5;
    adjustmentReasons.push(`-5% confidence: Negative price target (${analystRating.targetUpside.toFixed(1)}%)`);
  }
  
  // MAIN RECOMMENDATION based on combined score
  let mainType: 'BUY' | 'SELL' | 'HOLD' = 'HOLD';
  let strategy = 'Hold - Mixed Signals';
  let baseConfidence = 50;
  
  if (combinedScore >= 14) {
    mainType = 'BUY';
    strategy = 'Strong Buy - Excellent Fundamentals & Technicals';
    baseConfidence = 75 + (combinedScore - 14) * 5;
  } else if (combinedScore >= 11) {
    mainType = 'BUY';
    strategy = 'Buy - Favorable Conditions';
    baseConfidence = 60 + (combinedScore - 11) * 5;
  } else if (combinedScore >= 7) {
    mainType = 'HOLD';
    strategy = 'Hold - Wait for Better Entry';
    baseConfidence = 40 + (combinedScore - 7) * 5;
  } else if (combinedScore >= 4) {
    mainType = 'SELL';
    strategy = 'Sell - Weak Signals';
    baseConfidence = 55 + (7 - combinedScore) * 5;
  } else {
    mainType = 'SELL';
    strategy = 'Strong Sell - Multiple Red Flags';
    baseConfidence = 70 + (4 - combinedScore) * 5;
  }
  
  const finalConfidence = Math.min(95, Math.max(25, baseConfidence + confidenceAdjustment));
  
  // Build detailed explanation
  const passedFundamentals = fundamentalFactors.filter(f => f.passed);
  const failedFundamentals = fundamentalFactors.filter(f => !f.passed);
  const passedTechnicals = technicalFactors.filter(f => f.passed);
  const failedTechnicals = technicalFactors.filter(f => !f.passed);
  
  const detailedExplanation = {
    summary: `Based on a combined analysis score of ${combinedScore}/18, this stock receives a ${mainType} recommendation with ${finalConfidence}% confidence.`,
    
    scoreBreakdown: {
      fundamental: {
        score: fundamentalScore,
        maxScore: 9,
        interpretation: fundamentalScore >= 7 ? 'Strong fundamentals' : fundamentalScore >= 5 ? 'Decent fundamentals' : 'Weak fundamentals',
        passed: passedFundamentals.map(f => `✓ ${f.name}: ${f.value}`),
        failed: failedFundamentals.map(f => `✗ ${f.name}: ${f.value} (needs ${f.threshold})`),
      },
      technical: {
        score: technicalScore,
        maxScore: 9,
        interpretation: technicalScore >= 7 ? 'Strong technicals - uptrend' : technicalScore >= 5 ? 'Mixed technicals' : 'Weak technicals - downtrend',
        passed: passedTechnicals.map(f => `✓ ${f.name}: ${f.value}`),
        failed: failedTechnicals.map(f => `✗ ${f.name}: ${f.value} (needs ${f.threshold})`),
      },
    },
    
    keyMetrics: {
      valuation: `P/E: ${fundamentals.pe?.toFixed(1) || 'N/A'} | P/B: ${fundamentals.pb?.toFixed(2) || 'N/A'}`,
      profitability: `ROE: ${fundamentals.roe?.toFixed(1)}% | Profit Margin: ${fundamentals.profitMargin?.toFixed(1)}%`,
      financial_health: `Debt/Equity: ${fundamentals.debtEquity?.toFixed(2)} | Current Ratio: ${fundamentals.currentRatio?.toFixed(2)}`,
      momentum: `RSI: ${technicals.rsi} | vs 50 SMA: ${technicals.priceVsSma50?.toFixed(1)}%`,
      trend: `Price: $${price.toFixed(2)} | Support: $${technicals.support?.toFixed(2)} | Resistance: $${technicals.resistance?.toFixed(2)}`,
    },
    
    confidenceFactors: {
      baseConfidence: `${baseConfidence}% (from score ${combinedScore}/18)`,
      adjustments: adjustmentReasons,
      finalConfidence: `${finalConfidence}%`,
    },
    
    marketContext: {
      news: `${newsSentiment.signal} sentiment (${newsSentiment.score}%)`,
      analysts: `${analystRating.consensus} - ${analystRating.buyPercent}% recommend buying`,
      insiders: insiderActivity.netActivity,
      priceTarget: analystRating.targetUpside !== 0 ? `${analystRating.targetUpside >= 0 ? '+' : ''}${analystRating.targetUpside.toFixed(1)}% to target` : 'N/A',
    },
    
    reasoning: mainType === 'BUY' 
      ? [
          `The stock scores ${combinedScore}/18 on our combined analysis, indicating ${combinedScore >= 14 ? 'excellent' : 'favorable'} conditions.`,
          `Fundamental analysis shows ${fundamentalScore}/9 factors passing, suggesting ${fundamentalScore >= 7 ? 'strong' : 'adequate'} company health.`,
          `Technical analysis shows ${technicalScore}/9 factors passing, indicating ${technicalScore >= 7 ? 'strong upward momentum' : 'positive price action'}.`,
          technicals.rsi < 70 ? `RSI at ${technicals.rsi} is not overbought, suggesting room for upside.` : `Caution: RSI at ${technicals.rsi} is overbought.`,
          technicals.priceVsSma50 > 0 ? `Price is ${technicals.priceVsSma50.toFixed(1)}% above 50-day SMA, confirming uptrend.` : `Price is below 50-day SMA, watch for breakout.`,
        ]
      : mainType === 'SELL'
      ? [
          `The stock scores only ${combinedScore}/18, indicating significant weakness.`,
          `Fundamental analysis shows only ${fundamentalScore}/9 factors passing - ${9 - fundamentalScore} red flags.`,
          `Technical analysis shows only ${technicalScore}/9 factors passing - price action is weak.`,
          technicals.rsi > 70 ? `RSI at ${technicals.rsi} is overbought - potential pullback.` : technicals.rsi < 30 ? `RSI at ${technicals.rsi} is oversold but no reversal signal yet.` : '',
          technicals.priceVsSma50 < 0 ? `Price is ${Math.abs(technicals.priceVsSma50).toFixed(1)}% below 50-day SMA, confirming downtrend.` : '',
        ].filter(Boolean)
      : [
          `The stock scores ${combinedScore}/18 - mixed signals suggest caution.`,
          `Fundamental analysis shows ${fundamentalScore}/9 factors - neither strong nor weak.`,
          `Technical analysis shows ${technicalScore}/9 factors - no clear trend.`,
          `Wait for a clearer signal before entering a position.`,
        ],
  };
  
  suggestions.push({
    type: mainType,
    strategy,
    confidence: finalConfidence,
    reasoning: [
      `Combined Score: ${combinedScore}/18 (Fundamental ${fundamentalScore}/9 + Technical ${technicalScore}/9)`,
      `News Sentiment: ${newsSentiment.signal} (${newsSentiment.score}%)`,
      `Analyst Consensus: ${analystRating.consensus} (${analystRating.buyPercent}% bullish)`,
      `Insider Activity: ${insiderActivity.netActivity}`,
      analystRating.targetUpside !== 0 ? `Price Target: ${analystRating.targetUpside >= 0 ? '+' : ''}${analystRating.targetUpside.toFixed(1)}% upside` : '',
    ].filter(Boolean),
    riskLevel: combinedScore >= 12 ? 'LOW' : combinedScore >= 8 ? 'MEDIUM' : 'HIGH',
    detailedExplanation,
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
          'Consider position size - volatility expected',
        ],
        riskLevel: 'WARNING',
      });
    }
  }
  
  // Only show divergence alert if extreme
  if (Math.abs(fundamentalScore - technicalScore) >= 5) {
    suggestions.push({
      type: 'ALERT',
      strategy: 'Fundamental/Technical Divergence',
      confidence: 0,
      reasoning: [
        `Fundamental: ${fundamentalScore}/9 vs Technical: ${technicalScore}/9`,
        fundamentalScore > technicalScore ? 'Strong fundamentals but weak price action - potential value opportunity' : 'Strong price action but weak fundamentals - momentum play, higher risk',
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

  // Fetch portfolio context (if available)
  let portfolioContext: any = null;
  try {
    const contextResponse = await fetch(`${request.url.split('/api/')[0]}/api/portfolio/context?symbol=${ticker}`, {
      headers: { 'Cookie': request.headers.get('Cookie') || '' }
    });
    if (contextResponse.ok) {
      const contextData = await contextResponse.json();
      portfolioContext = contextData;
    }
  } catch (err) {
    console.log('[Stock API] Portfolio context unavailable:', err);
    // Not critical - continue without context
  }

  // Try Schwab first
  const schwabToken = await getSchwabToken();
  if (schwabToken) {
    quote = await fetchSchwabQuote(schwabToken, ticker);
    priceHistory = await fetchSchwabPriceHistory(schwabToken, ticker);
    if (quote) dataSource = 'schwab';
    // If Schwab quote works but pricehistory is unavailable, fall back to Finnhub candles (if configured)
    if (priceHistory.length === 0) {
      const fhCandles = await getFinnhubCandles(ticker);
      if (fhCandles.length > 0) {
        priceHistory = fhCandles;
        dataSource = dataSource === 'schwab' ? 'schwab+finnhub_candles' : 'finnhub_candles';
      }
    }
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
  
  // NEW: Detect professional chart patterns
  const patternCandles: PatternCandle[] = priceHistory.map((c: any) => ({
    open: c.open || c.close,
    high: c.high,
    low: c.low,
    close: c.close,
    volume: c.volume || 0
  }));
  const chartPatterns = detectAllPatterns(patternCandles, price);
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
    earnings,
    fundamentalAnalysis.factors,
    technicalAnalysis.factors,
    price,
    {
      rsi: Math.round(rsi),
      priceVsSma50: Math.round(((price / sma50 - 1) * 100) * 100) / 100,
      support: Math.round(support * 100) / 100,
      resistance: Math.round(resistance * 100) / 100,
    },
    {
      pe: fundamentalMetrics.pe,
      pb: fundamentalMetrics.pb,
      roe: fundamentalMetrics.roe,
      profitMargin: fundamentalMetrics.profitMargin,
      debtEquity: fundamentalMetrics.debtEquity,
      currentRatio: fundamentalMetrics.currentRatio,
    }
  );

  // NEW: Apply professional pattern bonus - ONLY from CONFIRMED patterns
  let patternBonus = 0;
  
  // Only apply bonus if we have ACTIONABLE confirmed patterns (no conflicts)
  if (chartPatterns.actionable && chartPatterns.confirmed.length > 0) {
    const confirmedBullish = chartPatterns.confirmed.filter(p => p.type === 'BULLISH');
    const confirmedBearish = chartPatterns.confirmed.filter(p => p.type === 'BEARISH');
    
    // Bullish pattern bonuses (only if confirmed with 70%+ confidence)
    for (const p of confirmedBullish) {
      if (p.result.confidence >= 70) {
        if (p.name === 'Cup & Handle') patternBonus += 12;
        else if (p.name === 'Inverse Head & Shoulders') patternBonus += 10;
        else if (p.name === 'Double Bottom') patternBonus += 10;
      }
    }
    
    // Bearish pattern penalties for BUY recommendations
    if (suggestions[0]?.type === 'BUY') {
      for (const p of confirmedBearish) {
        if (p.result.confidence >= 70) {
          if (p.name === 'Head & Shoulders') patternBonus -= 12;
          else if (p.name === 'Double Top') patternBonus -= 10;
        }
      }
    }
  }
  
  // If there's a conflict, penalize heavily
  if (chartPatterns.hasConflict) {
    patternBonus = -15;  // Conflicting patterns = high uncertainty
  }
  
  // Apply pattern bonus to main suggestion
  if (suggestions[0] && suggestions[0].confidence) {
    suggestions[0].confidence = Math.min(95, Math.max(25, suggestions[0].confidence + patternBonus));
    if (patternBonus !== 0) {
      suggestions[0].reasoning = suggestions[0].reasoning || [];
      if (chartPatterns.hasConflict) {
        suggestions[0].reasoning.push(`⚠️ -15% confidence: Conflicting chart patterns detected`);
      } else if (patternBonus > 0) {
        suggestions[0].reasoning.push(`✓ +${patternBonus}% confidence: ${chartPatterns.confirmed.length} CONFIRMED ${chartPatterns.dominantDirection} pattern(s)`);
      } else if (patternBonus < 0) {
        suggestions[0].reasoning.push(`${patternBonus}% confidence: CONFIRMED bearish pattern(s) detected`);
      }
    }
  }

  
  // ============================================================
  // Accuracy-first trade decision (NO_TRADE gating + calibration)
  // ============================================================
  const combinedModelScore = fundamentalAnalysis.score + technicalAnalysis.score;
  const combinedModelRating =
    combinedModelScore >= 14 ? 'STRONG_BUY' :
    combinedModelScore >= 11 ? 'BUY' :
    combinedModelScore >= 7 ? 'HOLD' :
    combinedModelScore >= 4 ? 'SELL' : 'STRONG_SELL';

  const completenessScore = calculateCompletenessScore({
    hasPrice: price > 0,
    hasFundamentals: fundamentalMetrics.pe > 0 || fundamentalMetrics.roe !== 0,
    hasTechnicals: priceHistory.length >= 20,
    hasNews: newsAnalysis.headlines.length > 0,
    hasAnalysts: analystAnalysis.buyPercent >= 0,
    // Insider activity is considered "present" only when we have at least one parsed transaction
    hasInsiders: insiderAnalysis.recentTransactions.length > 0,
    hasEarnings: !!(earnings && (earnings.earningsCalendar?.[0] || (Array.isArray(earnings.earningsCalendar) && earnings.earningsCalendar.length > 0))),
    hasPatterns: chartPatterns.allDetected.length > 0,
  });

  const agreementCount = [
    fundamentalAnalysis.score >= 5,
    technicalAnalysis.score >= 5,
    newsAnalysis.signal === 'BULLISH',
    analystAnalysis.buyPercent >= 50,
    insiderAnalysis.netActivity === 'BUYING',
    chartPatterns.dominantDirection === 'BULLISH' && chartPatterns.actionable,
  ].filter(Boolean).length;

  const trustLevel = (chartPatterns.hasConflict ? 'LOW' : (chartPatterns.actionable && chartPatterns.confirmed.length > 0 ? 'HIGH' : (chartPatterns.allDetected.length > 0 ? 'MEDIUM' : 'NEUTRAL')));
  const quoteAsOfMs = (q as any)?.quoteTimeInLong || (q as any)?.tradeTimeInLong || Date.now();
  const freshness = {
    asOf: new Date(quoteAsOfMs).toISOString(),
    ageMs: Date.now() - quoteAsOfMs,
    isStale: (Date.now() - quoteAsOfMs) > 60_000,
  };

  // Use the computed moving averages already in scope (avoid referencing non-existent identifiers)
  const regimeInfo = computeRegime(priceHistory, sma50, sma200);
  const calib = calibratedConfidence(combinedModelScore, 18, agreementCount, completenessScore, regimeInfo.regime);

  const gateFailures: string[] = [];
  if (freshness.isStale) gateFailures.push('Stale price quote (>60s). Refresh required for accurate suggestions.');
  if (completenessScore < 80) gateFailures.push('Data completeness below 80/100. Not enough confirmed inputs for high-accuracy suggestions.');
  if (agreementCount < 4) gateFailures.push('Signals do not sufficiently agree (needs at least 4 of 6).');
  if (trustLevel === 'LOW') gateFailures.push('Chart pattern signals conflict or are not actionable.');

  // "No contradiction" rule: if we cannot meet the quality bar, we explicitly return NO_TRADE.
  const tradeDecision = gateFailures.length === 0
    ? { action: combinedModelRating, confidence: calib.confidence, confidenceBucket: calib.bucket, calibrationVersion: calib.calibrationVersion, rationale: [] as string[] }
    : { action: 'NO_TRADE', confidence: 0, confidenceBucket: 'N/A', calibrationVersion: calib.calibrationVersion, rationale: gateFailures };

  // ============================================================
  // PORTFOLIO CONTEXT ANALYSIS (Position-Aware Recommendations)
  // ============================================================
  let portfolioAnalysis: any = null;
  let enhancedScore = combinedModelScore;
  let enhancedMaxScore = 18;
  let enhancedRating = combinedModelRating;
  
  if (portfolioContext?.success && portfolioContext.context) {
    const ctx = portfolioContext.context;
    const position = portfolioContext.symbolPosition;
    const portfolioValue = ctx.summary.portfolioValue || 1;
    const buyingPower = ctx.balances.buyingPower || 0;
    
    // Portfolio Context Scoring (0-6 points)
    let portfolioScore = 0;
    const portfolioFactors: string[] = [];
    const portfolioWarnings: string[] = [];
    const portfolioSuggestions: string[] = [];
    
    // 1. Position Sizing Analysis (0-2 points)
    if (position) {
      const positionPercent = (position.marketValue / portfolioValue) * 100;
      const positionPL = position.unrealizedPLPercent;
      
      portfolioWarnings.push(`🔍 You own ${position.quantity} shares (${positionPercent.toFixed(1)}% of portfolio)`);
      portfolioWarnings.push(`📊 Position P&L: ${positionPL >= 0 ? '+' : ''}${positionPL.toFixed(2)}% (${positionPL >= 0 ? '+' : ''}$${position.unrealizedPL.toFixed(2)})`);
      
      if (positionPercent > 20) {
        portfolioScore += 0; // Overweight - no points
        portfolioFactors.push('❌ Position >20% of portfolio (overweight risk)');
        portfolioWarnings.push('⚠️ CONCENTRATION RISK: Position exceeds recommended 20% maximum');
        
        if (tradeDecision.action === 'BUY' || tradeDecision.action === 'STRONG_BUY') {
          portfolioSuggestions.push('🛑 DO NOT ADD to this position - already overweight');
          portfolioSuggestions.push(`💡 Consider selling ${Math.floor(position.quantity * 0.3)} shares to reduce concentration`);
          enhancedRating = 'HOLD'; // Override to HOLD
        }
        
        if (positionPL > 15) {
          portfolioSuggestions.push('💰 Strong gain detected - consider taking partial profits');
        }
      } else if (positionPercent > 15) {
        portfolioScore += 1; // Near limit
        portfolioFactors.push('⚠️ Position 15-20% of portfolio (near concentration limit)');
        portfolioWarnings.push('📍 Position approaching 20% concentration limit');
        
        if (tradeDecision.action === 'BUY' || tradeDecision.action === 'STRONG_BUY') {
          portfolioSuggestions.push('⚠️ CAUTION: Adding more will exceed concentration limits');
          enhancedRating = 'HOLD'; // Downgrade from BUY to HOLD
        }
      } else {
        portfolioScore += 2; // Reasonable size
        portfolioFactors.push(`✅ Position size ${positionPercent.toFixed(1)}% is well-balanced`);
      }
      
      // Loss management
      if (positionPL < -10) {
        portfolioWarnings.push('📉 Position down >10% - review stop-loss strategy');
        portfolioSuggestions.push(`🛡️ Consider stop-loss at $${(position.currentPrice * 0.92).toFixed(2)} (-8% from current)`);
      }
    } else {
      // No position
      portfolioScore += 2; // Full points - can add position
      portfolioFactors.push('✅ No existing position - safe to enter');
    }
    
    // 2. Diversification Analysis (0-2 points)
    const totalPositions = ctx.summary.totalPositions;
    if (totalPositions < 5) {
      portfolioScore += 0;
      portfolioFactors.push(`❌ Under-diversified portfolio (${totalPositions} positions)`);
      portfolioWarnings.push('⚠️ Portfolio needs more diversification (recommended: 8-15 positions)');
    } else if (totalPositions >= 5 && totalPositions <= 20) {
      portfolioScore += 2;
      portfolioFactors.push(`✅ Well-diversified portfolio (${totalPositions} positions)`);
    } else {
      portfolioScore += 1;
      portfolioFactors.push(`⚠️ Over-diversified portfolio (${totalPositions} positions)`);
    }
    
    // 3. Buying Power Validation (0-2 points)
    const estimatedCost = price * 100; // Assume 100 shares
    const buyingPowerPercent = (estimatedCost / buyingPower) * 100;
    
    if (buyingPower < estimatedCost) {
      portfolioScore += 0;
      portfolioFactors.push('❌ Insufficient buying power for standard position');
      portfolioWarnings.push(`💸 Buying Power: $${buyingPower.toLocaleString()} (insufficient for 100 shares at $${price.toFixed(2)})`);
      
      const maxShares = Math.floor(buyingPower / price);
      if (maxShares > 0) {
        portfolioSuggestions.push(`📊 Maximum affordable: ${maxShares} shares ($${(maxShares * price).toFixed(2)})`);
      } else {
        portfolioSuggestions.push('🚫 Cannot afford any shares at current price');
        if (tradeDecision.action === 'BUY' || tradeDecision.action === 'STRONG_BUY') {
          enhancedRating = 'NO_TRADE'; // Can't afford it
        }
      }
    } else if (buyingPowerPercent > 50) {
      portfolioScore += 1;
      portfolioFactors.push('⚠️ Trade would use >50% of buying power');
      portfolioWarnings.push(`💰 This trade uses ${buyingPowerPercent.toFixed(0)}% of buying power`);
    } else {
      portfolioScore += 2;
      portfolioFactors.push(`✅ Sufficient buying power ($${buyingPower.toLocaleString()})`);
    }
    
    // 4. Day Trading Warning
    if (ctx.isDayTrader) {
      portfolioWarnings.push(`⚠️ Pattern Day Trader: ${ctx.roundTrips}/3 day trades used this week`);
      if (ctx.roundTrips >= 2) {
        portfolioWarnings.push('🚨 CAUTION: 1 day trade remaining - account will be flagged if exceeded');
      }
    }
    
    // Calculate enhanced score
    enhancedScore = combinedModelScore + portfolioScore;
    enhancedMaxScore = 24; // 18 + 6 portfolio points
    
    portfolioAnalysis = {
      hasPosition: !!position,
      position: position ? {
        quantity: position.quantity,
        avgCost: position.averagePrice,
        currentPrice: position.currentPrice,
        marketValue: position.marketValue,
        unrealizedPL: position.unrealizedPL,
        unrealizedPLPercent: position.unrealizedPLPercent,
        portfolioPercent: (position.marketValue / portfolioValue) * 100,
      } : null,
      portfolioScore,
      portfolioMaxScore: 6,
      factors: portfolioFactors,
      warnings: portfolioWarnings,
      suggestions: portfolioSuggestions,
      buyingPower,
      canAfford: buyingPower >= price,
      maxAffordableShares: Math.floor(buyingPower / price),
      totalPositions,
      isDayTrader: ctx.isDayTrader,
      roundTripsRemaining: 3 - (ctx.roundTrips || 0),
    };
  }


  if (tradeDecision.action === 'NO_TRADE') {
    suggestions.splice(0, suggestions.length, ...buildNoTrade(gateFailures, freshness.asOf));
  } else {
    // Apply calibrated confidence to the top suggestion to keep confidence consistent with measured gates
    if (suggestions[0] && typeof suggestions[0].confidence === 'number') suggestions[0].confidence = calib.confidence;
    if (suggestions[0] && Array.isArray(suggestions[0].reasoning)) {
      suggestions[0].reasoning.unshift(`Calibration: ${calib.calibrationVersion} (${calib.bucket})`);
      suggestions[0].reasoning.unshift(`Regime: ${regimeInfo.regime} (ATR% ${regimeInfo.atrPct}, trendStrength ${regimeInfo.trendStrength})`);
    }
  }

return NextResponse.json({
    ticker,
    name: profile?.name || `${ticker}`,
    exchange: profile?.exchange || 'NASDAQ',
    industry: profile?.finnhubIndustry || '',
    marketCap: profile?.marketCapitalization ? profile.marketCapitalization * 1e6 : 0,
    price: Math.round(price * 100) / 100,
    change: Math.round((q.netChange || 0) * 100) / 100,
    changePercent: Math.round((q.netPercentChange || 0) * 100) / 100,

    meta: {
      asOf: freshness.asOf,
      quoteAgeMs: freshness.ageMs,
      isStale: freshness.isStale,
      priceHistory: { source: dataSource, candles: priceHistory.length },
      regime: regimeInfo.regime,
      atrPct: regimeInfo.atrPct,
      trendStrength: regimeInfo.trendStrength,
      tradeDecision,
      warnings: {
        news: FINNHUB_KEY ? null : 'News requires FINNHUB_API_KEY (missing in environment).',
        technicals: priceHistory.length > 0 ? null : 'Price history candles unavailable; indicators are degraded. Fix Schwab market data auth or enable FINNHUB_API_KEY for candle fallback.',
      },
    },

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
        score: enhancedScore,
        maxScore: enhancedMaxScore,
        baseScore: combinedModelScore,
        baseMaxScore: 18,
        modelRating: combinedModelRating,
        rating: enhancedRating,
        calibratedConfidence: tradeDecision.action === 'NO_TRADE' ? 0 : tradeDecision.confidence,
        confidenceBucket: tradeDecision.action === 'NO_TRADE' ? 'N/A' : tradeDecision.confidenceBucket,
        calibrationVersion: tradeDecision.calibrationVersion,
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

    // NEW: Professional chart patterns detected - SINGLE DOMINANT PATTERN ONLY
    chartPatterns: {
      // Only show the single confirmed pattern (if any)
      confirmed: chartPatterns.confirmed.map(p => ({
        name: p.name,
        type: p.type,
        successRate: `${p.successRate}%`,
        confidence: p.result.confidence,
        status: p.result.status,
        statusReason: p.result.statusReason,
        target: p.result.target ? `$${p.result.target.toFixed(2)}` : null,
        stopLoss: p.result.stopLoss ? `$${p.result.stopLoss.toFixed(2)}` : null,
        upside: p.result.upside || null,
        downside: p.result.downside || null,
        volumeRatio: p.result.volumeRatio,
        priceAboveBreakout: p.result.priceAboveBreakout,
      })),
      // Single forming pattern (if no confirmed)
      forming: (chartPatterns.forming || []).map(p => ({
        name: p.name,
        type: p.type,
        successRate: `${p.successRate}%`,
        confidence: p.result.confidence,
        status: p.result.status,
        statusReason: p.result.statusReason,
        target: p.result.target ? `$${p.result.target.toFixed(2)}` : null,
      })),
      dominantDirection: chartPatterns.dominantDirection,
      dominantPattern: chartPatterns.dominantPattern ? {
        name: chartPatterns.dominantPattern.name,
        type: chartPatterns.dominantPattern.type,
        confidence: chartPatterns.dominantPattern.result.confidence,
      } : null,
      hasConflict: chartPatterns.hasConflict,
      actionable: chartPatterns.actionable,
      // Use the new message field for clear communication
      summary: (chartPatterns as any).message || 'No patterns detected',
      patternBonus,
    },

    // ============================================================
    // DATA VERIFICATION & CONFIDENCE METRICS
    // This helps you trust the analysis by showing data quality
    // ============================================================
    verification: {
      // Data freshness
      dataAge: {
        price: 'real-time',
        fundamentals: 'quarterly (Finnhub)',
        news: 'last 7 days',
        analysts: 'latest available',
        patterns: 'calculated from 1-year price history',
      },
      
      // Data completeness score (0-100)
      completenessScore: calculateCompletenessScore({
        hasPrice: price > 0,
        hasFundamentals: fundamentalMetrics.pe > 0 || fundamentalMetrics.roe !== 0,
        hasTechnicals: priceHistory.length >= 20,
        hasNews: newsAnalysis.headlines.length > 0,
        hasAnalysts: analystAnalysis.buyPercent > 0,
        hasInsiders: insiderAnalysis.buyCount + insiderAnalysis.sellCount > 0,
        hasEarnings: !!earnings?.earningsCalendar?.[0],
      }),
      
      // Signal alignment (do multiple indicators agree?) - NOW INCLUDES PATTERNS
      signalAlignment: {
        aligned: checkSignalAlignment(
          fundamentalAnalysis.score >= 5,
          technicalAnalysis.score >= 5,
          newsAnalysis.signal === 'BULLISH',
          analystAnalysis.buyPercent >= 50
        ),
        details: {
          fundamentalsBullish: fundamentalAnalysis.score >= 5,
          technicalsBullish: technicalAnalysis.score >= 5,
          newsBullish: newsAnalysis.signal === 'BULLISH',
          analystsBullish: analystAnalysis.buyPercent >= 50,
          insidersBullish: insiderAnalysis.netActivity === 'BUYING',
          // NEW: Pattern alignment
          patternsBullish: chartPatterns.dominantDirection === 'BULLISH' && chartPatterns.actionable,
          patternsNeutral: chartPatterns.dominantDirection === 'NEUTRAL' || !chartPatterns.actionable,
          patternsBearish: chartPatterns.dominantDirection === 'BEARISH' && chartPatterns.actionable,
          patternsConflict: chartPatterns.hasConflict,
        },
        agreementCount: [
          fundamentalAnalysis.score >= 5,
          technicalAnalysis.score >= 5,
          newsAnalysis.signal === 'BULLISH',
          analystAnalysis.buyPercent >= 50,
          insiderAnalysis.netActivity === 'BUYING',
          chartPatterns.dominantDirection === 'BULLISH' && chartPatterns.actionable,
        ].filter(Boolean).length,
        totalSignals: 6,  // Now includes patterns
      },
      
      // Pattern-specific trust assessment
      patternTrust: {
        hasConfirmedPatterns: chartPatterns.confirmed.length > 0,
        noConflicts: !chartPatterns.hasConflict,
        actionable: chartPatterns.actionable,
        dominantDirection: chartPatterns.dominantDirection,
        highestConfidence: chartPatterns.confirmed.length > 0 
          ? Math.max(...chartPatterns.confirmed.map(p => p.result.confidence))
          : 0,
        trustLevel: chartPatterns.hasConflict 
          ? 'LOW - Conflicting patterns, do not trade based on patterns'
          : chartPatterns.actionable && chartPatterns.confirmed.length > 0
            ? 'HIGH - Confirmed patterns with volume validation'
            : chartPatterns.allDetected.length > 0
              ? 'MEDIUM - Patterns forming but not confirmed'
              : 'NEUTRAL - No patterns detected',
      },
      
      // Known limitations
      caveats: [
        'Fundamental data is quarterly and may be 1-3 months old',
        'Technical indicators are based on daily closing prices',
        'News sentiment is algorithmic, not human-reviewed',
        'Analyst ratings may lag actual market conditions',
        'Chart patterns require volume confirmation (50%+ above average)',
        'Past performance does not guarantee future results',
      ],
      
      // Verification checklist
      checks: {
        priceVerified: dataSource === 'schwab' || dataSource === 'finnhub',
        fundamentalsPresent: fundamentalMetrics.pe > 0,
        sufficientHistory: priceHistory.length >= 50,
        recentNews: newsAnalysis.headlines.length > 0,
        analystCoverage: (analystAnalysis.distribution?.strongBuy || 0) + (analystAnalysis.distribution?.buy || 0) + (analystAnalysis.distribution?.hold || 0) > 0,
      },
    },

    portfolioContext: portfolioAnalysis,

    lastUpdated: new Date().toISOString(),
    dataSource,
    responseTimeMs: Date.now() - startTime,
  });
}

// Helper functions for verification
function calculateCompletenessScore(checks: Record<string, boolean>): number {
  const weights: Record<string, number> = {
    hasPrice: 25,
    hasFundamentals: 20,
    hasTechnicals: 20,
    hasNews: 15,
    hasAnalysts: 10,
    hasInsiders: 5,
    hasEarnings: 5,
  };
  
  let score = 0;
  for (const [key, passed] of Object.entries(checks)) {
    if (passed && weights[key]) {
      score += weights[key];
    }
  }
  return score;
}

function checkSignalAlignment(...signals: boolean[]): 'STRONG' | 'MODERATE' | 'WEAK' | 'CONFLICTING' {
  const bullishCount = signals.filter(Boolean).length;
  const bearishCount = signals.length - bullishCount;
  
  if (bullishCount >= 4) return 'STRONG';
  if (bullishCount >= 3) return 'MODERATE';
  if (Math.abs(bullishCount - bearishCount) <= 1) return 'CONFLICTING';
  return 'WEAK';
}