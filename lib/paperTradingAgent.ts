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
  TradeMemory,
  loadPortfolio,
  savePortfolio,
  loadPositions,
  savePositions,
  appendLog,
  appendEquitySnapshot,
  loadTradeMemory,
  appendTradeMemory,
} from './paperTradingStore';
import {
  claudeAssessPortfolio,
  claudeEvaluateTrade,
  claudeEvaluateExit,
  PortfolioAssessment,
  computeStats,
} from './paperTradingAI';

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

// Hard safety floors — Claude cannot override these
const HARD_MAX_POSITION_PCT = 0.20;  // single position ≤ 20% of portfolio
const HARD_STOP_FLOOR_PCT   = -0.60; // stop no worse than -60%
const HARD_MIN_CASH_PCT     = 0.10;  // never below 10% cash (red line)
const HARD_MAX_POSITIONS    = 12;    // absolute ceiling

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

  // Declare regime vars early — Step 9 fetches real values; Step 6 fallback uses defaults
  let regime: 'BULLISH' | 'BEARISH' | 'HIGH_VOL' | 'NEUTRAL' = 'NEUTRAL';
  let spyChangePct = 0;
  let vixLevel = 20;

  // ── Step 6: Process exits ────────────────────────────────────────────────
  // 6a: Hard stop / target / DTE checks (rule-based, synchronous)
  const dangerZonePositions: PaperPosition[] = [];
  for (const pos of openPositions) {
    let exitReason: ExitReason | null = null;

    if (pos.positionType === 'OPTIONS') {
      const pnlPct    = pos.unrealizedPnlPct ?? 0;
      const currentDTE = pos.expiration ? dteDaysLeft(pos.expiration) : 999;
      if (pnlPct >= OPTIONS_TAKE_PROFIT_PCT) exitReason = 'TARGET_HIT';
      else if (pnlPct <= OPTIONS_STOP_LOSS_PCT) exitReason = 'STOP_HIT';
      else if (currentDTE <= OPTIONS_DTE_EXIT) exitReason = 'DTE_STOP';
      // Danger zone: -15% to -33%
      else if (pnlPct <= -0.15) dangerZonePositions.push(pos);
    } else {
      const pnlPct   = pos.unrealizedPnlPct ?? 0;
      const peak     = pos.peakPriceSinceEntry ?? pos.entryPrice;
      const trailing = peak * (1 - STOCK_TRAILING_PCT);
      const daysHeld = daysBetween(pos.entryDate, new Date().toISOString());
      if (pnlPct >= STOCK_TARGET_PCT) exitReason = 'TARGET_HIT';
      else if (pos.currentPrice <= trailing) exitReason = 'STOP_HIT';
      else if (daysHeld >= STOCK_TIME_STOP_DAYS && pnlPct < STOCK_TIME_STOP_MIN) exitReason = 'TIME_STOP';
      // Danger zone: -15% to -33%
      else if (pnlPct <= -0.15) dangerZonePositions.push(pos);
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
    const daysHeldExit   = daysBetween(pos.entryDate, new Date().toISOString());

    pos.status       = 'CLOSED';
    pos.exitDate     = new Date().toISOString();
    pos.exitPrice    = exitSlipped;
    pos.realizedPnl  = realizedPnl;
    pos.realizedPnlPct = realizedPnlPct;
    pos.exitReason   = exitReason;
    portfolio.cash  += proceeds;

    exited.push({ ticker: pos.ticker, direction: pos.direction, exitReason, realizedPnl, realizedPnlPct });

    // Append to trade memory (fire-and-forget)
    appendTradeMemory({
      tradeId: pos.id,
      ticker: pos.ticker,
      direction: pos.direction,
      positionType: pos.positionType,
      entrySignal: {
        uoaScore: pos.signal.uoaScore ?? 0,
        alertType: pos.signal.alertType ?? 'UNKNOWN',
        regime,
        ivRank: 0,
      },
      claudeEntry: {
        conviction: pos.signal.claudeConviction ?? 0,
        riskMultiplier: pos.signal.claudeRiskMultiplier ?? 1,
        reasoning: pos.signal.reasoning,
      },
      outcome: {
        realizedPnlPct,
        exitReason,
        daysHeld: daysHeldExit,
        won: realizedPnlPct > 0,
      },
      closedAt: new Date().toISOString(),
    }).catch(() => { /* non-fatal */ });
  }

  // (6b Claude danger-zone exits run after Step 9.6 where regime + tradeMemory are available)

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
  if (!haltEntries) {
    try {
      const regimeRes = await schwabFetchJson<Record<string, any>>(
        token,
        'https://api.schwabapi.com/marketdata/v1/quotes?symbols=SPY,%24VIX.X&fields=quote',
        { scope: 'stock' }
      );
      if (regimeRes.ok) {
        vixLevel     = regimeRes.data['$VIX.X']?.quote?.lastPrice ?? regimeRes.data['$VIX.X']?.quote?.mark ?? 20;
        spyChangePct = regimeRes.data['SPY']?.quote?.netPercentChangeInDouble ?? 0;
        if (vixLevel > 30)       regime = 'HIGH_VOL';
        else if (spyChangePct >=  1) regime = 'BULLISH';
        else if (spyChangePct <= -1) regime = 'BEARISH';
      } else {
        errors.push(`Regime fetch failed: Schwab ${regimeRes.status} — ${String(regimeRes.error ?? '').slice(0, 80)}`);
      }
    } catch (err: any) {
      errors.push(`Regime fetch: ${String(err).slice(0, 80)}`);
    }
  }

  // ── Step 9.5: Load trade memory + compute stats ──────────────────────────
  const tradeMemory = await loadTradeMemory();
  const { winRate, profitFactor } = computeStats(tradeMemory);

  // ── Step 9.6: Claude portfolio assessment ───────────────────────────────
  const DEFAULT_ASSESSMENT: PortfolioAssessment = {
    maxPositions: 8, cashFloorPct: 0.25, riskBiasPct: 0.02,
    regimeTake: 'NORMAL', avoidSectors: [], reasoning: 'rule-based fallback',
  };
  const assessment = (!haltEntries
    ? await claudeAssessPortfolio({
        portfolioValue: portfolio.totalValue,
        cash: portfolio.cash,
        drawdownPct: drawdownFrac * 100,
        openPositions: positions
          .filter(p => p.status === 'OPEN')
          .map(p => ({ ticker: p.ticker, positionType: p.positionType, unrealizedPnlPct: p.unrealizedPnlPct, sector: p.sector })),
        regime,
        spyChangePct,
        vixLevel,
        tradeMemory,
        winRate,
        profitFactor,
      })
    : null) ?? DEFAULT_ASSESSMENT;

  const runMaxPositions = Math.min(HARD_MAX_POSITIONS, Math.max(4, assessment.maxPositions));
  const runCashFloor    = Math.min(0.35, Math.max(HARD_MIN_CASH_PCT, assessment.cashFloorPct));
  const runRiskBase     = Math.min(0.05, Math.max(0.01, assessment.riskBiasPct));
  const runAvoidSectors = new Set(assessment.avoidSectors);

  // ── Step 9.7: Claude danger-zone exit evaluation ─────────────────────────
  if (dangerZonePositions.length > 0) {
    const exitDecisions = await Promise.allSettled(
      dangerZonePositions.map(pos => claudeEvaluateExit({
        ticker: pos.ticker,
        direction: pos.direction,
        positionType: pos.positionType,
        unrealizedPnlPct: pos.unrealizedPnlPct ?? 0,
        daysHeld: daysBetween(pos.entryDate, new Date().toISOString()),
        entryPrice: pos.entryPrice,
        currentPrice: pos.currentPrice,
        stopPrice: pos.stopPrice,
        targetPrice: pos.targetPrice,
        regime,
        vixLevel,
        tickerMemory: tradeMemory.filter(m => m.ticker === pos.ticker).slice(0, 5),
      }))
    );

    for (let i = 0; i < dangerZonePositions.length; i++) {
      const pos = dangerZonePositions[i];
      if (pos.status === 'CLOSED') continue;

      const decisionResult = exitDecisions[i];
      const decision = decisionResult.status === 'fulfilled' ? decisionResult.value : null;
      if (!decision) continue;

      if (decision.action === 'EXIT') {
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
        const daysHeldExit   = daysBetween(pos.entryDate, new Date().toISOString());
        const exitReason: ExitReason = 'AI_EXIT';

        pos.status         = 'CLOSED';
        pos.exitDate       = new Date().toISOString();
        pos.exitPrice      = exitSlipped;
        pos.realizedPnl    = realizedPnl;
        pos.realizedPnlPct = realizedPnlPct;
        pos.exitReason     = exitReason;
        portfolio.cash    += proceeds;

        exited.push({ ticker: pos.ticker, direction: pos.direction, exitReason, realizedPnl, realizedPnlPct });

        appendTradeMemory({
          tradeId: pos.id,
          ticker: pos.ticker,
          direction: pos.direction,
          positionType: pos.positionType,
          entrySignal: {
            uoaScore: pos.signal.uoaScore ?? 0,
            alertType: pos.signal.alertType ?? 'UNKNOWN',
            regime,
            ivRank: 0,
          },
          claudeEntry: {
            conviction: pos.signal.claudeConviction ?? 0,
            riskMultiplier: pos.signal.claudeRiskMultiplier ?? 1,
            reasoning: pos.signal.reasoning,
          },
          outcome: { realizedPnlPct, exitReason, daysHeld: daysHeldExit, won: realizedPnlPct > 0 },
          closedAt: new Date().toISOString(),
        }).catch(() => { /* non-fatal */ });

      } else if (decision.action === 'TIGHTEN_STOP' && decision.newStopPct !== undefined) {
        // Only tighten — never loosen; apply hard floor
        const rawNewStop = pos.entryPrice * (1 + Math.max(HARD_STOP_FLOOR_PCT, decision.newStopPct));
        if (rawNewStop > pos.stopPrice) {
          pos.stopPrice = rawNewStop;
        }
      }
      // HOLD: no change
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

    skipped.push({ ticker: 'OPTIONS_SCAN', reason: `Scanning batch: ${batch.join(', ')} (slot ${runSlot}, regime ${regime})` });

    await Promise.allSettled(batch.map(async (ticker) => {
      // Skip if already holding this ticker
      if (currentOpen.some(p => p.ticker === ticker)) {
        skipped.push({ ticker, reason: 'Options: already holding this ticker' });
        return;
      }

      try {
        // 7s hard timeout per chain fetch — keeps total options scan under 10s
        // range=ALL matches the working options route (omitting range causes Schwab 401)
        const chainFetch = schwabFetchJson<any>(
          token,
          `https://api.schwabapi.com/marketdata/v1/chains?symbol=${ticker}&contractType=ALL&strikeCount=20&includeUnderlyingQuote=true&range=ALL`,
          { scope: 'options' }
        );
        const timeoutP = new Promise<null>(resolve => setTimeout(() => resolve(null), 7000));
        const chainRes = await Promise.race([chainFetch, timeoutP]);

        if (!chainRes) {
          skipped.push({ ticker, reason: 'Options: chain fetch timed out (>7s)' });
          return;
        }
        if (!chainRes.ok) {
          const rawText = String((chainRes as any).text ?? '').slice(0, 120);
          skipped.push({ ticker, reason: `Options: Schwab API ${(chainRes as any).status ?? '?'} — ${String((chainRes as any).error ?? '').slice(0, 60)} | ${rawText}` });
          return;
        }

        const { contracts, underlyingPrice } = parseChainForUOA(chainRes.data);
        if (underlyingPrice === 0 || contracts.length === 0) {
          skipped.push({ ticker, reason: `Options: empty chain response (${contracts.length} contracts, underlying=$${underlyingPrice})` });
          return;
        }

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
          if (dte < 20 || dte > 90) return false;
          if (absDelta < 0.25 || absDelta > 0.75) return false;
          if (bid <= 0 || ask <= 0) return false;
          const mid    = (bid + ask) / 2;
          const spread = (ask - bid) / mid;
          if (spread > 0.15) return false;
          return true;
        });

        const activities = detectUnusualActivity(
          filtered,
          underlyingPrice,
          { minUOAScore: 55 }, // detect at 55, log below 65 as low-conviction
          { symbol: ticker }
        );
        if (activities.length === 0) {
          skipped.push({ ticker, reason: `Options: ${contracts.length} contracts parsed, ${filtered.length} passed filters — no UOA signals detected` });
          return;
        }

        const best = activities[0];
        if (best.uoaScore < 65) {
          skipped.push({ ticker, reason: `Options: best UOA ${best.uoaScore}/100 (${best.tier}) — below 65 threshold. ${best.type} $${best.strike} exp ${best.expiration?.slice(0,10)} δ${best.delta.toFixed(2)}` });
          return;
        }

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
      targetPct?: number,
      stopPct?: number,
    ): void {
      const sector    = SECTOR_MAP[ticker] ?? 'Other';

      if (runAvoidSectors.has(sector)) {
        skipped.push({ ticker, reason: `Claude: avoid sector ${sector}` });
        return;
      }

      const entryGross = positionType === 'OPTIONS'
        ? entryPrice * 100 * quantity
        : entryPrice * quantity;
      const commission  = positionType === 'OPTIONS' ? quantity * COMMISSION_OPTION : 0;
      const totalCost   = entryGross + commission;

      // Hard ceiling: single position ≤ 20% of portfolio
      if (totalCost > portfolio.totalValue * HARD_MAX_POSITION_PCT) {
        skipped.push({ ticker, reason: `Position size $${totalCost.toFixed(0)} exceeds 20% hard limit` });
        return;
      }

      const cashFloor   = portfolio.totalValue * runCashFloor;

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

      if (positions.filter(p => p.status === 'OPEN').length >= runMaxPositions) {
        skipped.push({ ticker, reason: `Max ${runMaxPositions} total positions reached` });
        return;
      }

      // Resolve target/stop — use Claude values if provided, else defaults
      const resolvedTargetPct = targetPct ?? (positionType === 'OPTIONS' ? OPTIONS_TAKE_PROFIT_PCT : STOCK_TARGET_PCT);
      const resolvedStopPct   = stopPct   ?? (positionType === 'OPTIONS' ? OPTIONS_STOP_LOSS_PCT   : -STOCK_TRAILING_PCT);
      // Apply hard stop floor
      const clampedStopPct    = Math.max(HARD_STOP_FLOOR_PCT, resolvedStopPct);

      const now         = new Date().toISOString();
      const targetPrice = entryPrice * (1 + resolvedTargetPct);
      const stopPrice   = entryPrice * (1 + clampedStopPct);

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

    // ── Concurrent Claude evaluation for all signals ────────────────────────
    // Pre-compute ivRank for each option signal (needed for prompt)
    const optionIvRanks = await Promise.all(optionSignals.map(async sig => {
      const c = sig.contract;
      const rawIV = c?.volatility ?? c?.impliedVolatility ?? 0;
      const atm_iv = rawIV > 1 ? rawIV / 100 : rawIV;
      return atm_iv > 0 ? await estimateIVRank(sig.ticker, atm_iv) : 0;
    }));

    const claudeOptionDecisions = await Promise.allSettled(
      optionSignals.map((sig, i) => {
        const relevantMemory = tradeMemory.filter(m => m.ticker === sig.ticker).slice(0, 5);
        return claudeEvaluateTrade({
          ticker: sig.ticker,
          signalType: 'OPTIONS',
          direction: sig.uoa.type === 'CALL' ? 'LONG_CALL' : 'LONG_PUT',
          uoaScore: sig.uoa.uoaScore,
          alertType: sig.uoa.alertType ?? 'UNKNOWN',
          strike: sig.contract?.strikePrice,
          dte: sig.contract?.daysToExpiration,
          delta: Math.abs(sig.contract?.delta ?? 0),
          ivRank: optionIvRanks[i],
          regime,
          portfolioValue: portfolio.totalValue,
          cashPct: portfolio.cash / portfolio.totalValue,
          openCount: positions.filter(p => p.status === 'OPEN').length,
          relevantMemory,
        });
      })
    );

    const claudeStockDecisions = await Promise.allSettled(
      stockSignals.map(sig => {
        const relevantMemory = tradeMemory.filter(m => m.ticker === sig.ticker).slice(0, 5);
        return claudeEvaluateTrade({
          ticker: sig.ticker,
          signalType: 'STOCK',
          direction: 'LONG_STOCK',
          uoaScore: 0,
          alertType: 'STOCK_HEAT',
          ivRank: 0,
          regime,
          portfolioValue: portfolio.totalValue,
          cashPct: portfolio.cash / portfolio.totalValue,
          openCount: positions.filter(p => p.status === 'OPEN').length,
          relevantMemory,
        });
      })
    );

    // Enter option signals
    for (let i = 0; i < optionSignals.length; i++) {
      const sig = optionSignals[i];
      const currentOptionsOpen = positions.filter(p => p.status === 'OPEN' && p.positionType === 'OPTIONS').length;
      if (currentOptionsOpen >= MAX_OPTIONS_POSITIONS) break;
      if (positions.filter(p => p.status === 'OPEN').length >= runMaxPositions) break;

      const c   = sig.contract;
      const bid = c?.bid ?? 0;
      const ask = c?.ask ?? 0;
      const mid = (bid + ask) / 2;
      if (mid <= 0) {
        skipped.push({ ticker: sig.ticker, reason: 'Zero mid-price' });
        continue;
      }

      const ivRank = optionIvRanks[i];

      // Extract Claude decision (null = fallback to rules)
      const claudeResult = claudeOptionDecisions[i];
      const claudeDecision = claudeResult.status === 'fulfilled' ? claudeResult.value : null;

      // Claude explicit SKIP
      if (claudeDecision?.action === 'SKIP') {
        skipped.push({ ticker: sig.ticker, reason: `Claude SKIP: ${claudeDecision.reasoning}` });
        continue;
      }

      // Rule-based IV check (fallback or when Claude says ENTER)
      if (!claudeDecision && ivRank > 0.60) {
        skipped.push({ ticker: sig.ticker, reason: `IV rank ${(ivRank * 100).toFixed(0)}% > 60 — overpaying for vol` });
        continue;
      }

      // Apply Claude DTE/delta filters if provided
      const dte      = c?.daysToExpiration ?? 0;
      const absDelta = Math.abs(c?.delta ?? 0);
      if (claudeDecision) {
        if (dte < claudeDecision.dteLow || dte > claudeDecision.dteHigh) {
          skipped.push({ ticker: sig.ticker, reason: `Claude DTE filter: ${dte} not in [${claudeDecision.dteLow}-${claudeDecision.dteHigh}]` });
          continue;
        }
        if (absDelta < claudeDecision.deltaLow || absDelta > claudeDecision.deltaHigh) {
          skipped.push({ ticker: sig.ticker, reason: `Claude delta filter: ${absDelta.toFixed(2)} not in [${claudeDecision.deltaLow}-${claudeDecision.deltaHigh}]` });
          continue;
        }
      }

      const entryPrice = mid * ENTRY_SLIP_OPTIONS;
      const direction: 'LONG_CALL' | 'LONG_PUT' = sig.uoa.type === 'CALL' ? 'LONG_CALL' : 'LONG_PUT';

      // Sizing: apply Claude risk multiplier × base, or default rules
      const riskMult     = claudeDecision ? claudeDecision.riskMultiplier : 1.0;
      const effectiveRisk = runRiskBase * riskMult;
      const rawContracts  = Math.max(1, Math.floor(
        (portfolio.totalValue * Math.min(effectiveRisk, 0.05)) / (entryPrice * 100)
      ));
      const contracts     = Math.max(1, Math.floor(rawContracts * (reduceSize ? 0.5 : 1)));

      const targetPct = claudeDecision?.targetPct ?? OPTIONS_TAKE_PROFIT_PCT;
      const stopPct   = claudeDecision?.stopPct   ?? OPTIONS_STOP_LOSS_PCT;

      const convictionLabel = claudeDecision ? ` | Claude ENTER (conviction ${claudeDecision.conviction}/5 × ${riskMult.toFixed(1)}x)` : '';
      const reasoning = [
        `${direction === 'LONG_CALL' ? 'Call' : 'Put'} sweep on ${sig.ticker}`,
        `UOA ${sig.uoa.uoaScore}/100 (${sig.uoa.tier}) — ${sig.uoa.alertType?.replace('_', ' ')}`,
        `Strike $${c?.strikePrice ?? '?'} exp ${c?.expirationDate?.slice(0, 10) ?? '?'} DTE=${dte} δ${(c?.delta ?? 0).toFixed(2)}`,
        `Entry mid+1.5% = $${entryPrice.toFixed(2)} × ${contracts} contracts = $${(entryPrice * 100 * contracts).toFixed(0)}`,
        sig.uoa.reasoning?.[0] ?? '',
        `Regime: ${regime}${convictionLabel}`,
        claudeDecision?.reasoning ?? '',
      ].filter(Boolean).join(' | ');

      tryEnter(sig.ticker, 'OPTIONS', direction, entryPrice, sig.underlyingPrice, contracts, c, {
        source: 'UOA', uoaScore: sig.uoa.uoaScore, uoaTier: sig.uoa.tier,
        alertType: sig.uoa.alertType, reasoning,
        claudeConviction: claudeDecision?.conviction,
        claudeRiskMultiplier: claudeDecision?.riskMultiplier,
      }, targetPct, stopPct);
    }

    // Enter stock signals
    for (let i = 0; i < stockSignals.length; i++) {
      const sig = stockSignals[i];
      const currentStocksOpen = positions.filter(p => p.status === 'OPEN' && p.positionType === 'STOCK').length;
      if (currentStocksOpen >= MAX_STOCK_POSITIONS) break;
      if (positions.filter(p => p.status === 'OPEN').length >= runMaxPositions) break;

      const claudeResult = claudeStockDecisions[i];
      const claudeDecision = claudeResult.status === 'fulfilled' ? claudeResult.value : null;

      if (claudeDecision?.action === 'SKIP') {
        skipped.push({ ticker: sig.ticker, reason: `Claude SKIP: ${claudeDecision.reasoning}` });
        continue;
      }

      const entryPrice = sig.price * (1 + SLIP_STOCK);
      const riskMult   = claudeDecision ? claudeDecision.riskMultiplier : 1.0;
      const effectiveRisk = runRiskBase * riskMult;
      const riskPerShare  = entryPrice * STOCK_TRAILING_PCT;
      const sharesFromRisk = Math.floor((portfolio.totalValue * Math.min(effectiveRisk, 0.05)) / riskPerShare);
      const sharesFromMax  = Math.floor((portfolio.totalValue * HARD_MAX_POSITION_PCT) / entryPrice);
      const rawShares  = Math.max(1, Math.min(sharesFromRisk, sharesFromMax));
      const shares     = Math.max(1, Math.floor(rawShares * (reduceSize ? 0.5 : 1)));

      const targetPct = claudeDecision?.targetPct ?? STOCK_TARGET_PCT;
      const stopPct   = claudeDecision?.stopPct   ?? -STOCK_TRAILING_PCT;

      const convictionLabel = claudeDecision ? ` | Claude ENTER (conviction ${claudeDecision.conviction}/5 × ${riskMult.toFixed(1)}x)` : '';
      const reasoning = [
        `Momentum breakout: ${sig.ticker}`,
        `Heat ${sig.heat}/100 · Volume ${sig.volRatio.toFixed(1)}× above 10-day avg`,
        `Entry $${entryPrice.toFixed(2)} × ${shares} shares = $${(entryPrice * shares).toFixed(0)}`,
        `Target +${(targetPct * 100).toFixed(0)}% · Stop ${(stopPct * 100).toFixed(0)}% from entry`,
        `Regime: ${regime}${convictionLabel}`,
        claudeDecision?.reasoning ?? '',
      ].filter(Boolean).join(' | ');

      tryEnter(sig.ticker, 'STOCK', 'LONG_STOCK', entryPrice, sig.price, shares, null, {
        source: 'STOCK_HEAT', reasoning,
        claudeConviction: claudeDecision?.conviction,
        claudeRiskMultiplier: claudeDecision?.riskMultiplier,
      }, targetPct, stopPct);
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
