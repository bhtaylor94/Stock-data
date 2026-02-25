import { NextRequest, NextResponse } from 'next/server';
import { getSchwabAccessToken, schwabFetchJson } from '@/lib/schwab';
import { detectUnusualActivityFromChain, type UnusualActivity as UOAResult } from '@/lib/unusualActivityDetector';
import { getSnapshotStore } from '@/lib/storage/snapshotStore';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Expected move helper: IV * sqrt(T) using annualized IV.
// Returns percent move over `dte` days. Used for conservative risk gating.
function expectedMovePct(atmIV: number, dte: number): number {
  const t = Math.max(1, dte) / 365;
  const pct = Math.max(0, atmIV) * Math.sqrt(t) * 100;
  return Math.round(pct * 100) / 100;
}

// ============================================================
// COMPREHENSIVE OPTIONS API
// Features:
// - All expiration dates
// - Unusual options activity detection
// - Volume/OI analysis
// - Smart money indicators
// - IV analysis
// - Put/Call skew
// - Professional-grade scoring
// ============================================================

const FINNHUB_KEY = process.env.FINNHUB_API_KEY;

// ============================================================
// FETCH SCHWAB DATA
// 401 retry is handled inside schwabFetchJson (lib/schwab.ts).
// ============================================================
async function fetchOptionsChain(token: string, symbol: string): Promise<{ data: any; error: string | null }> {
  const url = `https://api.schwabapi.com/marketdata/v1/chains?symbol=${symbol}&contractType=ALL&strikeCount=50&includeUnderlyingQuote=true&range=ALL`;
  const result = await schwabFetchJson<any>(token, url, { scope: 'options' });

  if (!result.ok) {
    const vercelEnv = process.env.VERCEL_ENV || process.env.NODE_ENV || 'unknown';
    if (result.status === 401) {
      return {
        data: null,
        error: `Market data API rejected the access token (401) even after a forced refresh. Env: ${vercelEnv}. ` +
               `Check: (1) env vars set for the same environment, (2) refresh token created for this app key/secret, ` +
               `(3) refresh-token rotation, (4) temporary Schwab auth outage.`,
      };
    }
    if (result.status === 404) return { data: null, error: `Symbol '${symbol}' not found or has no options` };
    if (result.status === 429) return { data: null, error: 'Rate limited by Schwab - wait 60 seconds and try again' };
    return { data: null, error: result.error };
  }

  return { data: result.data, error: null };
}

async function fetchPriceHistory(token: string, symbol: string): Promise<{ close: number; high: number; low: number; volume: number }[]> {
  const url = `https://api.schwabapi.com/marketdata/v1/pricehistory?symbol=${symbol}&periodType=month&period=3&frequencyType=daily&frequency=1`;
  const result = await schwabFetchJson<any>(token, url, { scope: 'options' });
  if (!result.ok) return [];
  return (result.data?.candles || []).map((c: any) => ({ close: c.close, high: c.high || c.close, low: c.low || c.close, volume: c.volume || 0 }));
}

// ============================================================
// OPTION CONTRACT TYPE
// ============================================================
interface OptionContract {
  symbol: string;
  strike: number;
  expiration: string;
  dte: number;
  type: 'call' | 'put';
  bid: number;
  ask: number;
  last: number;
  mark: number;
  volume: number;
  openInterest: number;
  delta: number;
  gamma: number;
  theta: number;
  vega: number;
  rho: number;
  iv: number;
  itm: boolean;
  intrinsicValue: number;
  extrinsicValue: number;
  bidAskSpread: number;
  spreadPercent: number;
  // Unusual activity flags
  volumeOIRatio: number;
  isUnusual: boolean;
  unusualScore: number;
}

// ============================================================
// PARSE OPTIONS CHAIN - ALL EXPIRATIONS
// ============================================================
function parseOptionsChain(chainData: any, currentPrice: number): {
  calls: OptionContract[];
  puts: OptionContract[];
  expirations: string[];
  byExpiration: { [exp: string]: { calls: OptionContract[]; puts: OptionContract[] } };
} {
  const calls: OptionContract[] = [];
  const puts: OptionContract[] = [];
  const expirationSet = new Set<string>();
  const byExpiration: { [exp: string]: { calls: OptionContract[]; puts: OptionContract[] } } = {};

  const parseMap = (expDateMap: any, type: 'call' | 'put') => {
    if (!expDateMap) return;
    
    for (const [expKey, strikes] of Object.entries(expDateMap)) {
      const expDate = expKey.split(':')[0];
      expirationSet.add(expDate);
      
      if (!byExpiration[expDate]) {
        byExpiration[expDate] = { calls: [], puts: [] };
      }
      
      for (const [strikeStr, contracts] of Object.entries(strikes as any)) {
        const contractArr = contracts as any[];
        if (!contractArr || contractArr.length === 0) continue;
        
        const c = contractArr[0];
        const strike = parseFloat(strikeStr);
        
        // Include strikes within 30% of current price
        if (Math.abs(strike - currentPrice) / currentPrice > 0.30) continue;
        
        const bid = c.bid || 0;
        const ask = c.ask || 0;
        const mark = (bid + ask) / 2 || c.last || 0;
        const itm = type === 'call' ? strike < currentPrice : strike > currentPrice;
        const intrinsic = type === 'call' 
          ? Math.max(0, currentPrice - strike)
          : Math.max(0, strike - currentPrice);
        const volume = c.totalVolume || 0;
        const openInterest = c.openInterest || 0;
        const volumeOIRatio = openInterest > 0 ? volume / openInterest : volume > 0 ? 999 : 0;
        const bidAskSpread = ask - bid;
        const spreadPercent = mark > 0 ? (bidAskSpread / mark) * 100 : 0;
        
        // Calculate unusual score
        let unusualScore = 0;
        if (volumeOIRatio >= 3) unusualScore += 30;
        else if (volumeOIRatio >= 1.5) unusualScore += 15;
        if (volume >= 1000) unusualScore += 20;
        else if (volume >= 500) unusualScore += 10;
        if (volume >= openInterest && openInterest > 100) unusualScore += 25;
        if (mark * volume * 100 >= 100000) unusualScore += 15; // Premium > $100k
        if (Math.abs(c.delta || 0) >= 0.3 && Math.abs(c.delta || 0) <= 0.7) unusualScore += 10;
        
        const contract: OptionContract = {
          symbol: c.symbol || '',
          strike,
          expiration: expDate,
          dte: c.daysToExpiration || 0,
          type,
          bid,
          ask,
          last: c.last || mark,
          mark,
          volume,
          openInterest,
          delta: c.delta || 0,
          gamma: c.gamma || 0,
          theta: c.theta || 0,
          vega: c.vega || 0,
          rho: c.rho || 0,
          iv: (c.volatility || 0) / 100,
          itm,
          intrinsicValue: intrinsic,
          extrinsicValue: Math.max(0, mark - intrinsic),
          bidAskSpread,
          spreadPercent,
          volumeOIRatio: Math.round(volumeOIRatio * 100) / 100,
          isUnusual: unusualScore >= 50,
          unusualScore,
        };
        
        if (type === 'call') {
          calls.push(contract);
          byExpiration[expDate].calls.push(contract);
        } else {
          puts.push(contract);
          byExpiration[expDate].puts.push(contract);
        }
      }
    }
  };

  parseMap(chainData.callExpDateMap, 'call');
  parseMap(chainData.putExpDateMap, 'put');

  // Sort
  const sortFn = (a: OptionContract, b: OptionContract) => a.dte - b.dte || a.strike - b.strike;
  calls.sort(sortFn);
  puts.sort(sortFn);
  
  // Sort each expiration's options
  for (const exp of Object.keys(byExpiration)) {
    byExpiration[exp].calls.sort((a, b) => a.strike - b.strike);
    byExpiration[exp].puts.sort((a, b) => a.strike - b.strike);
  }

  return {
    calls,
    puts,
    expirations: Array.from(expirationSet).sort(),
    byExpiration,
  };
}

// ============================================================
// DETECT UNUSUAL OPTIONS ACTIVITY — delegates to lib/unusualActivityDetector.ts
// ============================================================

function detectUnusualActivity(
  calls: OptionContract[],
  puts: OptionContract[],
  currentPrice: number,
  stockTrend: 'UP' | 'DOWN' | 'SIDEWAYS' = 'SIDEWAYS',
  isNearEarnings: boolean = false,
  ticker: string = 'UNKNOWN',
  repeatFlowMap?: Map<string, number>
): UOAResult[] {
  return detectUnusualActivityFromChain(calls, puts, currentPrice, ticker, {
    stockTrend,
    isNearEarnings,
    repeatFlowMap,
  });
}

// ============================================================
// IV ANALYSIS
// ============================================================
interface IVAnalysis {
  avgCallIV: number;
  avgPutIV: number;
  putCallIVSkew: number;
  ivRank: number;
  ivPercentile: number;
  ivSignal: 'HIGH' | 'ELEVATED' | 'NORMAL' | 'LOW';
  recommendation: 'BUY_PREMIUM' | 'SELL_PREMIUM' | 'NEUTRAL';
  atmIV: number;
}

function analyzeIV(calls: OptionContract[], puts: OptionContract[], currentPrice: number): IVAnalysis {
  const atmCalls = calls.filter(c => Math.abs(c.strike - currentPrice) / currentPrice < 0.05 && c.iv > 0);
  const atmPuts = puts.filter(p => Math.abs(p.strike - currentPrice) / currentPrice < 0.05 && p.iv > 0);
  
  const avgCallIV = atmCalls.length > 0 ? atmCalls.reduce((sum, c) => sum + c.iv, 0) / atmCalls.length : 0.30;
  const avgPutIV = atmPuts.length > 0 ? atmPuts.reduce((sum, p) => sum + p.iv, 0) / atmPuts.length : 0.30;
  const atmIV = (avgCallIV + avgPutIV) / 2;
  
  const putCallIVSkew = avgPutIV - avgCallIV;
  const ivRank = Math.min(100, Math.max(0, ((atmIV - 0.15) / 0.50) * 100));
  
  let ivSignal: 'HIGH' | 'ELEVATED' | 'NORMAL' | 'LOW' = 'NORMAL';
  let recommendation: 'BUY_PREMIUM' | 'SELL_PREMIUM' | 'NEUTRAL' = 'NEUTRAL';
  
  if (ivRank >= 70) {
    ivSignal = 'HIGH';
    recommendation = 'SELL_PREMIUM';
  } else if (ivRank >= 50) {
    ivSignal = 'ELEVATED';
  } else if (ivRank <= 30) {
    ivSignal = 'LOW';
    recommendation = 'BUY_PREMIUM';
  }
  
  return {
    avgCallIV: Math.round(avgCallIV * 1000) / 10,
    avgPutIV: Math.round(avgPutIV * 1000) / 10,
    putCallIVSkew: Math.round(putCallIVSkew * 1000) / 10,
    ivRank: Math.round(ivRank),
    ivPercentile: Math.round(ivRank),
    ivSignal,
    recommendation,
    atmIV: Math.round(atmIV * 1000) / 10,
  };
}

// ============================================================
// MARKET METRICS
// ============================================================
interface MarketMetrics {
  totalCallVolume: number;
  totalPutVolume: number;
  totalCallOI: number;
  totalPutOI: number;
  putCallRatio: number;
  putCallOIRatio: number;
  sentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  maxPain: number;
}

function calculateMarketMetrics(calls: OptionContract[], puts: OptionContract[], currentPrice: number): MarketMetrics {
  const totalCallVolume = calls.reduce((sum, c) => sum + c.volume, 0);
  const totalPutVolume = puts.reduce((sum, p) => sum + p.volume, 0);
  const totalCallOI = calls.reduce((sum, c) => sum + c.openInterest, 0);
  const totalPutOI = puts.reduce((sum, p) => sum + p.openInterest, 0);
  
  const putCallRatio = totalCallVolume > 0 ? totalPutVolume / totalCallVolume : 1;
  const putCallOIRatio = totalCallOI > 0 ? totalPutOI / totalCallOI : 1;
  
  let sentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';
  if (putCallRatio < 0.7) sentiment = 'BULLISH';
  else if (putCallRatio > 1.2) sentiment = 'BEARISH';
  
  const strikeOI: { [strike: number]: number } = {};
  [...calls, ...puts].forEach(c => {
    strikeOI[c.strike] = (strikeOI[c.strike] || 0) + c.openInterest;
  });
  const maxPain = Object.entries(strikeOI).reduce((max, [strike, oi]) => 
    oi > (strikeOI[max] || 0) ? parseFloat(strike) : max, currentPrice);
  
  return {
    totalCallVolume,
    totalPutVolume,
    totalCallOI,
    totalPutOI,
    putCallRatio: Math.round(putCallRatio * 100) / 100,
    putCallOIRatio: Math.round(putCallOIRatio * 100) / 100,
    sentiment,
    maxPain: Math.round(maxPain * 100) / 100,
  };
}

// ============================================================
// TECHNICAL CALCULATIONS
// ============================================================
function calculateRSI(prices: number[], period = 14): number {
  if (prices.length < period + 1) return 50;
  const changes = prices.slice(-period - 1).map((p, i, arr) => i > 0 ? p - arr[i-1] : 0).slice(1);
  const gains = changes.filter(c => c > 0).reduce((a, b) => a + b, 0) / period;
  const losses = Math.abs(changes.filter(c => c < 0).reduce((a, b) => a + b, 0)) / period;
  if (losses === 0) return 100;
  return 100 - (100 / (1 + gains / losses));
}

function calculateSMA(prices: number[], period: number): number {
  if (prices.length < period) return prices[prices.length - 1] || 0;
  return prices.slice(-period).reduce((a, b) => a + b, 0) / period;
}

// ============================================================
// IV CONTEXT HELPER
// ============================================================
type IVContext = 'FAVORABLE' | 'ACCEPTABLE' | 'CAUTION' | 'AVOID';

function getIVContext(ivRank: number): IVContext {
  if (ivRank < 35) return 'FAVORABLE';
  if (ivRank < 55) return 'ACCEPTABLE';
  if (ivRank < 75) return 'CAUTION';
  return 'AVOID';
}

// ============================================================
// NAMED SETUP MATCHING
// ============================================================
export interface OptionsSetup {
  name: string;
  setupId: string;
  description: string;
  sentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  confluenceScore: number;         // 0-100
  confidenceLabel: 'EXTREME' | 'VERY_HIGH' | 'HIGH' | 'MEDIUM' | 'WATCH';
  ivContext: IVContext;
  recommendedStructure: {
    type: 'CALL' | 'PUT' | 'STRADDLE' | 'STRANGLE';
    dteLow: number;
    dteHigh: number;
    deltaLow: number;
    deltaHigh: number;
    description: string;
  };
  recommendedContract?: {
    strike: number;
    expiration: string;
    dte: number;
    delta: number;
    bid: number;
    ask: number;
    mark: number;
    iv: number;
    volume: number;
    openInterest: number;
    spreadPercent: number;
  };
  criteriaHit: string[];
  uoaConfirmation: boolean;
  totalPremium: number;     // Net UOA premium pointing this direction
  riskNote: string;
  spread?: {
    name: string;               // e.g. "Bull Call Spread"
    structure: string;          // e.g. "Buy $145C / Sell $150C exp 2026-03-21"
    debit: number;              // net cost per spread ($)
    maxGain: number;            // max profit per spread ($)
    breakeven: number;          // breakeven price
    riskReward: string;         // e.g. "1 : 2.5"
    preferOverNaked: boolean;   // true when IV context is CAUTION or AVOID
    note: string;
  };
}

function matchOptionsSetups(params: {
  calls: OptionContract[];
  puts: OptionContract[];
  trend: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  rsi: number;
  sma20: number;
  sma50: number;
  support: number;
  resistance: number;
  currentPrice: number;
  ivAnalysis: IVAnalysis;
  hv20: number;
  unusualActivity: UOAResult[];
  gex: ReturnType<typeof calculateGEX>;
}): OptionsSetup[] {
  const {
    calls, puts, trend, rsi, sma20, sma50, support, resistance,
    currentPrice, ivAnalysis, hv20, unusualActivity, gex,
  } = params;

  const ivRank = ivAnalysis.ivRank;
  const ivCtx = getIVContext(ivRank);
  const atmIV  = ivAnalysis.atmIV;

  // Aggregate UOA signals
  const bullishUOA = unusualActivity.filter(u => u.sentiment === 'BULLISH' && !u.hedgeDiscountApplied);
  const bearishUOA = unusualActivity.filter(u => u.sentiment === 'BEARISH' && !u.hedgeDiscountApplied);
  const uoaBullPremium = bullishUOA.reduce((s, u) => s + u.metrics.premium, 0);
  const uoaBearPremium = bearishUOA.reduce((s, u) => s + u.metrics.premium, 0);
  const topBullUOA = bullishUOA[0];
  const topBearUOA = bearishUOA[0];
  const hasBullFlow = bullishUOA.length > 0 && (topBullUOA?.uoaScore ?? 0) >= 50;
  const hasBearFlow = bearishUOA.length > 0 && (topBearUOA?.uoaScore ?? 0) >= 50;
  const hasGoldenSweep = unusualActivity.some(u => u.alertType === 'GOLDEN_SWEEP');

  // GEX context
  const negGEX = gex.regime === 'NEGATIVE'; // dealers short gamma → amplified moves

  // Helpers
  const pctFromSupport = (currentPrice - support) / support * 100;
  const pctFromResistance = (resistance - currentPrice) / resistance * 100;

  const ivContextScore = ivCtx === 'FAVORABLE' ? 100 : ivCtx === 'ACCEPTABLE' ? 70 : ivCtx === 'CAUTION' ? 35 : 0;

  // Find best matching contract in a window
  function bestContract(type: 'call' | 'put', dteLow: number, dteHigh: number, deltaLow: number, deltaHigh: number): OptionContract | undefined {
    const pool = (type === 'call' ? calls : puts).filter(c =>
      c.dte >= dteLow && c.dte <= dteHigh &&
      Math.abs(c.delta) >= deltaLow && Math.abs(c.delta) <= deltaHigh &&
      c.spreadPercent <= 12 && c.openInterest >= 200 && c.mark >= 0.10
    );
    return pool.sort((a, b) => b.volume - a.volume)[0];
  }

  // Build a vertical spread recommendation (bull call spread or bear put spread)
  function buildVerticalSpread(
    sentiment: 'BULLISH' | 'BEARISH',
    longLeg: OptionContract | undefined,
    preferSpread: boolean,
  ): OptionsSetup['spread'] | undefined {
    if (!longLeg) return undefined;
    const isBull = sentiment === 'BULLISH';
    const pool = (isBull ? calls : puts).filter(c =>
      c.expiration === longLeg.expiration &&
      c.dte === longLeg.dte &&
      Math.abs(c.delta) >= 0.15 && Math.abs(c.delta) <= 0.30 &&
      (isBull ? c.strike > longLeg.strike : c.strike < longLeg.strike)
    );
    if (pool.length === 0) return undefined;
    const shortLeg = pool.sort((a, b) => Math.abs(a.delta) - Math.abs(b.delta))[0];
    const debit = Math.round((longLeg.ask - shortLeg.bid) * 100) / 100;
    const width = Math.abs(shortLeg.strike - longLeg.strike);
    const maxGain = Math.round((width - debit) * 100) / 100;
    const breakeven = isBull
      ? Math.round((longLeg.strike + debit) * 100) / 100
      : Math.round((longLeg.strike - debit) * 100) / 100;
    const rr = debit > 0 ? (maxGain / debit).toFixed(1) : 'N/A';
    const name = isBull ? 'Bull Call Spread' : 'Bear Put Spread';
    const structure = isBull
      ? `Buy $${longLeg.strike}C / Sell $${shortLeg.strike}C  ${longLeg.expiration}`
      : `Buy $${longLeg.strike}P / Sell $${shortLeg.strike}P  ${longLeg.expiration}`;
    return {
      name,
      structure,
      debit,
      maxGain,
      breakeven,
      riskReward: `1 : ${rr}`,
      preferOverNaked: preferSpread,
      note: preferSpread
        ? `High IV environment — spread caps premium paid (max risk $${(debit * 100).toFixed(0)} per contract).`
        : `Lower-risk alternative to naked ${isBull ? 'call' : 'put'}. Debit: $${(debit * 100).toFixed(0)}, max gain: $${(maxGain * 100).toFixed(0)} per contract.`,
    };
  }

  // Build a straddle recommendation (for IV expansion setups)
  function buildStraddle(dteLow: number, dteHigh: number): OptionsSetup['spread'] | undefined {
    const atmCall = bestContract('call', dteLow, dteHigh, 0.45, 0.55);
    const atmPut  = bestContract('put',  dteLow, dteHigh, 0.45, 0.55);
    if (!atmCall || !atmPut || atmCall.expiration !== atmPut.expiration) return undefined;
    const debit = Math.round((atmCall.ask + atmPut.ask) * 100) / 100;
    const breakeven = Math.round(debit * 100) / 100;
    return {
      name: 'ATM Straddle',
      structure: `Buy $${atmCall.strike}C + Buy $${atmPut.strike}P  ${atmCall.expiration}`,
      debit,
      maxGain: Infinity,
      breakeven,
      riskReward: 'Undefined upside',
      preferOverNaked: true,
      note: `Profits from large move in either direction. Need >${(debit * 100).toFixed(0)}pts move to profit. Best entered when IV < HV.`,
    };
  }

  const setups: OptionsSetup[] = [];

  // ── 1. FLOW CONFIRMATION BREAKOUT ────────────────────────────────────────
  {
    const criteria: string[] = [];
    let techScore = 0;
    const priceAboveRes = currentPrice >= resistance * 0.99;
    if (priceAboveRes) { criteria.push('Price at/above resistance'); techScore += 25; }
    if (trend === 'BULLISH') { criteria.push('Uptrend confirmed (SMA20 > SMA50)'); techScore += 20; }
    if (rsi > 55 && rsi < 80) { criteria.push(`RSI ${rsi.toFixed(0)} — bullish momentum`); techScore += 15; }
    const topUOAscore = topBullUOA?.uoaScore ?? 0;
    if (hasBullFlow) { criteria.push(`Call sweep confirmed (score ${topUOAscore})`); techScore += 15; }
    if (ivCtx !== 'AVOID') { criteria.push(`IV context: ${ivCtx}`); techScore += 10; }
    if (negGEX) { criteria.push('Negative GEX — amplified upside breakout'); techScore += 15; }

    if (criteria.length >= 3 && hasBullFlow) {
      const uoaS = hasBullFlow ? (topBullUOA?.uoaScore ?? 0) : 0;
      const confluence = Math.round(uoaS * 0.45 + techScore * 0.35 + ivContextScore * 0.20);
      const rec = bestContract('call', 14, 35, 0.30, 0.55);
      setups.push({
        name: 'Flow Confirmation Breakout',
        setupId: 'FLOW_BREAKOUT',
        description: 'Price breaks resistance while large call sweep confirms institutional conviction.',
        sentiment: 'BULLISH',
        confluenceScore: Math.min(100, confluence),
        confidenceLabel: confluence >= 80 ? 'EXTREME' : confluence >= 65 ? 'VERY_HIGH' : confluence >= 50 ? 'HIGH' : confluence >= 35 ? 'MEDIUM' : 'WATCH',
        ivContext: ivCtx,
        recommendedStructure: { type: 'CALL', dteLow: 14, dteHigh: 35, deltaLow: 0.30, deltaHigh: 0.55, description: 'ATM–slightly OTM call, 14–35 DTE' },
        recommendedContract: rec ? { strike: rec.strike, expiration: rec.expiration, dte: rec.dte, delta: rec.delta, bid: rec.bid, ask: rec.ask, mark: rec.mark, iv: rec.iv, volume: rec.volume, openInterest: rec.openInterest, spreadPercent: rec.spreadPercent } : undefined,
        criteriaHit: criteria,
        uoaConfirmation: hasBullFlow,
        totalPremium: uoaBullPremium,
        riskNote: 'Max loss = premium paid. Exit if price falls back below breakout level.',
        spread: buildVerticalSpread('BULLISH', rec, ivCtx === 'CAUTION' || ivCtx === 'AVOID'),
      });
    }
  }

  // ── 2. GAMMA SQUEEZE PRECURSOR ────────────────────────────────────────────
  {
    const criteria: string[] = [];
    let techScore = 0;
    // Repeat flow at same strike = key signal
    const repeatFlow = unusualActivity.filter(u => u.isRepeatFlow && u.type === 'CALL' && !u.hedgeDiscountApplied);
    const highVolOI = unusualActivity.filter(u => u.metrics.volumeOIRatio >= 2 && u.type === 'CALL' && u.dte >= 7 && u.dte <= 30);
    const gexNegStrikes = gex.byStrike.filter(s => s.netGEX < -0.5 && s.strike > currentPrice);

    if (repeatFlow.length >= 1) { criteria.push(`Repeat call accumulation (${repeatFlow.length} contracts)`); techScore += 25; }
    if (highVolOI.length >= 1) { criteria.push(`Vol/OI >= 2x on near-dated calls`); techScore += 20; }
    if (gexNegStrikes.length >= 1) { criteria.push('Negative GEX strikes above price — dealers must buy to hedge'); techScore += 20; }
    if (trend !== 'BEARISH') { criteria.push('Trend not bearish — squeeze conditions valid'); techScore += 10; }
    if (rsi < 60) { criteria.push(`RSI ${rsi.toFixed(0)} — not yet overbought`); techScore += 10; }

    if (criteria.length >= 2 && (repeatFlow.length >= 1 || highVolOI.length >= 2)) {
      const uoaS = topBullUOA?.uoaScore ?? 50;
      const confluence = Math.round(uoaS * 0.45 + techScore * 0.35 + ivContextScore * 0.20);
      const targetStrike = gexNegStrikes[0]?.strike ?? (repeatFlow[0]?.strike ?? undefined);
      const rec = bestContract('call', 7, 30, 0.25, 0.45);
      setups.push({
        name: 'Gamma Squeeze Precursor',
        setupId: 'GAMMA_SQUEEZE',
        description: 'Concentrated call accumulation near negative GEX strikes. Dealers will be forced to buy shares as price rises, amplifying the move.',
        sentiment: 'BULLISH',
        confluenceScore: Math.min(100, confluence),
        confidenceLabel: confluence >= 80 ? 'EXTREME' : confluence >= 65 ? 'VERY_HIGH' : confluence >= 50 ? 'HIGH' : 'MEDIUM',
        ivContext: ivCtx,
        recommendedStructure: { type: 'CALL', dteLow: 7, dteHigh: 30, deltaLow: 0.25, deltaHigh: 0.45, description: `OTM call near GEX wall${targetStrike ? ` ($${targetStrike})` : ''}, 7–30 DTE` },
        recommendedContract: rec ? { strike: rec.strike, expiration: rec.expiration, dte: rec.dte, delta: rec.delta, bid: rec.bid, ask: rec.ask, mark: rec.mark, iv: rec.iv, volume: rec.volume, openInterest: rec.openInterest, spreadPercent: rec.spreadPercent } : undefined,
        criteriaHit: criteria,
        uoaConfirmation: hasBullFlow,
        totalPremium: uoaBullPremium,
        riskNote: 'Squeeze takes time — use 7–30 DTE, not 0DTE. Enter on price approaching the GEX wall.',
        spread: buildVerticalSpread('BULLISH', rec, ivCtx === 'CAUTION' || ivCtx === 'AVOID'),
      });
    }
  }

  // ── 3. PRE-EARNINGS IV EXPANSION ──────────────────────────────────────────
  // Note: without an earnings calendar, we approximate using IV term structure backwardation
  {
    const criteria: string[] = [];
    let techScore = 0;
    const isBackwardation = params.ivAnalysis.ivRank < 60;
    // Proxy for earnings: near-term IV elevated + short-dated unusual call flow
    const shortDatedFlow = unusualActivity.filter(u => u.dte <= 21 && u.type === 'CALL' && u.uoaScore >= 45);
    const ivVsHV = atmIV > 0 && hv20 > 0 ? atmIV / hv20 : 1;

    if (shortDatedFlow.length >= 1) { criteria.push(`Short-dated call flow (${shortDatedFlow.length} contracts, DTE ≤ 21)`); techScore += 30; }
    if (ivVsHV >= 1.2) { criteria.push(`IV ${(ivVsHV).toFixed(1)}x historical vol — event premium building`); techScore += 25; }
    if (ivCtx === 'ACCEPTABLE' || ivCtx === 'FAVORABLE') { criteria.push(`IV rank ${ivRank.toFixed(0)} — room to expand`); techScore += 20; }
    if (hasBullFlow || hasGoldenSweep) { criteria.push('Large directional flow confirms positioning'); techScore += 25; }

    if (criteria.length >= 2 && shortDatedFlow.length >= 1) {
      const uoaS = topBullUOA?.uoaScore ?? topBearUOA?.uoaScore ?? 45;
      const confluence = Math.round(uoaS * 0.45 + techScore * 0.35 + ivContextScore * 0.20);
      const rec = bestContract('call', 7, 25, 0.40, 0.60);
      setups.push({
        name: 'Pre-Catalyst IV Expansion',
        setupId: 'IV_EXPANSION',
        description: 'Short-dated flow + IV building above historical vol signals an upcoming catalyst. Buy before IV peaks.',
        sentiment: 'NEUTRAL',
        confluenceScore: Math.min(100, confluence),
        confidenceLabel: confluence >= 65 ? 'HIGH' : confluence >= 50 ? 'MEDIUM' : 'WATCH',
        ivContext: ivCtx,
        recommendedStructure: { type: 'STRADDLE', dteLow: 7, dteHigh: 21, deltaLow: 0.40, deltaHigh: 0.55, description: 'ATM straddle or OTM strangle, 7–21 DTE. Exit BEFORE event to capture IV expansion.' },
        recommendedContract: rec ? { strike: rec.strike, expiration: rec.expiration, dte: rec.dte, delta: rec.delta, bid: rec.bid, ask: rec.ask, mark: rec.mark, iv: rec.iv, volume: rec.volume, openInterest: rec.openInterest, spreadPercent: rec.spreadPercent } : undefined,
        criteriaHit: criteria,
        uoaConfirmation: hasBullFlow || hasBearFlow,
        totalPremium: uoaBullPremium + uoaBearPremium,
        riskNote: 'Exit BEFORE the catalyst to avoid IV crush. Max loss = premium paid.',
        spread: buildStraddle(7, 21),
      });
    }
  }

  // ── 4. MOMENTUM CONTINUATION ──────────────────────────────────────────────
  {
    const criteria: string[] = [];
    let techScore = 0;
    const inUptrend = currentPrice > sma20 && sma20 > sma50;
    const inDowntrend = currentPrice < sma20 && sma20 < sma50;

    if (inUptrend) { criteria.push('Price > SMA20 > SMA50 — confirmed uptrend'); techScore += 20; }
    if (inDowntrend) { criteria.push('Price < SMA20 < SMA50 — confirmed downtrend'); techScore += 20; }
    if (rsi > 50 && rsi < 70 && inUptrend) { criteria.push(`RSI ${rsi.toFixed(0)} — trend momentum zone`); techScore += 15; }
    if (rsi < 50 && rsi > 30 && inDowntrend) { criteria.push(`RSI ${rsi.toFixed(0)} — bearish momentum zone`); techScore += 15; }
    if (inUptrend && hasBullFlow) { criteria.push(`Call sweep in uptrend — high conviction`); techScore += 25; }
    if (inDowntrend && hasBearFlow) { criteria.push(`Put sweep in downtrend — high conviction`); techScore += 25; }
    if (ivCtx !== 'AVOID') { criteria.push(`IV context: ${ivCtx}`); techScore += 15; }

    const sentiment: 'BULLISH' | 'BEARISH' = inDowntrend ? 'BEARISH' : 'BULLISH';
    const hasFlow = sentiment === 'BULLISH' ? hasBullFlow : hasBearFlow;

    if (criteria.length >= 3 && hasFlow && (inUptrend || inDowntrend)) {
      const uoaS = sentiment === 'BULLISH' ? (topBullUOA?.uoaScore ?? 0) : (topBearUOA?.uoaScore ?? 0);
      const confluence = Math.round(uoaS * 0.45 + techScore * 0.35 + ivContextScore * 0.20);
      const rec = bestContract(sentiment === 'BULLISH' ? 'call' : 'put', 21, 45, 0.35, 0.55);
      const totalPrem = sentiment === 'BULLISH' ? uoaBullPremium : uoaBearPremium;
      setups.push({
        name: 'Momentum Continuation',
        setupId: 'MOMENTUM_CONT',
        description: `Strong ${sentiment.toLowerCase()} trend confirmed by EMAs. Large ${sentiment === 'BULLISH' ? 'call' : 'put'} flow confirms institutional participation.`,
        sentiment,
        confluenceScore: Math.min(100, confluence),
        confidenceLabel: confluence >= 80 ? 'EXTREME' : confluence >= 65 ? 'VERY_HIGH' : confluence >= 50 ? 'HIGH' : 'MEDIUM',
        ivContext: ivCtx,
        recommendedStructure: { type: sentiment === 'BULLISH' ? 'CALL' : 'PUT', dteLow: 21, dteHigh: 45, deltaLow: 0.35, deltaHigh: 0.55, description: `ATM ${sentiment === 'BULLISH' ? 'call' : 'put'}, 21–45 DTE — trend needs time to play out` },
        recommendedContract: rec ? { strike: rec.strike, expiration: rec.expiration, dte: rec.dte, delta: rec.delta, bid: rec.bid, ask: rec.ask, mark: rec.mark, iv: rec.iv, volume: rec.volume, openInterest: rec.openInterest, spreadPercent: rec.spreadPercent } : undefined,
        criteriaHit: criteria,
        uoaConfirmation: hasFlow,
        totalPremium: totalPrem,
        riskNote: 'Do NOT use 0DTE for trend continuation — use 21–45 DTE to give the trend room.',
        spread: buildVerticalSpread(sentiment, rec, ivCtx === 'CAUTION' || ivCtx === 'AVOID'),
      });
    }
  }

  // ── 5. SUPPORT RECLAIM REVERSAL ───────────────────────────────────────────
  {
    const criteria: string[] = [];
    let techScore = 0;
    const nearSupport = pctFromSupport < 3;
    const oversold = rsi < 38;

    if (nearSupport) { criteria.push(`Price within 3% of key support ($${support.toFixed(2)})`); techScore += 25; }
    if (oversold) { criteria.push(`RSI ${rsi.toFixed(0)} — oversold territory`); techScore += 20; }
    if (hasBullFlow && nearSupport) { criteria.push('Call buying at support — institutional conviction'); techScore += 30; }
    if (ivCtx === 'FAVORABLE' || ivCtx === 'ACCEPTABLE') { criteria.push(`IV rank ${ivRank.toFixed(0)} — reasonable premium`); techScore += 15; }

    if (criteria.length >= 2 && nearSupport && hasBullFlow) {
      const uoaS = topBullUOA?.uoaScore ?? 0;
      const confluence = Math.round(uoaS * 0.45 + techScore * 0.35 + ivContextScore * 0.20);
      const rec = bestContract('call', 21, 45, 0.40, 0.65);
      setups.push({
        name: 'Support Reclaim Reversal',
        setupId: 'SUPPORT_REVERSAL',
        description: 'Large call buying at key technical support. Institutions are loading up expecting a bounce.',
        sentiment: 'BULLISH',
        confluenceScore: Math.min(100, confluence),
        confidenceLabel: confluence >= 65 ? 'HIGH' : confluence >= 50 ? 'MEDIUM' : 'WATCH',
        ivContext: ivCtx,
        recommendedStructure: { type: 'CALL', dteLow: 21, dteHigh: 45, deltaLow: 0.40, deltaHigh: 0.65, description: 'ITM or ATM call, 21–45 DTE — higher delta for higher probability bounce play' },
        recommendedContract: rec ? { strike: rec.strike, expiration: rec.expiration, dte: rec.dte, delta: rec.delta, bid: rec.bid, ask: rec.ask, mark: rec.mark, iv: rec.iv, volume: rec.volume, openInterest: rec.openInterest, spreadPercent: rec.spreadPercent } : undefined,
        criteriaHit: criteria,
        uoaConfirmation: hasBullFlow,
        totalPremium: uoaBullPremium,
        riskNote: 'Exit if support level breaks with volume. Stop = close below support.',
        spread: buildVerticalSpread('BULLISH', rec, ivCtx === 'CAUTION' || ivCtx === 'AVOID'),
      });
    }
  }

  // ── 6. RESISTANCE BREAKDOWN (BEARISH) ────────────────────────────────────
  {
    const criteria: string[] = [];
    let techScore = 0;
    const nearResistance = pctFromResistance < 3;
    const overbought = rsi > 68;

    if (trend === 'BEARISH') { criteria.push('Bearish trend (SMA20 < SMA50)'); techScore += 20; }
    if (nearResistance) { criteria.push(`Price within 3% of resistance ($${resistance.toFixed(2)})`); techScore += 20; }
    if (overbought) { criteria.push(`RSI ${rsi.toFixed(0)} — overbought at resistance`); techScore += 20; }
    if (hasBearFlow) { criteria.push(`Put sweep confirmed (score ${topBearUOA?.uoaScore ?? 0})`); techScore += 30; }
    if (ivCtx !== 'AVOID') { criteria.push(`IV context: ${ivCtx}`); techScore += 10; }

    if (criteria.length >= 3 && hasBearFlow) {
      const uoaS = topBearUOA?.uoaScore ?? 0;
      const confluence = Math.round(uoaS * 0.45 + techScore * 0.35 + ivContextScore * 0.20);
      const rec = bestContract('put', 14, 35, 0.30, 0.55);
      setups.push({
        name: 'Resistance Breakdown',
        setupId: 'RESISTANCE_BREAK',
        description: 'Put buying at resistance with overbought conditions. Institutions positioning for reversal or continuation lower.',
        sentiment: 'BEARISH',
        confluenceScore: Math.min(100, confluence),
        confidenceLabel: confluence >= 65 ? 'HIGH' : confluence >= 50 ? 'MEDIUM' : 'WATCH',
        ivContext: ivCtx,
        recommendedStructure: { type: 'PUT', dteLow: 14, dteHigh: 35, deltaLow: 0.30, deltaHigh: 0.55, description: 'ATM or slightly OTM put, 14–35 DTE' },
        recommendedContract: rec ? { strike: rec.strike, expiration: rec.expiration, dte: rec.dte, delta: rec.delta, bid: rec.bid, ask: rec.ask, mark: rec.mark, iv: rec.iv, volume: rec.volume, openInterest: rec.openInterest, spreadPercent: rec.spreadPercent } : undefined,
        criteriaHit: criteria,
        uoaConfirmation: hasBearFlow,
        totalPremium: uoaBearPremium,
        riskNote: 'Max loss = premium paid. Exit if price breaks above resistance with volume.',
        spread: buildVerticalSpread('BEARISH', rec, ivCtx === 'CAUTION' || ivCtx === 'AVOID'),
      });
    }
  }

  // ── 7. GOLDEN SWEEP FOLLOW ────────────────────────────────────────────────
  {
    const goldenSweeps = unusualActivity.filter(u => u.alertType === 'GOLDEN_SWEEP');
    if (goldenSweeps.length > 0) {
      const topGolden = goldenSweeps[0];
      const isBull = topGolden.type === 'CALL';
      const criteria = [
        `Golden sweep detected — $${(topGolden.metrics.premium / 1e6).toFixed(2)}M at-ask premium`,
        `${topGolden.dte} DTE ${topGolden.type} $${topGolden.strike} — institutional conviction`,
        `UOA score: ${topGolden.uoaScore}/100`,
      ];
      const techScore = 60; // Golden sweep itself is high-signal
      const uoaS = topGolden.uoaScore;
      const confluence = Math.round(uoaS * 0.55 + techScore * 0.25 + ivContextScore * 0.20);
      const rec = bestContract(
        isBull ? 'call' : 'put',
        Math.max(7, topGolden.dte - 7),
        Math.min(60, topGolden.dte + 14),
        0.30, 0.55
      );
      setups.push({
        name: 'Golden Sweep Follow',
        setupId: 'GOLDEN_SWEEP_FOLLOW',
        description: `$1M+ premium ${isBull ? 'call' : 'put'} sweep — highest conviction institutional signal. Follow the smart money.`,
        sentiment: isBull ? 'BULLISH' : 'BEARISH',
        confluenceScore: Math.min(100, confluence),
        confidenceLabel: confluence >= 80 ? 'EXTREME' : confluence >= 65 ? 'VERY_HIGH' : 'HIGH',
        ivContext: ivCtx,
        recommendedStructure: {
          type: isBull ? 'CALL' : 'PUT',
          dteLow: 7, dteHigh: 45, deltaLow: 0.30, deltaHigh: 0.55,
          description: `Match the sweep: $${topGolden.strike} ${topGolden.type}, similar DTE`,
        },
        recommendedContract: rec ? { strike: rec.strike, expiration: rec.expiration, dte: rec.dte, delta: rec.delta, bid: rec.bid, ask: rec.ask, mark: rec.mark, iv: rec.iv, volume: rec.volume, openInterest: rec.openInterest, spreadPercent: rec.spreadPercent } : undefined,
        criteriaHit: criteria,
        uoaConfirmation: true,
        totalPremium: topGolden.metrics.premium,
        riskNote: 'Golden sweeps are not infallible — use 1–2% max portfolio risk. Stop at -50% of premium.',
        spread: buildVerticalSpread(isBull ? 'BULLISH' : 'BEARISH', rec, ivCtx === 'CAUTION' || ivCtx === 'AVOID'),
      });
    }
  }

  // Sort by confluence score descending
  return setups
    .filter(s => s.confluenceScore >= 30)
    .sort((a, b) => b.confluenceScore - a.confluenceScore);
}

// ============================================================
// GENERATE SUGGESTIONS
// ============================================================
interface OptionScore {
  total: number;
  delta: number;
  iv: number;
  liquidity: number;
  timing: number;
  technical: number;
  unusual: number;
}

function scoreOption(
  option: OptionContract,
  trend: 'BULLISH' | 'BEARISH' | 'NEUTRAL',
  avgIV: number,
): OptionScore {
  let deltaScore = 0;
  let ivScore = 0;
  let liquidityScore = 0;
  let timingScore = 0;
  let technicalScore = 0;
  let unusualScore = 0;

  // Delta scoring
  const absDelta = Math.abs(option.delta);
  if (absDelta >= 0.35 && absDelta <= 0.65) deltaScore = 2;
  else if (absDelta >= 0.25 && absDelta <= 0.75) deltaScore = 1;

  // IV scoring
  const optIV = option.iv * 100;
  if (optIV < avgIV * 0.9) ivScore = 2;
  else if (optIV <= avgIV) ivScore = 1;

  // Liquidity scoring
  if (option.spreadPercent < 3 && option.volume > 200) liquidityScore = 2;
  else if (option.spreadPercent < 5 && option.volume > 50) liquidityScore = 1;

  // Timing scoring
  if (option.dte >= 21 && option.dte <= 45) timingScore = 2;
  else if (option.dte >= 14 && option.dte <= 60) timingScore = 1;

  // Technical scoring
  if (option.type === 'call' && trend === 'BULLISH') technicalScore = 2;
  else if (option.type === 'put' && trend === 'BEARISH') technicalScore = 2;
  else if (trend === 'NEUTRAL') technicalScore = 1;

  // Unusual activity bonus
  if (option.isUnusual) unusualScore = 2;
  else if (option.unusualScore >= 30) unusualScore = 1;

  return {
    total: deltaScore + ivScore + liquidityScore + timingScore + technicalScore + unusualScore,
    delta: deltaScore,
    iv: ivScore,
    liquidity: liquidityScore,
    timing: timingScore,
    technical: technicalScore,
    unusual: unusualScore,
  };
}


function calibratedOptionConfidence(totalScore: number, trend: 'BULLISH' | 'BEARISH' | 'NEUTRAL', isTrendAligned: boolean, spreadPct: number, oi: number, volume: number) {
  // Conservative calibration to avoid overconfidence. (Measured framework placeholder - calibrate with future backtests.)
  let conf =
    totalScore >= 10 ? 76 :
    totalScore >= 8 ? 68 :
    totalScore >= 6 ? 58 :
    totalScore >= 5 ? 52 :
    44;

  if (trend === 'NEUTRAL') conf -= 10;
  if (isTrendAligned) conf += 4;

  // Tradability boosts/penalties
  if (spreadPct <= 3) conf += 3;
  else if (spreadPct >= 8) conf -= 6;

  if (oi >= 1500 || volume >= 500) conf += 3;
  else if (oi < 500 && volume < 200) conf -= 6;

  conf = Math.max(5, Math.min(95, Math.round(conf)));
  const bucket = conf >= 75 ? 'HIGH' : conf >= 60 ? 'MED' : 'LOW';
  return { confidence: conf, bucket, calibrationVersion: 'v1.0-conservative' as const };
}

function generateSuggestions(
  calls: OptionContract[],
  puts: OptionContract[],
  trend: 'BULLISH' | 'BEARISH' | 'NEUTRAL',
  rsi: number,
  ivAnalysis: IVAnalysis,
  metrics: MarketMetrics,
  unusualActivity: UOAResult[],
): any[] {
  const suggestions: any[] = [];

// Liquidity / tradability gate (accuracy-first: reject illiquid, wide-spread contracts)
function liquidityOk(c: OptionContract): boolean {
  const spreadOk = Number(c.spreadPercent ?? 999) <= 12;
  const interestOk = (Number(c.openInterest ?? 0) >= 500) || (Number(c.volume ?? 0) >= 200);
  const priceOk = Number(c.mark ?? 0) >= 0.10 && Number(c.bid ?? 0) >= 0.05;
  return Boolean(spreadOk && interestOk && priceOk);
}

  const validCalls = calls.filter(c => c.dte >= 7 && c.dte <= 90 && liquidityOk(c));
  const validPuts = puts.filter(p => p.dte >= 7 && p.dte <= 90 && liquidityOk(p));

  const scoredCalls = validCalls.map(c => ({ contract: c, score: scoreOption(c, trend, ivAnalysis.atmIV) }));
  const scoredPuts = validPuts.map(p => ({ contract: p, score: scoreOption(p, trend, ivAnalysis.atmIV) }));

  scoredCalls.sort((a, b) => b.score.total - a.score.total);
  scoredPuts.sort((a, b) => b.score.total - a.score.total);

  const emPct = expectedMovePct(ivAnalysis.atmIV, 30);

  // Best call
  if (scoredCalls.length > 0 && trend !== 'BEARISH') {
    const best = scoredCalls[0];
    const c = best.contract;
    const s = best.score;
    
    suggestions.push({
      type: 'CALL',
      strategy: trend === 'BULLISH' ? 'Long Call (Trend Aligned)' : 'Long Call (Speculative)',
      contract: c,
      score: s.total, // Send total score as number, not object
      maxScore: 12,
      reasoning: [
        `Delta: ${c.delta.toFixed(2)} (${Math.round(Math.abs(c.delta) * 100)}% prob ITM)`,
        `IV: ${(c.iv * 100).toFixed(0)}%`,
        `DTE: ${c.dte} days | Spread: ${c.spreadPercent.toFixed(1)}%`,
        `Score: ${s.total}/12`,
      ],
      warnings: s.total < 6 ? ['Lower confidence - manage size'] : [],
      confidence: calibratedOptionConfidence(s.total, trend, (trend === 'BULLISH'), c.spreadPercent, c.openInterest, c.volume).confidence,
      riskLevel: s.total >= 8 ? 'LOW' : s.total >= 5 ? 'MEDIUM' : 'HIGH',
    });
  }

  // Best put
  if (scoredPuts.length > 0) {
    const best = scoredPuts[0];
    const p = best.contract;
    const s = best.score;
    
    suggestions.push({
      type: 'PUT',
      strategy: trend === 'BEARISH' ? 'Long Put (Trend Aligned)' : 'Protective Put (Hedge)',
      contract: p,
      score: s.total, // Send total score as number, not object
      maxScore: 12,
      reasoning: [
        `Delta: ${p.delta.toFixed(2)} (${Math.round(Math.abs(p.delta) * 100)}% prob ITM)`,
        `IV: ${(p.iv * 100).toFixed(0)}%`,
        `DTE: ${p.dte} days | Spread: ${p.spreadPercent.toFixed(1)}%`,
        `Score: ${s.total}/12`,
      ],
      warnings: trend !== 'BEARISH' ? ['Counter-trend - use as hedge'] : [],
      confidence: calibratedOptionConfidence(s.total, trend, (trend === 'BEARISH'), p.spreadPercent, p.openInterest, p.volume).confidence,
      riskLevel: s.total >= 8 ? 'LOW' : s.total >= 5 ? 'MEDIUM' : 'HIGH',
    });
  }

  // Unusual activity alert
  if (unusualActivity.length > 0) {
    const topUnusual = unusualActivity[0];
    suggestions.push({
      type: 'ALERT',
      strategy: `Unusual Activity: ${topUnusual.type.toUpperCase()} $${topUnusual.strike}`,
      contract: { type: topUnusual.type, strike: topUnusual.strike, expiration: topUnusual.expiration },
      reasoning: topUnusual.signals,
      warnings: [],
      confidence: topUnusual.uoaScore,
      riskLevel: 'WARNING',
      sentiment: topUnusual.sentiment,
    });
  }

  // IV alerts
  if (ivAnalysis.ivSignal === 'HIGH') {
    suggestions.push({
      type: 'ALERT',
      strategy: `⚠️ High IV Environment (${ivAnalysis.atmIV.toFixed(0)}%)`,
      reasoning: ['Options are expensive', 'Consider selling premium or spreads'],
      warnings: [],
      confidence: 0,
      riskLevel: 'WARNING',
    });
  } else if (ivAnalysis.ivSignal === 'LOW') {
    suggestions.push({
      type: 'ALERT',
      strategy: `💡 Low IV Environment (${ivAnalysis.atmIV.toFixed(0)}%)`,
      reasoning: ['Options are cheap', 'Good time to buy premium'],
      warnings: [],
      confidence: 0,
      riskLevel: 'WARNING',
    });
  }

  // RSI alert
  if (rsi > 70 || rsi < 30) {
    suggestions.push({
      type: 'ALERT',
      strategy: rsi > 70 ? `⚠️ RSI Overbought (${rsi.toFixed(0)})` : `⚠️ RSI Oversold (${rsi.toFixed(0)})`,
      reasoning: [rsi > 70 ? 'Stock may be extended' : 'Stock may bounce'],
      warnings: [],
      confidence: 0,
      riskLevel: 'WARNING',
    });
  }

  
  const tradable = suggestions.filter(s => s.type === 'CALL' || s.type === 'PUT');
  if (tradable.length === 0) {
    const reasons: string[] = [];
    reasons.push('No contracts passed liquidity/spread gates (spread% ≤ 12, OI ≥ 500 or volume ≥ 200, mark ≥ 0.10).');
    if (trend === 'NEUTRAL') reasons.push('Underlying trend is NEUTRAL; skipping directional options suggestions for accuracy.');
    reasons.push(`Expected move (30D, IV-based): ~${emPct}%`);
    return [{
      type: 'NO_TRADE',
      strategy: 'NO_TRADE',
      confidence: 0,
      riskLevel: 'N/A',
      reasoning: reasons,
      warnings: [],
    }];
  }

  return suggestions;

}

// ============================================================
// ============================================================
// GAMMA EXPOSURE (GEX)
// ============================================================
function calculateGEX(allContracts: OptionContract[], spotPrice: number): {
  netGEX: number;
  byStrike: { strike: number; callGEX: number; putGEX: number; netGEX: number }[];
  gexWalls: { strike: number; level: number; type: 'CALL_WALL' | 'PUT_WALL' }[];
  flipPoint: number | null;
  regime: 'POSITIVE' | 'NEGATIVE';
} {
  // Group by strike
  const strikeMap = new Map<number, { callGEX: number; putGEX: number }>();

  for (const c of allContracts) {
    if (!c.gamma || !c.openInterest) continue;
    const gex = c.gamma * c.openInterest * 100 * spotPrice * spotPrice / 1e8; // Scale to readable numbers
    const entry = strikeMap.get(c.strike) || { callGEX: 0, putGEX: 0 };
    if (c.type === 'call') {
      entry.callGEX += gex;
    } else {
      entry.putGEX += gex;
    }
    strikeMap.set(c.strike, entry);
  }

  const byStrike = Array.from(strikeMap.entries())
    .map(([strike, { callGEX, putGEX }]) => ({
      strike,
      callGEX: Math.round(callGEX * 100) / 100,
      putGEX: Math.round(putGEX * 100) / 100,
      netGEX: Math.round((callGEX - putGEX) * 100) / 100,
    }))
    .sort((a, b) => a.strike - b.strike);

  const netGEX = Math.round(byStrike.reduce((sum, s) => sum + s.netGEX, 0) * 100) / 100;

  // GEX walls: top 3 by absolute netGEX
  const walls = [...byStrike]
    .sort((a, b) => Math.abs(b.netGEX) - Math.abs(a.netGEX))
    .slice(0, 3)
    .map(s => ({
      strike: s.strike,
      level: Math.abs(s.netGEX),
      type: (s.netGEX > 0 ? 'CALL_WALL' : 'PUT_WALL') as 'CALL_WALL' | 'PUT_WALL',
    }));

  // Flip point: strike where cumulative GEX crosses zero (sorted by strike)
  let cumGEX = 0;
  let flipPoint: number | null = null;
  for (const s of byStrike) {
    const prevSign = Math.sign(cumGEX);
    cumGEX += s.netGEX;
    if (prevSign !== 0 && Math.sign(cumGEX) !== prevSign) {
      flipPoint = s.strike;
      break;
    }
  }

  return {
    netGEX,
    byStrike,
    gexWalls: walls,
    flipPoint,
    regime: netGEX >= 0 ? 'POSITIVE' : 'NEGATIVE',
  };
}

// ============================================================
// IV TERM STRUCTURE
// ============================================================
function calculateIVTermStructure(
  byExpiration: Record<string, { calls: OptionContract[]; puts: OptionContract[] }>,
  spotPrice: number
): {
  term: { expiration: string; dte: number; atmIV: number }[];
  shape: 'BACKWARDATION' | 'CONTANGO' | 'FLAT' | 'HUMPED';
  nearTermIV: number;
  longerTermIV: number;
  ivSpread: number;
} {
  const term: { expiration: string; dte: number; atmIV: number }[] = [];

  for (const [expiration, { calls, puts }] of Object.entries(byExpiration)) {
    const atmWindow = spotPrice * 0.02; // 2% from spot
    const nearContracts = [...calls, ...puts].filter(c =>
      Math.abs(c.strike - spotPrice) <= atmWindow && c.iv > 0
    );
    if (nearContracts.length === 0) continue;
    const avgIV = nearContracts.reduce((sum, c) => sum + c.iv * 100, 0) / nearContracts.length;
    const dte = nearContracts[0]?.dte || 0;
    term.push({ expiration, dte, atmIV: Math.round(avgIV * 10) / 10 });
  }

  term.sort((a, b) => a.dte - b.dte);

  if (term.length < 2) {
    return { term, shape: 'FLAT', nearTermIV: term[0]?.atmIV || 0, longerTermIV: term[0]?.atmIV || 0, ivSpread: 0 };
  }

  const nearTermIV = term[0].atmIV;
  const longerTermIV = term[term.length - 1].atmIV;
  const ivSpread = Math.round((nearTermIV - longerTermIV) * 10) / 10;

  let shape: 'BACKWARDATION' | 'CONTANGO' | 'FLAT' | 'HUMPED';
  if (Math.abs(ivSpread) < 2) {
    shape = 'FLAT';
  } else if (ivSpread > 0) {
    shape = 'BACKWARDATION'; // Near > Far
  } else {
    // Check for hump (middle > both ends)
    const midIV = term[Math.floor(term.length / 2)]?.atmIV || 0;
    shape = midIV > nearTermIV && midIV > longerTermIV ? 'HUMPED' : 'CONTANGO';
  }

  return { term, shape, nearTermIV, longerTermIV, ivSpread };
}

// ============================================================
// EARNINGS IMPLIED MOVE
// ============================================================
function calculateEarningsImpliedMove(
  byExpiration: Record<string, { calls: OptionContract[]; puts: OptionContract[] }>,
  spotPrice: number
): {
  impliedMovePercent: number;
  impliedMoveDollar: number;
  upperTarget: number;
  lowerTarget: number;
  straddle: { strike: number; callAsk: number; putAsk: number; total: number };
  nearestExpiration: string;
} | null {
  const expirations = Object.keys(byExpiration).sort();
  if (expirations.length === 0) return null;

  // Use nearest expiration unless < 3 DTE, then use next one
  let targetExp = expirations[0];
  const firstDTE = byExpiration[expirations[0]]?.calls[0]?.dte || 0;
  if (firstDTE < 3 && expirations.length > 1) {
    targetExp = expirations[1];
  }

  const { calls, puts } = byExpiration[targetExp] || { calls: [], puts: [] };
  if (calls.length === 0 || puts.length === 0) return null;

  // Find ATM strike (nearest to spot)
  const allStrikes = [...new Set([...calls.map(c => c.strike), ...puts.map(p => p.strike)])].sort(
    (a, b) => Math.abs(a - spotPrice) - Math.abs(b - spotPrice)
  );
  const atmStrike = allStrikes[0];
  if (!atmStrike) return null;

  const atmCall = calls.find(c => c.strike === atmStrike);
  const atmPut = puts.find(p => p.strike === atmStrike);
  if (!atmCall || !atmPut) return null;

  const callAsk = atmCall.ask || atmCall.mark || 0;
  const putAsk = atmPut.ask || atmPut.mark || 0;
  const straddleTotal = callAsk + putAsk;

  const impliedMovePercent = spotPrice > 0 ? Math.round((straddleTotal / spotPrice) * 10000) / 100 : 0;
  const impliedMoveDollar = Math.round(straddleTotal * 100) / 100;

  return {
    impliedMovePercent,
    impliedMoveDollar,
    upperTarget: Math.round((spotPrice * (1 + impliedMovePercent / 100)) * 100) / 100,
    lowerTarget: Math.round((spotPrice * (1 - impliedMovePercent / 100)) * 100) / 100,
    straddle: {
      strike: atmStrike,
      callAsk: Math.round(callAsk * 100) / 100,
      putAsk: Math.round(putAsk * 100) / 100,
      total: straddleTotal,
    },
    nearestExpiration: targetExp,
  };
}

// ============================================================
// HISTORICAL VOLATILITY (HV20)
// ============================================================
function calculateHV20(priceHistory: { close: number }[]): number {
  if (priceHistory.length < 22) return 0;
  const closes = priceHistory.map(c => c.close);
  const logReturns: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    if (closes[i - 1] > 0) logReturns.push(Math.log(closes[i] / closes[i - 1]));
  }
  const slice = logReturns.slice(-20);
  const mean = slice.reduce((a, b) => a + b, 0) / slice.length;
  const variance = slice.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / (slice.length - 1);
  const hv20 = Math.sqrt(variance) * Math.sqrt(252) * 100;
  return Math.round(hv20 * 10) / 10;
}

// ============================================================
// MAIN API HANDLER
// ============================================================
export async function GET(request: NextRequest, { params }: { params: { ticker: string } }) {
  const ticker = params.ticker.toUpperCase();
  if (!/^[A-Z0-9.\-]{1,10}$/.test(ticker)) {
    return NextResponse.json({ error: 'Invalid ticker symbol', ticker }, { status: 400 });
  }
  const startTime = Date.now();

  const { token, error: tokenError, status: errorCode } = await getSchwabAccessToken('options');

  if (!token) {
    return NextResponse.json({
      error: 'Schwab authentication failed',
      details: tokenError,
      errorCode,
      ticker,
      instructions: errorCode === 401
        ? ['Schwab refresh token has expired (7-day limit)', 'Generate a new refresh token']
        : ['Set SCHWAB_APP_KEY, SCHWAB_APP_SECRET, SCHWAB_REFRESH_TOKEN'],
      lastUpdated: new Date().toISOString(),
      dataSource: 'none',
    });
  }

  const { data: chainData, error: chainError } = await fetchOptionsChain(token, ticker);
  
  if (!chainData || chainError) {
    const is401 = typeof chainError === 'string' && chainError.includes('(401)');
    return NextResponse.json({
      error: 'Failed to fetch options chain',
      details: chainError,
      ticker,
      instructions: is401
        ? [
            'In Vercel, confirm SCHWAB_APP_KEY / SCHWAB_APP_SECRET / SCHWAB_REFRESH_TOKEN are set in the SAME environment you are deploying (Production vs Preview).',
            'Confirm the refresh token was generated for the same Schwab app (app key/secret) you have configured.',
            'If Schwab returned a NEW refresh token during a prior refresh, update SCHWAB_REFRESH_TOKEN and redeploy.',
            'After updating env vars, trigger a fresh Production deployment (do not rely on an existing build cache).',
          ]
        : undefined,
      envFlags: {
        hasAppKey: Boolean(process.env.SCHWAB_APP_KEY?.trim()),
        hasAppSecret: Boolean(process.env.SCHWAB_APP_SECRET?.trim()),
        hasRefreshToken: Boolean(process.env.SCHWAB_REFRESH_TOKEN?.trim()),
      },
      lastUpdated: new Date().toISOString(),
      dataSource: 'none',
    });
  }

  const currentPrice = chainData.underlyingPrice || 0;
  
  if (currentPrice === 0) {
    return NextResponse.json({ error: 'Invalid underlying price', ticker });
  }

  const { calls, puts, expirations, byExpiration } = parseOptionsChain(chainData, currentPrice);
  const priceHistory = await fetchPriceHistory(token, ticker);
  const closes = priceHistory.map(c => c.close);

  const rsi = closes.length > 14 ? calculateRSI(closes) : 50;
  const sma20 = closes.length > 20 ? calculateSMA(closes, 20) : currentPrice;
  const sma50 = closes.length > 50 ? calculateSMA(closes, 50) : currentPrice * 0.95;
  const support = closes.length > 0 ? Math.min(...closes.slice(-20)) : currentPrice * 0.95;
  const resistance = closes.length > 0 ? Math.max(...closes.slice(-20)) : currentPrice * 1.05;

  // New computations
  const allContracts = [...calls, ...puts];
  const gex = calculateGEX(allContracts, currentPrice);
  const ivTermStructure = calculateIVTermStructure(byExpiration, currentPrice);
  const earningsImpliedMove = calculateEarningsImpliedMove(byExpiration, currentPrice);
  const hv20 = calculateHV20(priceHistory);
  
  let trend: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';
  if (currentPrice > sma20 && currentPrice > sma50) trend = 'BULLISH';
  else if (currentPrice < sma20 && currentPrice < sma50) trend = 'BEARISH';
  
  // Convert trend for unusual activity detection
  const stockTrend: 'UP' | 'DOWN' | 'SIDEWAYS' = trend === 'BULLISH' ? 'UP' : trend === 'BEARISH' ? 'DOWN' : 'SIDEWAYS';

  const ivAnalysis = analyzeIV(calls, puts, currentPrice);
  const marketMetrics = calculateMarketMetrics(calls, puts, currentPrice);

  // Phase E: load repeat flow map from snapshot store
  let repeatFlowMap = new Map<string, number>();
  try {
    const store = await getSnapshotStore();
    const recentSnaps = await store.getSnapshotsByTicker(ticker, 10);
    const today = new Date().toISOString().slice(0, 10);
    const dayMap = new Map<string, Set<string>>();
    for (const snap of recentSnaps) {
      const dayKey = (snap.asOf || '').slice(0, 10);
      if (dayKey === today) continue; // skip today, only count prior sessions
      const uoaList: any[] = snap.payload?.uoaContracts ?? [];
      for (const item of uoaList) {
        const key = item.optionSymbol ?? `${snap.ticker}_${item.expiration}${item.type?.[0]}${item.strike}`;
        if (!dayMap.has(key)) dayMap.set(key, new Set());
        dayMap.get(key)!.add(dayKey);
      }
    }
    for (const [key, days] of dayMap.entries()) {
      repeatFlowMap.set(key, days.size);
    }
  } catch { /* non-fatal */ }

  const unusualActivity = detectUnusualActivity(calls, puts, currentPrice, stockTrend, false, ticker, repeatFlowMap);

  // Phase C: named setup matching
  const optionsSetups = matchOptionsSetups({
    calls, puts, trend, rsi, sma20, sma50, support, resistance,
    currentPrice, ivAnalysis, hv20, unusualActivity, gex,
  });

  const suggestions = generateSuggestions(calls, puts, trend, rsi, ivAnalysis, marketMetrics, unusualActivity);
  const tradable = suggestions.filter((s: any) => s.type === 'CALL' || s.type === 'PUT');
  const tradeDecision = tradable.length === 0 || suggestions[0]?.type === 'NO_TRADE'
    ? { action: 'NO_TRADE', confidence: 0, rationale: suggestions[0]?.reasoning || ['No trade'] }
    : { action: 'OPTIONS_TRADE', confidence: Math.max(0, Math.min(95, Math.round(tradable[0]?.confidence || 0))), rationale: tradable[0]?.reasoning || [] };


  // Save snapshot for repeat flow tracking (best-effort)
  try {
    const store = await getSnapshotStore();
    const uoaContracts = unusualActivity.slice(0, 8).map(u => ({
      optionSymbol: u.optionSymbol,
      type: u.type,
      strike: u.strike,
      expiration: u.expiration,
      dte: u.dte,
      uoaScore: u.uoaScore,
      alertType: u.alertType,
    }));
    await store.saveSnapshot({
      id: `opt_${ticker}_${Date.now()}`,
      asOf: new Date().toISOString(),
      source: 'options',
      ticker,
      decision: unusualActivity.length > 0 ? 'TRADE' : 'NO_TRADE',
      setupName: optionsSetups[0]?.name ?? null,
      confidence: optionsSetups[0]?.confluenceScore ?? 0,
      evidence: null,
      payload: { uoaContracts },
    });
  } catch { /* non-fatal */ }

  const firstExp = expirations[0] || '';

  return NextResponse.json({
    ticker,
    currentPrice: Math.round(currentPrice * 100) / 100,
    lastUpdated: new Date().toISOString(),
    dataSource: 'schwab-live',
    responseTimeMs: Date.now() - startTime,
    meta: { asOf: new Date().toISOString(), calibrationVersion: 'v1.0-conservative', tradeDecision },
    expirations,
    selectedExpiration: firstExp,
    byExpiration,
    gex,
    ivTermStructure,
    earningsImpliedMove,
    historicalVolatility: { hv20, ivVsHV: ivAnalysis.atmIV > 0 && hv20 > 0 ? Math.round((ivAnalysis.atmIV / hv20) * 100) / 100 : null },
    technicals: {
      trend,
      rsi: Math.round(rsi),
      sma20: Math.round(sma20 * 100) / 100,
      sma50: Math.round(sma50 * 100) / 100,
      support: Math.round(support * 100) / 100,
      resistance: Math.round(resistance * 100) / 100,
    },
    ivAnalysis,
    metrics: {
      putCallRatio: marketMetrics.putCallRatio,
      putCallOIRatio: marketMetrics.putCallOIRatio,
      totalCallVolume: marketMetrics.totalCallVolume,
      totalPutVolume: marketMetrics.totalPutVolume,
      totalCallOI: marketMetrics.totalCallOI,
      totalPutOI: marketMetrics.totalPutOI,
      sentiment: marketMetrics.sentiment,
      maxPain: marketMetrics.maxPain,
      avgIV: ivAnalysis.atmIV,
      ivRank: ivAnalysis.ivRank,
    },
    // IV context label for frontend
    ivContext: getIVContext(ivAnalysis.ivRank),
    // Named options setups (Phase C)
    optionsSetups,
    unusualActivity: unusualActivity.map(u => ({
      // Core identification
      optionSymbol: u.optionSymbol,
      strike: u.strike,
      type: u.type,
      expiration: u.expiration,
      dte: u.dte,
      delta: u.delta,
      // New scoring fields
      uoaScore: u.uoaScore,
      tier: u.tier,
      alertType: u.alertType,
      scoreBreakdown: u.scoreBreakdown,
      aggressionProxy: u.aggressionProxy,
      // Legacy fields (kept for existing component compat)
      score: u.uoaScore,
      volume: u.metrics.volume,
      openInterest: u.metrics.openInterest,
      volumeOIRatio: u.metrics.volumeOIRatio,
      bid: u.type === 'CALL'
        ? (calls.find(c => c.strike === u.strike && c.expiration === u.expiration)?.bid ?? 0)
        : (puts.find(p => p.strike === u.strike && p.expiration === u.expiration)?.bid ?? 0),
      ask: u.type === 'CALL'
        ? (calls.find(c => c.strike === u.strike && c.expiration === u.expiration)?.ask ?? 0)
        : (puts.find(p => p.strike === u.strike && p.expiration === u.expiration)?.ask ?? 0),
      mark: u.type === 'CALL'
        ? (calls.find(c => c.strike === u.strike && c.expiration === u.expiration)?.mark ?? 0)
        : (puts.find(p => p.strike === u.strike && p.expiration === u.expiration)?.mark ?? 0),
      premium: Math.round(u.metrics.premium),
      premiumFormatted: u.metrics.premium >= 1_000_000
        ? `$${(u.metrics.premium / 1e6).toFixed(2)}M`
        : `$${(u.metrics.premium / 1e3).toFixed(0)}K`,
      signals: u.signals,
      sentiment: u.sentiment,
      convictionLevel: u.convictionLevel,
      interpretation: u.interpretation,
      tradeType: u.tradeType,
      tradeTypeReason: u.tradeTypeReason,
      insiderProbability: u.insiderProbability,
      insiderSignals: u.insiderSignals,
      isRepeatFlow: u.isRepeatFlow,
      consecutiveDays: u.consecutiveDays,
      hedgeDiscountApplied: u.hedgeDiscountApplied,
      // Full contract for tracking (legacy)
      contract: {
        strike: u.strike,
        type: u.type.toLowerCase(),
        expiration: u.expiration,
        dte: u.dte,
        delta: u.delta,
        volume: u.metrics.volume,
        openInterest: u.metrics.openInterest,
        volumeOIRatio: u.metrics.volumeOIRatio,
        bid: u.type === 'CALL'
          ? (calls.find(c => c.strike === u.strike && c.expiration === u.expiration)?.bid ?? 0)
          : (puts.find(p => p.strike === u.strike && p.expiration === u.expiration)?.bid ?? 0),
        ask: u.type === 'CALL'
          ? (calls.find(c => c.strike === u.strike && c.expiration === u.expiration)?.ask ?? 0)
          : (puts.find(p => p.strike === u.strike && p.expiration === u.expiration)?.ask ?? 0),
        mark: u.type === 'CALL'
          ? (calls.find(c => c.strike === u.strike && c.expiration === u.expiration)?.mark ?? 0)
          : (puts.find(p => p.strike === u.strike && p.expiration === u.expiration)?.mark ?? 0),
      },
    })),
    suggestions,
    optionsChain: {
      calls: byExpiration[firstExp]?.calls || [],
      puts: byExpiration[firstExp]?.puts || [],
    },
    allCalls: calls,
    allPuts: puts,
  });
}