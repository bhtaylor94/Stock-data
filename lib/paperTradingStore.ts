import { getRedis, isRedisAvailable } from './redis';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface PaperPortfolio {
  cash: number;
  startingCapital: number;
  peakValue: number;
  totalValue: number;
  lastUpdated: string;
  createdAt: string;
}

export type PositionType = 'OPTIONS' | 'STOCK';
export type PositionDirection = 'LONG_CALL' | 'LONG_PUT' | 'LONG_STOCK';
export type PositionStatus = 'OPEN' | 'CLOSED';
export type ExitReason = 'TARGET_HIT' | 'STOP_HIT' | 'EXPIRED' | 'DTE_STOP' | 'TIME_STOP';

export interface PaperPosition {
  id: string;
  ticker: string;
  positionType: PositionType;
  direction: PositionDirection;
  status: PositionStatus;

  entryDate: string;
  entryPrice: number;
  entryUnderlyingPrice: number;
  quantity: number;
  totalCost: number;
  commission: number;

  // Options-specific
  optionSymbol?: string;
  optionType?: 'CALL' | 'PUT';
  strike?: number;
  expiration?: string;
  entryDTE?: number;
  entryDelta?: number;

  // Mark-to-market
  currentPrice: number;
  currentValue: number;
  unrealizedPnl: number;
  unrealizedPnlPct: number;
  peakPriceSinceEntry?: number;

  // Levels
  targetPrice: number;
  stopPrice: number;

  // Exit
  exitDate?: string;
  exitPrice?: number;
  realizedPnl?: number;
  realizedPnlPct?: number;
  exitReason?: ExitReason;

  // Signal metadata
  signal: {
    source: 'UOA' | 'STOCK_HEAT';
    uoaScore?: number;
    uoaTier?: string;
    alertType?: string;
    reasoning: string;
  };

  sector: string;
}

export interface EnteredTrade {
  ticker: string;
  direction: PositionDirection;
  cost: number;
  reasoning: string;
}

export interface ExitedTrade {
  ticker: string;
  direction: PositionDirection;
  exitReason: ExitReason;
  realizedPnl: number;
  realizedPnlPct: number;
}

export interface SkippedTrade {
  ticker: string;
  reason: string;
}

export interface AgentLogEntry {
  runAt: string;
  durationMs: number;
  marketOpen: boolean;
  portfolioValue: number;
  cash: number;
  drawdownPct: number;
  entered: EnteredTrade[];
  exited: ExitedTrade[];
  skipped: SkippedTrade[];
  errors: string[];
  message: string;
}

export interface EquitySnapshot {
  date: string; // YYYY-MM-DD
  value: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const STARTING_CAPITAL = 25_000;

const KEYS = {
  portfolio: 'paper:portfolio',
  positions: 'paper:positions',
  log: 'paper:log',
  equity: 'paper:equity',
  lock: 'paper:agent_lock',
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// ADVISORY LOCK (prevents concurrent Vercel instances)
// ─────────────────────────────────────────────────────────────────────────────

// Lock duration: if a run started within this window, consider it still running
const LOCK_MS = 90_000; // 90s — safe for 2-minute cron interval

export async function acquireLock(): Promise<boolean> {
  if (!isRedisAvailable()) return true; // local dev: no contention
  try {
    const redis = getRedis();
    // Read the timestamp of the last lock acquisition
    const existing = await redis.get<number>(KEYS.lock);
    if (existing !== null && Date.now() - Number(existing) < LOCK_MS) {
      return false; // another run started within the last 90s
    }
    // Write current timestamp as the lock (plain SET, no NX — simpler + reliable)
    await redis.set(KEYS.lock, Date.now(), { ex: 120 });
    return true;
  } catch {
    return true; // on Redis error, allow run rather than deadlock
  }
}

export async function releaseLock(): Promise<void> {
  if (!isRedisAvailable()) return;
  try {
    await getRedis().del(KEYS.lock);
  } catch { /* ignore */ }
}

// ─────────────────────────────────────────────────────────────────────────────
// PORTFOLIO
// ─────────────────────────────────────────────────────────────────────────────

function freshPortfolio(): PaperPortfolio {
  const now = new Date().toISOString();
  return {
    cash: STARTING_CAPITAL,
    startingCapital: STARTING_CAPITAL,
    peakValue: STARTING_CAPITAL,
    totalValue: STARTING_CAPITAL,
    lastUpdated: now,
    createdAt: now,
  };
}

export async function loadPortfolio(): Promise<PaperPortfolio> {
  if (isRedisAvailable()) {
    try {
      const data = await getRedis().get<PaperPortfolio>(KEYS.portfolio);
      if (data) return data;
    } catch (err) {
      console.error('[paperTradingStore] Redis read portfolio:', err);
    }
  }
  return freshPortfolio();
}

export async function savePortfolio(p: PaperPortfolio): Promise<void> {
  if (!isRedisAvailable()) return;
  try {
    await getRedis().set(KEYS.portfolio, JSON.stringify(p));
  } catch (err) {
    console.error('[paperTradingStore] Redis write portfolio:', err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// POSITIONS
// ─────────────────────────────────────────────────────────────────────────────

export async function loadPositions(): Promise<PaperPosition[]> {
  if (isRedisAvailable()) {
    try {
      const data = await getRedis().get<PaperPosition[]>(KEYS.positions);
      return data ?? [];
    } catch (err) {
      console.error('[paperTradingStore] Redis read positions:', err);
    }
  }
  return [];
}

export async function savePositions(positions: PaperPosition[]): Promise<void> {
  if (!isRedisAvailable()) return;
  try {
    await getRedis().set(KEYS.positions, JSON.stringify(positions));
  } catch (err) {
    console.error('[paperTradingStore] Redis write positions:', err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// AGENT LOG
// ─────────────────────────────────────────────────────────────────────────────

export async function loadLog(): Promise<AgentLogEntry[]> {
  if (isRedisAvailable()) {
    try {
      const data = await getRedis().get<AgentLogEntry[]>(KEYS.log);
      return data ?? [];
    } catch (err) {
      console.error('[paperTradingStore] Redis read log:', err);
    }
  }
  return [];
}

export async function appendLog(entry: AgentLogEntry): Promise<void> {
  if (!isRedisAvailable()) return;
  try {
    const existing = await loadLog();
    const updated = [entry, ...existing].slice(0, 100);
    await getRedis().set(KEYS.log, JSON.stringify(updated));
  } catch (err) {
    console.error('[paperTradingStore] Redis write log:', err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// EQUITY SNAPSHOTS
// ─────────────────────────────────────────────────────────────────────────────

export async function loadEquity(): Promise<EquitySnapshot[]> {
  if (isRedisAvailable()) {
    try {
      const data = await getRedis().get<EquitySnapshot[]>(KEYS.equity);
      return data ?? [];
    } catch (err) {
      console.error('[paperTradingStore] Redis read equity:', err);
    }
  }
  return [];
}

export async function appendEquitySnapshot(value: number): Promise<void> {
  if (!isRedisAvailable()) return;
  try {
    const today = new Date().toISOString().slice(0, 10);
    const existing = await loadEquity();
    // Dedupe by date: remove today's existing snapshot if any, then append
    const filtered = existing.filter(s => s.date !== today);
    const updated = [...filtered, { date: today, value }]
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-365);
    await getRedis().set(KEYS.equity, JSON.stringify(updated));
  } catch (err) {
    console.error('[paperTradingStore] Redis write equity:', err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// RESET
// ─────────────────────────────────────────────────────────────────────────────

export async function resetPaperTrading(): Promise<void> {
  if (!isRedisAvailable()) {
    throw new Error('Redis not available — cannot reset');
  }
  const redis = getRedis();
  await Promise.all([
    redis.set(KEYS.portfolio, JSON.stringify(freshPortfolio())),
    redis.set(KEYS.positions, JSON.stringify([])),
    redis.set(KEYS.log, JSON.stringify([])),
    redis.set(KEYS.equity, JSON.stringify([])),
  ]);
}
