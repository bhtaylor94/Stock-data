import { getSchwabAccessToken, schwabFetchJson } from '@/lib/schwab';
import { TTLCache } from '@/lib/cache';
import { loadSuggestions, type TrackedSuggestion } from '@/lib/trackerStore';

export type RiskSummaryRow = {
  symbol: string;
  strategy: string;
  side: 'LONG' | 'SHORT';
  quantity: number;
  entry: number;
  mark: number;
  notionalUSD: number;
  unrealizedPnLUSD: number;
};

export type RiskSummary = {
  asOfISO: string;
  openCount: number;
  openBySymbol: Record<string, number>;
  openByStrategy: Record<string, number>;
  notionalOpenUSD: number;
  unrealizedPnLUSD: number;
  realizedTodayPnLUSD: number;
  rows: RiskSummaryRow[];
};

function asNumber(v: any, fallback = NaN): number {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function normalize(s: any): string {
  return String(s || '').trim();
}

function isSameDayET(isoA: string, isoB: string): boolean {
  try {
    const a = new Date(isoA);
    const b = new Date(isoB);
    // convert to America/New_York by using locale date parts
    const da = a.toLocaleDateString('en-US', { timeZone: 'America/New_York' });
    const db = b.toLocaleDateString('en-US', { timeZone: 'America/New_York' });
    return da === db;
  } catch {
    return false;
  }
}

function inferSide(s: TrackedSuggestion): 'LONG' | 'SHORT' {
  const sigAction = String((s as any)?.evidencePacket?.signal?.action || '').toUpperCase();
  if (sigAction === 'SELL') return 'SHORT';
  if (sigAction === 'BUY') return 'LONG';

  const t = String((s as any)?.type || '').toLowerCase();
  if (t.includes('sell') || t.includes('short') || t.includes('put')) return 'SHORT';

  const entry = asNumber((s as any)?.entryPrice, NaN);
  const stop = asNumber((s as any)?.stopLoss, NaN);
  if (Number.isFinite(entry) && Number.isFinite(stop) && stop > entry) return 'SHORT';
  return 'LONG';
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

const quoteCache = new TTLCache<number>();

async function fetchQuotePrices(symbols: string[]): Promise<Record<string, number>> {
  const unique = Array.from(new Set(symbols.map((s) => normalize(s).toUpperCase()).filter(Boolean)));
  const out: Record<string, number> = {};
  if (!unique.length) return out;

  const miss: string[] = [];
  for (const s of unique) {
    const hit = quoteCache.get(`q:${s}`);
    if (typeof hit === 'number' && Number.isFinite(hit)) out[s] = hit;
    else miss.push(s);
  }
  if (!miss.length) return out;

  const tok = await getSchwabAccessToken('tracker');
  if (!tok.token) return out;

  for (const group of chunk(miss, 50)) {
    const url = `https://api.schwabapi.com/marketdata/v1/quotes?symbols=${encodeURIComponent(group.join(','))}&indicative=false`;
    const r = await schwabFetchJson<any>(tok.token, url, { scope: 'tracker' });
    if (!r.ok) continue;

    for (const sym of group) {
      const q = r.data?.quotes?.[sym] || r.data?.[sym] || null;
      const px = asNumber(q?.quote?.lastPrice ?? q?.quote?.mark ?? q?.quote?.closePrice, NaN);
      if (!Number.isFinite(px)) continue;
      out[sym] = px;
      quoteCache.set(`q:${sym}`, px, 15_000);
    }
  }

  return out;
}

function pnlUSD(side: 'LONG' | 'SHORT', entry: number, exitOrMark: number, qty: number): number {
  if (!Number.isFinite(entry) || !Number.isFinite(exitOrMark) || !Number.isFinite(qty)) return 0;
  if (side === 'LONG') return (exitOrMark - entry) * qty;
  return (entry - exitOrMark) * qty;
}

export async function getRiskSummary(): Promise<RiskSummary> {
  const asOfISO = new Date().toISOString();
  const all = await loadSuggestions();
  const active = all.filter((s) => String((s as any)?.status || '') === 'ACTIVE');
  const closed = all.filter((s) => String((s as any)?.status || '') !== 'ACTIVE' && Boolean((s as any)?.closedAt));

  const openBySymbol: Record<string, number> = {};
  const openByStrategy: Record<string, number> = {};

  const tickers = active.map((s) => normalize((s as any)?.ticker).toUpperCase()).filter(Boolean);
  const prices = await fetchQuotePrices(tickers);

  const rows: RiskSummaryRow[] = [];
  let notionalOpenUSD = 0;
  let unrealizedPnLUSD = 0;

  for (const s of active) {
    const symbol = normalize((s as any)?.ticker).toUpperCase();
    if (!symbol) continue;

    openBySymbol[symbol] = (openBySymbol[symbol] || 0) + 1;
    const strat = normalize((s as any)?.strategy) || 'unknown';
    openByStrategy[strat] = (openByStrategy[strat] || 0) + 1;

    const entry = asNumber((s as any)?.entryPrice, NaN);
    const mark = asNumber(prices[symbol], NaN);
    const qty = Math.max(0, asNumber((s as any)?.positionShares ?? 1, 1));
    const side = inferSide(s);

    if (Number.isFinite(mark) && Number.isFinite(qty)) {
      const notional = Math.abs(mark * qty);
      notionalOpenUSD += notional;
    }

    if (Number.isFinite(entry) && Number.isFinite(mark) && Number.isFinite(qty)) {
      const u = pnlUSD(side, entry, mark, qty);
      unrealizedPnLUSD += u;
      rows.push({
        symbol,
        strategy: strat,
        side,
        quantity: qty,
        entry,
        mark,
        notionalUSD: Math.abs(mark * qty),
        unrealizedPnLUSD: u,
      });
    }
  }

  // Realized PnL for today (America/New_York)
  let realizedTodayPnLUSD = 0;
  for (const s of closed) {
    const closedAt = normalize((s as any)?.closedAt);
    if (!closedAt) continue;
    if (!isSameDayET(closedAt, asOfISO)) continue;

    const entry = asNumber((s as any)?.entryPrice, NaN);
    const exitPx = asNumber((s as any)?.closedPrice, NaN);
    const qty = Math.max(0, asNumber((s as any)?.positionShares ?? 1, 1));
    const side = inferSide(s);
    if (!Number.isFinite(entry) || !Number.isFinite(exitPx) || !Number.isFinite(qty)) continue;
    realizedTodayPnLUSD += pnlUSD(side, entry, exitPx, qty);
  }

  // Sort biggest notionals first (for UI readability)
  rows.sort((a, b) => b.notionalUSD - a.notionalUSD);

  return {
    asOfISO,
    openCount: active.length,
    openBySymbol,
    openByStrategy,
    notionalOpenUSD: Math.round(notionalOpenUSD * 100) / 100,
    unrealizedPnLUSD: Math.round(unrealizedPnLUSD * 100) / 100,
    realizedTodayPnLUSD: Math.round(realizedTodayPnLUSD * 100) / 100,
    rows,
  };
}
