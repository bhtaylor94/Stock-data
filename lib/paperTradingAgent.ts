// lib/paperTradingAgent.ts
// Autonomous paper trading agent — runs every 60s via cron-job.org
// Implements hedge-fund-style risk management: options-first, Kelly-influenced sizing

import { getSchwabAccessToken, schwabFetchJson } from './schwab';
import { detectUnusualActivity } from './unusualActivityDetector';
import { getRedis, isRedisAvailable } from './redis';
import {
  PaperPortfolio,
  PaperPosition,
  AgentLogEntry,
  EnteredTrade,
  ExitedTrade,
  SkippedTrade,
  PositionDirection,
  ExitReason,
  loadPortfolio,
  savePortfolio,
  loadPositions,
  savePositions,
  appendLog,
  appendEquitySnapshot,
} from './paperTradingStore';

// ─────────────────────────────────────────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────────────────────────────────────────

const MAX_TOTAL_POSITIONS   = 8;
const MAX_OPTIONS_POSITIONS = 5;
const MAX_STOCK_POSITIONS   = 4;
const MAX_SECTOR_PCT        = 0.30;
const CASH_FLOOR_PCT        = 0.25;
const RISK_PER_TRADE_PCT    = 0.02;
const MAX_POSITION_PCT      = 0.05;

const OPTIONS_TAKE_PROFIT_PCT = 0.50;   // +50% on premium
const OPTIONS_STOP_LOSS_PCT   = -0.33;  // -33% on premium
const OPTIONS_DTE_EXIT        = 3;      // exit if DTE < 3

const STOCK_TARGET_PCT       = 0.10;    // +10% target
const STOCK_TRAILING_PCT     = 0.07;    // 7% trailing stop from peak
const STOCK_TIME_STOP_DAYS   = 20;      // max 20 days holding
const STOCK_TIME_STOP_MIN    = 0.05;    // must be +5% in 20 days

const ENTRY_SLIP_OPTIONS = 1.015;   // mid + 1.5%
const EXIT_SLIP_OPTIONS  = 0.985;   // mid − 1.5%
const SLIP_STOCK         = 0.001;   // 0.1% each way
const COMMISSION_OPTION  = 0.65;    // $0.65/contract

const OPTIONS_WATCHLIST = ['NVDA', 'AAPL', 'TSLA', 'MSFT', 'AMZN', 'META', 'AMD', 'SPY', 'QQQ', 'GOOGL'];
const STOCK_WATCHLIST   = ['NVDA', 'AAPL', 'TSLA', 'MSFT', 'AMZN', 'META', 'AMD', 'GOOGL', 'SPY', 'QQQ'];

// IV rank heuristic fallback ranges [low52w, high52w]
const IV_RANK_RANGES: Record<string, [number, number]> = {
  SPY: [0.12, 0.50], QQQ: [0.12, 0.50],
  AAPL: [0.18, 0.65], MSFT: [0.18, 0.65], GOOGL: [0.18, 0.65],
  NVDA: [0.35, 1.50], TSLA: [0.35, 1.50],
  AMD: [0.25, 0.90], META: [0.25, 0.90], AMZN: [0.25, 0.90],
};

const SECTOR_MAP: Record<string, string> = {
  NVDA: 'Semi',  AAPL: 'Tech',     TSLA: 'Consumer',
  MSFT: 'Tech',  AMZN: 'Consumer', META: 'Tech',
  AMD:  'Semi',  SPY:  'ETF',      QQQ:  'ETF',
  GOOGL: 'Tech',
};

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function isMarketOpen(): boolean {
  const now = new Date();
  // Use Intl to get ET components (handles EST/EDT automatically)
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    weekday: 'short',
    hour: 'numeric',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(now);

  const weekday = parts.find(p => p.type === 'weekday')?.value ?? '';
  const hour    = parseInt(parts.find(p => p.type === 'hour')?.value ?? '24', 10);
  const minute  = parseInt(parts.find(p => p.type === 'minute')?.value ?? '0', 10);

  if (weekday === 'Sat' || weekday === 'Sun') return false;

  const etMinutes  = hour * 60 + minute;
  const openMins   = 9 * 60 + 35;   // 9:35 AM ET
  const closeMins  = 15 * 60 + 45;  // 3:45 PM ET

  return etMinutes >= openMins && etMinutes < closeMins;
}

function daysBetween(isoA: string, isoB: string): number {
  return Math.floor((new Date(isoB).getTime() - new Date(isoA).getTime()) / 86_400_000);
}

function dteDaysLeft(expiration: string): number {
  return Math.max(0, Math.floor((new Date(expiration).getTime() - Date.now()) / 86_400_000));
}

function nanoid(): string {
  return `pt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

/** Estimate IV rank — real Redis history if available, heuristic fallback */
async function estimateIVRank(ticker: string, currentIV: number): Promise<number> {
  if (isRedisAvailable()) {
    try {
      const history = await getRedis().get<number[]>(`iv_history:${ticker}`);
      if (history && history.length >= 20) {
        const lo = Math.min(...history);
        const hi = Math.max(...history);
        if (hi > lo) return (currentIV - lo) / (hi - lo);
      }
    } catch { /* fall through to heuristic */ }
  }
  const [lo, hi] = IV_RANK_RANGES[ticker] ?? [0.20, 0.80];
  return Math.max(0, Math.min(1, (currentIV - lo) / (hi - lo)));
}

/** Size options position: 2% risk, 5% max — returns contracts (min 1) */
function sizeOptionContracts(portfolioValue: number, midPremium: number): number {
  const risk    = portfolioValue * RISK_PER_TRADE_PCT;
  const maxSize = portfolioValue * MAX_POSITION_PCT;
  const budget  = Math.min(risk, maxSize);
  return Math.max(1, Math.floor(budget / (midPremium * 100)));
}

/** Size stock position: 2% risk on 7% stop, 5% max — returns shares (min 1) */
function sizeStockShares(portfolioValue: number, price: number): number {
  const riskPerShare  = price * STOCK_TRAILING_PCT;
  const sharesFromRisk = Math.floor((portfolioValue * RISK_PER_TRADE_PCT) / riskPerShare);
  const sharesFromMax  = Math.floor((portfolioValue * MAX_POSITION_PCT) / price);
  return Math.max(1, Math.min(sharesFromRisk, sharesFromMax));
}

/**
 * Flatten Schwab options chain response into the flat array format
 * that detectUnusualActivity() expects.
 */
function parseChainForUOA(chainData: any): { contracts: any[]; underlyingPrice: number } {
  const underlyingPrice: number =
    chainData.underlyingPrice ?? chainData.underlyingLastPrice ?? 0;
  const contracts: any[] = [];

  for (const [expKey, strikes] of Object.entries(chainData.callExpDateMap ?? {})) {
    const dte = parseInt((expKey.split(':')[1] ?? '0'), 10);
    for (const contractList of Object.values(strikes as Record<string, any[]>)) {
      for (const c of contractList) {
        contracts.push({ ...c, putCall: 'CALL', daysToExpiration: dte });
      }
    }
  }
  for (const [expKey, strikes] of Object.entries(chainData.putExpDateMap ?? {})) {
    const dte = parseInt((expKey.split(':')[1] ?? '0'), 10);
    for (const contractList of Object.values(strikes as Record<string, any[]>)) {
      for (const c of contractList) {
        contracts.push({ ...c, putCall: 'PUT', daysToExpiration: dte });
      }
    }
  }
  return { contracts, underlyingPrice };
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC INTERFACE
// ─────────────────────────────────────────────────────────────────────────────

export interface AgentRunResult {
  portfolioValue: number;
  cash: number;
  entered: EnteredTrade[];
  exited: ExitedTrade[];
  skipped: SkippedTrade[];
  message: string;
  errors: string[];
  durationMs: number;
  marketOpen: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN AGENT LOOP
// ─────────────────────────────────────────────────────────────────────────────

export async function runPaperTradingAgent(): Promise<AgentRunResult> {
  const startTime = Date.now();
  const entered:  EnteredTrade[]  = [];
  const exited:   ExitedTrade[]   = [];
  const skipped:  SkippedTrade[]  = [];
  const errors:   string[]        = [];

  // ── Step 1: Schwab auth ──────────────────────────────────────────────────
  const tokenResult = await getSchwabAccessToken('stock');
  if (!tokenResult.token) {
    const errMsg = `Auth failed: ${tokenResult.error}`;
    errors.push(errMsg);
    const portfolio = await loadPortfolio();
    const logEntry: AgentLogEntry = {
      runAt: new Date().toISOString(),
      durationMs: Date.now() - startTime,
      marketOpen: isMarketOpen(),
      portfolioValue: portfolio.totalValue,
      cash: portfolio.cash,
      drawdownPct: 0,
      entered, exited, skipped, errors,
      message: errMsg,
    };
    await appendLog(logEntry);
    return {
      portfolioValue: portfolio.totalValue,
      cash: portfolio.cash,
      entered, exited, skipped, errors,
      message: errMsg,
      durationMs: logEntry.durationMs,
      marketOpen: logEntry.marketOpen,
    };
  }
  const token = tokenResult.token;

  // ── Step 2: Load state ──────────────────────────────────────────────────
  const [portfolio, positions] = await Promise.all([loadPortfolio(), loadPositions()]);
  const marketOpen = isMarketOpen();

  // ── Step 3: Live quotes for open positions ───────────────────────────────
  const openPositions = positions.filter(p => p.status === 'OPEN');
  let quotesMap: Record<string, any> = {};
  if (openPositions.length > 0) {
    const tickers = [...new Set(openPositions.map(p => p.ticker))].join(',');
    const qRes = await schwabFetchJson<Record<string, any>>(
      token,
      `https://api.schwabapi.com/marketdata/v1/quotes?symbols=${encodeURIComponent(tickers)}&fields=quote`,
      { scope: 'stock' }
    );
    if (qRes.ok) quotesMap = qRes.data;
    else errors.push(`Quote fetch: ${qRes.error}`);
  }

  // ── Step 4: Mark-to-market ───────────────────────────────────────────────
  for (const pos of openPositions) {
    const entry = quotesMap[pos.ticker];
    const liveUnderlying = entry?.quote?.lastPrice ?? entry?.quote?.mark ?? 0;

    if (pos.positionType === 'STOCK' && liveUnderlying > 0) {
      pos.currentPrice = liveUnderlying;
      pos.currentValue = pos.quantity * liveUnderlying;
      pos.peakPriceSinceEntry = Math.max(pos.peakPriceSinceEntry ?? pos.entryPrice, liveUnderlying);
    } else if (pos.positionType === 'OPTIONS' && liveUnderlying > 0) {
      // Delta-linear approximation
      const delta = pos.entryDelta ?? 0.40;
      const underlyingMove = liveUnderlying - pos.entryUnderlyingPrice;
      const approxPrice = Math.max(0.01, pos.entryPrice + underlyingMove * delta);
      pos.currentPrice = approxPrice;
      pos.currentValue = approxPrice * 100 * pos.quantity;
      pos.peakPriceSinceEntry = Math.max(pos.peakPriceSinceEntry ?? pos.entryPrice, approxPrice);
    }

    if (pos.totalCost > 0) {
      pos.unrealizedPnl    = pos.currentValue - pos.totalCost;
      pos.unrealizedPnlPct = pos.unrealizedPnl / pos.totalCost;
    }
  }

  // ── Step 5: Update portfolio value + peak ────────────────────────────────
  const openValue = openPositions.reduce((s, p) => s + (p.currentValue ?? 0), 0);
  portfolio.totalValue = portfolio.cash + openValue;
  portfolio.peakValue  = Math.max(portfolio.peakValue, portfolio.totalValue);

  const drawdownFrac = portfolio.peakValue > 0
    ? (portfolio.totalValue - portfolio.peakValue) / portfolio.peakValue
    : 0;

  // ── Step 6: Process exits ────────────────────────────────────────────────
  for (const pos of openPositions) {
    let exitReason: ExitReason | null = null;

    if (pos.positionType === 'OPTIONS') {
      const pnlPct    = pos.unrealizedPnlPct ?? 0;
      const currentDTE = pos.expiration ? dteDaysLeft(pos.expiration) : 999;
      if (pnlPct >= OPTIONS_TAKE_PROFIT_PCT) exitReason = 'TARGET_HIT';
      else if (pnlPct <= OPTIONS_STOP_LOSS_PCT) exitReason = 'STOP_HIT';
      else if (currentDTE <= OPTIONS_DTE_EXIT) exitReason = 'DTE_STOP';
    } else {
      const pnlPct   = pos.unrealizedPnlPct ?? 0;
      const peak     = pos.peakPriceSinceEntry ?? pos.entryPrice;
      const trailing = peak * (1 - STOCK_TRAILING_PCT);
      const daysHeld = daysBetween(pos.entryDate, new Date().toISOString());
      if (pnlPct >= STOCK_TARGET_PCT) exitReason = 'TARGET_HIT';
      else if (pos.currentPrice <= trailing) exitReason = 'STOP_HIT';
      else if (daysHeld >= STOCK_TIME_STOP_DAYS && pnlPct < STOCK_TIME_STOP_MIN) exitReason = 'TIME_STOP';
    }

    if (!exitReason) continue;

    const exitSlipped = pos.positionType === 'OPTIONS'
      ? pos.currentPrice * EXIT_SLIP_OPTIONS
      : pos.currentPrice * (1 - SLIP_STOCK);

    const exitGross = pos.positionType === 'OPTIONS'
      ? exitSlipped * 100 * pos.quantity
      : exitSlipped * pos.quantity;

    const exitCommission = pos.positionType === 'OPTIONS' ? pos.quantity * COMMISSION_OPTION : 0;
    const proceeds       = exitGross - exitCommission;
    const realizedPnl    = proceeds - pos.totalCost;
    const realizedPnlPct = realizedPnl / pos.totalCost;

    pos.status       = 'CLOSED';
    pos.exitDate     = new Date().toISOString();
    pos.exitPrice    = exitSlipped;
    pos.realizedPnl  = realizedPnl;
    pos.realizedPnlPct = realizedPnlPct;
    pos.exitReason   = exitReason;
    portfolio.cash  += proceeds;

    exited.push({ ticker: pos.ticker, direction: pos.direction, exitReason, realizedPnl, realizedPnlPct });
  }

  // Recompute portfolio after exits
  const remainingOpenValue = positions
    .filter(p => p.status === 'OPEN')
    .reduce((s, p) => s + (p.currentValue ?? 0), 0);
  portfolio.totalValue = portfolio.cash + remainingOpenValue;
  portfolio.peakValue  = Math.max(portfolio.peakValue, portfolio.totalValue);
  portfolio.lastUpdated = new Date().toISOString();

  // ── Step 7: Market closed — save & return ────────────────────────────────
  if (!marketOpen) {
    await savePositions(positions);
    await savePortfolio(portfolio);
    await appendEquitySnapshot(portfolio.totalValue);

    const durationMs = Date.now() - startTime;
    const message = `Market closed — mark-to-market only. Exited ${exited.length}.`;
    await appendLog({
      runAt: new Date().toISOString(), durationMs, marketOpen: false,
      portfolioValue: portfolio.totalValue, cash: portfolio.cash,
      drawdownPct: drawdownFrac * 100,
      entered, exited, skipped, errors, message,
    });
    return { portfolioValue: portfolio.totalValue, cash: portfolio.cash, entered, exited, skipped, message, errors, durationMs, marketOpen: false };
  }

  // ── Step 8: Drawdown halt check ──────────────────────────────────────────
  const haltEntries  = drawdownFrac <= -0.20;
  const reduceSize   = drawdownFrac <= -0.12;

  if (haltEntries) {
    skipped.push({ ticker: 'ALL', reason: `Drawdown ${(drawdownFrac * 100).toFixed(1)}% ≥ 20% — halting all new entries` });
  }

  // ── Step 9: Market regime ────────────────────────────────────────────────
  let regime: 'BULLISH' | 'BEARISH' | 'HIGH_VOL' | 'NEUTRAL' = 'NEUTRAL';
  if (!haltEntries) {
    try {
      const regimeRes = await schwabFetchJson<Record<string, any>>(
        token,
        'https://api.schwabapi.com/marketdata/v1/quotes?symbols=SPY,%24VIX.X&fields=quote',
        { scope: 'stock' }
      );
      if (regimeRes.ok) {
        const vixPrice  = regimeRes.data['$VIX.X']?.quote?.lastPrice ?? regimeRes.data['$VIX.X']?.quote?.mark ?? 15;
        const spyChangePct = regimeRes.data['SPY']?.quote?.netPercentChangeInDouble ?? 0;
        if (vixPrice > 30)      regime = 'HIGH_VOL';
        else if (spyChangePct >=  1) regime = 'BULLISH';
        else if (spyChangePct <= -1) regime = 'BEARISH';
      }
    } catch (err: any) {
      errors.push(`Regime fetch: ${String(err).slice(0, 80)}`);
    }
  }

  // ── Step 10: Current position counts ────────────────────────────────────
  const currentOpen = positions.filter(p => p.status === 'OPEN');
  const optionCount = currentOpen.filter(p => p.positionType === 'OPTIONS').length;
  const stockCount  = currentOpen.filter(p => p.positionType === 'STOCK').length;

  // ── Step 11: Scan options (rotate 3 of 10 per run, 7s timeout each) ─────
  const optionSignals: { ticker: string; contract: any; uoa: any; underlyingPrice: number }[] = [];

  if (!haltEntries && optionCount < MAX_OPTIONS_POSITIONS) {
    // Rotate through 3-ticker batches: slots 0-2 cover all 10 tickers over ~3 min
    const runSlot = Math.floor(Date.now() / 60_000) % 4;
    const batchStart = (runSlot * 3) % OPTIONS_WATCHLIST.length;
    const batch = [
      OPTIONS_WATCHLIST[batchStart % OPTIONS_WATCHLIST.length],
      OPTIONS_WATCHLIST[(batchStart + 1) % OPTIONS_WATCHLIST.length],
      OPTIONS_WATCHLIST[(batchStart + 2) % OPTIONS_WATCHLIST.length],
    ];

    await Promise.allSettled(batch.map(async (ticker) => {
      // Skip if already holding this ticker
      if (currentOpen.some(p => p.ticker === ticker)) return;

      try {
        // 7s hard timeout per chain fetch — keeps total options scan under 10s
        const chainFetch = schwabFetchJson<any>(
          token,
          `https://api.schwabapi.com/marketdata/v1/chains?symbol=${ticker}&contractType=ALL&strikeCount=10&includeUnderlyingQuote=true&range=OTM`,
          { scope: 'options' }
        );
        const timeout = new Promise<null>(resolve => setTimeout(() => resolve(null), 7000));
        const chainRes = await Promise.race([chainFetch, timeout]);
        if (!chainRes || !chainRes.ok) return;

        const { contracts, underlyingPrice } = parseChainForUOA(chainRes.data);
        if (underlyingPrice === 0 || contracts.length === 0) return;

        // Direction filter: calls in BULLISH/NEUTRAL/HIGH_VOL, puts in BEARISH
        const allowCalls = regime !== 'BEARISH';
        const allowPuts  = regime === 'BEARISH' || regime === 'HIGH_VOL';

        const filtered = contracts.filter(c => {
          const isCall = (c.putCall ?? '').toUpperCase().startsWith('C');
          if (isCall && !allowCalls) return false;
          if (!isCall && !allowPuts)  return false;
          const dte      = c.daysToExpiration ?? 0;
          const absDelta = Math.abs(c.delta ?? 0);
          const bid      = c.bid ?? 0;
          const ask      = c.ask ?? 0;
          if (dte < 30 || dte > 60) return false;
          if (absDelta < 0.35 || absDelta > 0.55) return false;
          if (bid <= 0 || ask <= 0) return false;
          const mid    = (bid + ask) / 2;
          const spread = (ask - bid) / mid;
          if (spread > 0.15) return false;
          return true;
        });

        const activities = detectUnusualActivity(
          filtered,
          underlyingPrice,
          { minUOAScore: 65 },
          { symbol: ticker }
        );
        if (activities.length === 0) return;

        const best     = activities[0];
        const contract = filtered.find(c => c.optionSymbol === best.optionSymbol) ?? filtered[0];
        optionSignals.push({ ticker, contract, uoa: best, underlyingPrice });
      } catch (err: any) {
        errors.push(`Options scan ${ticker}: ${String(err).slice(0, 60)}`);
      }
    }));
  }

  // ── Step 12: Scan stocks ─────────────────────────────────────────────────
  const stockSignals: { ticker: string; price: number; volRatio: number; heat: number }[] = [];

  if (!haltEntries && stockCount < MAX_STOCK_POSITIONS && regime !== 'BEARISH') {
    const watchable = STOCK_WATCHLIST.filter(t => !currentOpen.some(p => p.ticker === t));
    if (watchable.length > 0) {
      try {
        const sRes = await schwabFetchJson<Record<string, any>>(
          token,
          `https://api.schwabapi.com/marketdata/v1/quotes?symbols=${encodeURIComponent(watchable.join(','))}&fields=quote,fundamental`,
          { scope: 'stock' }
        );
        if (sRes.ok) {
          for (const [t, data] of Object.entries(sRes.data)) {
            const q          = (data as any).quote ?? {};
            const f          = (data as any).fundamental ?? {};
            const price      = q.lastPrice ?? q.mark ?? 0;
            const changePct  = q.netPercentChangeInDouble ?? 0;
            const volume     = q.totalVolume ?? 0;
            const avgVol10d  = f.avg10DaysVolume ?? 0;
            const volRatio   = avgVol10d > 0 ? volume / avgVol10d : 0;
            const momentumScore = Math.min(60, Math.abs(changePct) * 12);
            const volumeScore   = avgVol10d > 0 ? Math.min(40, Math.max(0, (volRatio - 1) * 20)) : 0;
            const heat       = Math.round(momentumScore + volumeScore);
            const direction  = changePct >= 0.5 ? 'UP' : changePct <= -0.5 ? 'DOWN' : 'FLAT';

            if (heat >= 60 && volRatio >= 1.5 && direction === 'UP' && price > 0) {
              stockSignals.push({ ticker: t, price, volRatio, heat });
            } else {
              skipped.push({ ticker: t, reason: `Stock screen: heat=${heat} vol=${volRatio.toFixed(1)}× dir=${direction}` });
            }
          }
        }
      } catch (err: any) {
        errors.push(`Stock scan: ${String(err).slice(0, 80)}`);
      }
    }
  }

  // ── Step 13: Enter positions ─────────────────────────────────────────────
  if (!haltEntries) {
    optionSignals.sort((a, b) => b.uoa.uoaScore - a.uoa.uoaScore);
    stockSignals.sort((a, b) => b.heat - a.heat);

    // Track sector exposure including current open positions
    const sectorExposure: Record<string, number> = {};
    for (const pos of positions.filter(p => p.status === 'OPEN')) {
      sectorExposure[pos.sector] = (sectorExposure[pos.sector] ?? 0) + pos.currentValue;
    }

    /** Sync entry function — mutates positions + portfolio in place */
    function tryEnter(
      ticker: string,
      positionType: 'OPTIONS' | 'STOCK',
      direction: PositionDirection,
      entryPrice: number,
      underlyingPrice: number,
      quantity: number,
      optDetails: any | null,
      signal: PaperPosition['signal'],
    ): void {
      const sector    = SECTOR_MAP[ticker] ?? 'Other';
      const entryGross = positionType === 'OPTIONS'
        ? entryPrice * 100 * quantity
        : entryPrice * quantity;
      const commission  = positionType === 'OPTIONS' ? quantity * COMMISSION_OPTION : 0;
      const totalCost   = entryGross + commission;
      const cashFloor   = portfolio.totalValue * CASH_FLOOR_PCT;

      if (portfolio.cash - totalCost < cashFloor) {
        skipped.push({ ticker, reason: `Cash floor: need $${cashFloor.toFixed(0)}, have $${portfolio.cash.toFixed(0)}` });
        return;
      }

      const sectorCurrent = sectorExposure[sector] ?? 0;
      const sectorPct     = portfolio.totalValue > 0 ? (sectorCurrent + totalCost) / portfolio.totalValue : 0;
      if (sectorPct > MAX_SECTOR_PCT) {
        skipped.push({ ticker, reason: `Sector ${sector} at ${(sectorPct * 100).toFixed(0)}% — exceeds 30%` });
        return;
      }

      if (positions.filter(p => p.status === 'OPEN').length >= MAX_TOTAL_POSITIONS) {
        skipped.push({ ticker, reason: `Max ${MAX_TOTAL_POSITIONS} total positions reached` });
        return;
      }

      const now        = new Date().toISOString();
      const targetPrice = positionType === 'OPTIONS'
        ? entryPrice * (1 + OPTIONS_TAKE_PROFIT_PCT)
        : entryPrice * (1 + STOCK_TARGET_PCT);
      const stopPrice  = positionType === 'OPTIONS'
        ? entryPrice * (1 + OPTIONS_STOP_LOSS_PCT)
        : entryPrice * (1 - STOCK_TRAILING_PCT);

      const newPos: PaperPosition = {
        id:                 nanoid(),
        ticker,
        positionType,
        direction,
        status:             'OPEN',
        entryDate:          now,
        entryPrice,
        entryUnderlyingPrice: underlyingPrice,
        quantity,
        totalCost,
        commission,
        currentPrice:       entryPrice,
        currentValue:       positionType === 'OPTIONS' ? entryPrice * 100 * quantity : entryPrice * quantity,
        unrealizedPnl:      0,
        unrealizedPnlPct:   0,
        peakPriceSinceEntry: entryPrice,
        targetPrice,
        stopPrice,
        ...(optDetails ? {
          optionSymbol: optDetails.symbol ?? optDetails.optionSymbol,
          optionType:   direction === 'LONG_CALL' ? 'CALL' : 'PUT',
          strike:       optDetails.strikePrice ?? optDetails.strike,
          expiration:   optDetails.expirationDate ?? optDetails.expiration,
          entryDTE:     optDetails.daysToExpiration,
          entryDelta:   Math.abs(optDetails.delta ?? 0.40),
        } : {}),
        signal,
        sector,
      };

      positions.push(newPos);
      portfolio.cash -= totalCost;
      sectorExposure[sector] = (sectorExposure[sector] ?? 0) + newPos.currentValue;
      entered.push({ ticker, direction, cost: totalCost, reasoning: signal.reasoning });
    }

    // Enter option signals
    for (const sig of optionSignals) {
      const currentOptionsOpen = positions.filter(p => p.status === 'OPEN' && p.positionType === 'OPTIONS').length;
      if (currentOptionsOpen >= MAX_OPTIONS_POSITIONS) break;
      if (positions.filter(p => p.status === 'OPEN').length >= MAX_TOTAL_POSITIONS) break;

      const c   = sig.contract;
      const bid = c?.bid ?? 0;
      const ask = c?.ask ?? 0;
      const mid = (bid + ask) / 2;
      if (mid <= 0) {
        skipped.push({ ticker: sig.ticker, reason: 'Zero mid-price' });
        continue;
      }

      // IV rank check — skip if overpaying for vol
      const atm_iv = c?.volatility ?? c?.impliedVolatility ?? 0;
      const ivRank = atm_iv > 0 ? await estimateIVRank(sig.ticker, atm_iv) : 0;
      if (ivRank > 0.60) {
        skipped.push({ ticker: sig.ticker, reason: `IV rank ${(ivRank * 100).toFixed(0)}% > 60 — overpaying for vol` });
        continue;
      }

      const entryPrice = mid * ENTRY_SLIP_OPTIONS;
      const direction: 'LONG_CALL' | 'LONG_PUT' = sig.uoa.type === 'CALL' ? 'LONG_CALL' : 'LONG_PUT';
      const rawContracts = sizeOptionContracts(portfolio.totalValue, entryPrice);
      const contracts    = Math.max(1, Math.floor(rawContracts * (reduceSize ? 0.5 : 1)));

      const reasoning = [
        `${direction === 'LONG_CALL' ? 'Call' : 'Put'} sweep on ${sig.ticker}`,
        `UOA ${sig.uoa.uoaScore}/100 (${sig.uoa.tier}) — ${sig.uoa.alertType?.replace('_', ' ')}`,
        `Strike $${c?.strikePrice ?? '?'} exp ${c?.expirationDate?.slice(0, 10) ?? '?'} DTE=${c?.daysToExpiration ?? '?'} δ${(c?.delta ?? 0).toFixed(2)}`,
        `Entry mid+1.5% = $${entryPrice.toFixed(2)} × ${contracts} contracts = $${(entryPrice * 100 * contracts).toFixed(0)}`,
        sig.uoa.reasoning?.[0] ?? '',
        `Regime: ${regime}`,
      ].filter(Boolean).join(' | ');

      tryEnter(sig.ticker, 'OPTIONS', direction, entryPrice, sig.underlyingPrice, contracts, c, {
        source: 'UOA', uoaScore: sig.uoa.uoaScore, uoaTier: sig.uoa.tier,
        alertType: sig.uoa.alertType, reasoning,
      });
    }

    // Enter stock signals
    for (const sig of stockSignals) {
      const currentStocksOpen = positions.filter(p => p.status === 'OPEN' && p.positionType === 'STOCK').length;
      if (currentStocksOpen >= MAX_STOCK_POSITIONS) break;
      if (positions.filter(p => p.status === 'OPEN').length >= MAX_TOTAL_POSITIONS) break;

      const entryPrice = sig.price * (1 + SLIP_STOCK);
      const rawShares  = sizeStockShares(portfolio.totalValue, entryPrice);
      const shares     = Math.max(1, Math.floor(rawShares * (reduceSize ? 0.5 : 1)));

      const reasoning = [
        `Momentum breakout: ${sig.ticker}`,
        `Heat ${sig.heat}/100 · Volume ${sig.volRatio.toFixed(1)}× above 10-day avg`,
        `Entry $${entryPrice.toFixed(2)} × ${shares} shares = $${(entryPrice * shares).toFixed(0)}`,
        `Target +10% ($${(entryPrice * 1.10).toFixed(2)}) · Trailing stop 7% from peak`,
        `Regime: ${regime}`,
      ].join(' | ');

      tryEnter(sig.ticker, 'STOCK', 'LONG_STOCK', entryPrice, sig.price, shares, null, {
        source: 'STOCK_HEAT', reasoning,
      });
    }
  }

  // ── Step 14: Persist + log ───────────────────────────────────────────────
  portfolio.totalValue = portfolio.cash + positions
    .filter(p => p.status === 'OPEN')
    .reduce((s, p) => s + (p.currentValue ?? 0), 0);
  portfolio.peakValue    = Math.max(portfolio.peakValue, portfolio.totalValue);
  portfolio.lastUpdated  = new Date().toISOString();

  await savePositions(positions);
  await savePortfolio(portfolio);
  await appendEquitySnapshot(portfolio.totalValue);

  const durationMs = Date.now() - startTime;
  const message = [
    `Entered ${entered.length} · Exited ${exited.length} · Skipped ${skipped.length}`,
    `Value $${portfolio.totalValue.toFixed(0)} · Cash $${portfolio.cash.toFixed(0)}`,
    `Regime: ${regime} · Drawdown: ${(drawdownFrac * 100).toFixed(1)}%`,
  ].join(' | ');

  const logEntry: AgentLogEntry = {
    runAt: new Date().toISOString(), durationMs, marketOpen,
    portfolioValue: portfolio.totalValue, cash: portfolio.cash,
    drawdownPct: drawdownFrac * 100,
    entered, exited, skipped, errors, message,
  };
  await appendLog(logEntry);

  return { portfolioValue: portfolio.totalValue, cash: portfolio.cash, entered, exited, skipped, message, errors, durationMs, marketOpen };
}
