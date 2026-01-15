import { loadSuggestions, type TrackedSuggestion } from '@/lib/trackerStore';
import { STRATEGY_REGISTRY } from '@/strategies/registry';

export type ForwardStats = {
  strategyId: string;
  strategyName: string;
  sampleSize: number;
  winRate: number; // 0..100
  avgR: number; // average R-multiple
  maxDrawdownR: number; // peak-to-trough drawdown in R units
  lastUpdatedISO?: string;
};

const TERMINAL_STATUSES = new Set<string>([
  'HIT_TARGET',
  'MISSED_TARGET',
  'STOPPED_OUT',
  'CLOSED',
  'EXPIRED',
  'CANCELED',
]);

function asNumber(v: any, fallback = NaN): number {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function normalize(s: string): string {
  return String(s || '').trim().toLowerCase();
}

function matchesStrategy(row: TrackedSuggestion, strategyId: string, strategyName: string): boolean {
  const r = normalize(row.strategy);
  const sid = normalize(strategyId);
  const sname = normalize(strategyName);
  if (!r) return false;
  return r === sid || r === sname || r.includes(sid) || r.includes(sname);
}

// Compute R-multiple from a tracked suggestion.
// - For longs, risk = entry - stop (must be > 0)
// - For shorts, risk = stop - entry (must be > 0)
// Heuristic: infer direction from stop vs entry if type is ambiguous.
export function computeRMultiple(s: TrackedSuggestion): number | null {
  const entry = asNumber((s as any).entryPrice, NaN);
  const stop = asNumber((s as any).stopLoss, NaN);
  const exit = asNumber((s as any).closedPrice, NaN);
  if (!Number.isFinite(entry) || !Number.isFinite(stop) || !Number.isFinite(exit)) return null;
  if (entry <= 0) return null;

  const type = normalize((s as any).type);
  const isExplicitShort = type === 'sell' || type.includes('short') || type.includes('put');
  const inferShort = stop > entry;
  const isShort = isExplicitShort || inferShort;

  if (!isShort) {
    const risk = entry - stop;
    if (!(risk > 0)) return null;
    return (exit - entry) / risk;
  }

  const risk = stop - entry;
  if (!(risk > 0)) return null;
  return (entry - exit) / risk;
}

export function computeStatsFromRows(
  strategyId: string,
  strategyName: string,
  rows: TrackedSuggestion[],
): ForwardStats {
  let sampleSize = 0;
  let wins = 0;
  let sumR = 0;
  let lastUpdatedISO: string | undefined;

  // Equity curve in R units to estimate max drawdown.
  let equity = 0;
  let peak = 0;
  let maxDrawdownR = 0;

  // Sort by close time for a stable curve.
  const ordered = rows
    .slice()
    .sort((a, b) => String(a.closedAt || a.updatedAt || '').localeCompare(String(b.closedAt || b.updatedAt || '')));

  for (const s of ordered) {
    const r = computeRMultiple(s);
    if (r === null) continue;
    sampleSize += 1;
    sumR += r;
    if (r > 0) wins += 1;

    equity += r;
    if (equity > peak) peak = equity;
    const dd = peak - equity;
    if (dd > maxDrawdownR) maxDrawdownR = dd;

    const ts = String((s as any).closedAt || (s as any).updatedAt || '');
    if (ts && (!lastUpdatedISO || ts > lastUpdatedISO)) lastUpdatedISO = ts;
  }

  const winRate = sampleSize ? Math.round((wins / sampleSize) * 1000) / 10 : 0;
  const avgR = sampleSize ? Math.round((sumR / sampleSize) * 100) / 100 : 0;
  maxDrawdownR = Math.round(maxDrawdownR * 100) / 100;

  return {
    strategyId,
    strategyName,
    sampleSize,
    winRate,
    avgR,
    maxDrawdownR,
    lastUpdatedISO,
  };
}

export async function getForwardStatsAll(): Promise<Record<string, ForwardStats>> {
  const all = await loadSuggestions();
  const closed = all.filter((s) => TERMINAL_STATUSES.has(String((s as any).status || '')));

  const out: Record<string, ForwardStats> = {};
  for (const strat of STRATEGY_REGISTRY) {
    const rows = closed.filter((r) => matchesStrategy(r, strat.id, strat.name));
    out[strat.id] = computeStatsFromRows(strat.id, strat.name, rows);
  }
  return out;
}

export async function getForwardStats(strategyId: string): Promise<ForwardStats | null> {
  const strat = STRATEGY_REGISTRY.find((s) => s.id === strategyId) || null;
  if (!strat) return null;
  const all = await loadSuggestions();
  const closed = all.filter((s) => TERMINAL_STATUSES.has(String((s as any).status || '')));
  const rows = closed.filter((r) => matchesStrategy(r, strat.id, strat.name));
  return computeStatsFromRows(strat.id, strat.name, rows);
}
