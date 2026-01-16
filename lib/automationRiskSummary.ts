import { loadAutomationConfig } from '@/lib/automationStore';
import { loadSuggestions, type TrackedSuggestion } from '@/lib/trackerStore';
import { getSchwabAccessToken, schwabFetchJson } from '@/lib/schwab';
import { TTLCache } from '@/lib/cache';

type Side = 'LONG' | 'SHORT';

function asNumber(v: any, fallback = NaN): number {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function isAutopilotRow(s: TrackedSuggestion): boolean {
  const kind = (s as any)?.evidencePacket?.kind;
  return kind === 'autopilot_signal_v1';
}

function inferSide(s: TrackedSuggestion): Side {
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

function qtyFor(s: TrackedSuggestion): number {
  const shares = asNumber((s as any)?.positionShares, NaN);
  if (Number.isFinite(shares) && shares > 0) return shares;
  // Default assumptions used elsewhere in the app
  return 100;
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

const quoteCache = new TTLCache<number>();

async function fetchQuotePrices(symbols: string[]): Promise<Record<string, number>> {
  const unique = Array.from(new Set(symbols.map((s) => String(s || '').trim().toUpperCase()).filter(Boolean)));
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

function nyDateKey(d: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
    .formatToParts(d)
    .reduce<Record<string, string>>((acc, p) => {
      if (p.type !== 'literal') acc[p.type] = p.value;
      return acc;
    }, {});
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function inLastNDaysISO(iso: string | undefined, n: number): boolean {
  const t = iso ? new Date(iso).getTime() : NaN;
  if (!Number.isFinite(t)) return false;
  return Date.now() - t <= n * 24 * 60 * 60 * 1000;
}

export type AutomationRiskSummary = {
  ok: boolean;
  asOf: string;
  scope: 'autopilot' | 'all';
  killSwitch: { enabled: boolean; reason: string; setAt: string | null };

  openPositions: {
    total: number;
    bySymbol: Record<string, number>;
    byStrategy: Record<string, number>;
  };

  pnl: {
    realizedTodayUSD: number;
    realized7dUSD: number;
    unrealizedUSD: number;
  };

  exposure: {
    grossNotionalUSD: number;
    bySymbolUSD: Record<string, number>;
  };
};

export async function getAutomationRiskSummary(opts?: { autopilotOnly?: boolean }): Promise<AutomationRiskSummary> {
  const asOf = new Date().toISOString();
  const autopilotOnly = opts?.autopilotOnly !== false;

  const cfg = await loadAutomationConfig();
  const all = await loadSuggestions();
  const rows = autopilotOnly ? all.filter(isAutopilotRow) : all;

  const active = rows.filter((s) => String((s as any)?.status || '') === 'ACTIVE');
  const symbols = active.map((s) => String((s as any)?.ticker || '').toUpperCase()).filter(Boolean);
  const quotes = await fetchQuotePrices(symbols);

  const bySymbolCount: Record<string, number> = {};
  const byStrategyCount: Record<string, number> = {};

  let unrealized = 0;
  let grossNotional = 0;
  const bySymbolNotional: Record<string, number> = {};

  for (const s of active) {
    const sym = String((s as any)?.ticker || '').toUpperCase();
    if (!sym) continue;
    bySymbolCount[sym] = (bySymbolCount[sym] || 0) + 1;
    const strat = String((s as any)?.setup || (s as any)?.strategy || 'unknown');
    byStrategyCount[strat] = (byStrategyCount[strat] || 0) + 1;

    const entry = asNumber((s as any)?.entryPrice, NaN);
    const px = asNumber(quotes[sym], NaN);
    if (!Number.isFinite(entry) || !Number.isFinite(px)) continue;
    const q = qtyFor(s);
    const side = inferSide(s);
    const pnl = side === 'LONG' ? (px - entry) * q : (entry - px) * q;
    unrealized += pnl;

    const notional = px * q;
    grossNotional += notional;
    bySymbolNotional[sym] = (bySymbolNotional[sym] || 0) + notional;
  }

  // Realized PnL (best-effort, based on closedPrice)
  const todayKey = nyDateKey(new Date());
  let realizedToday = 0;
  let realized7d = 0;
  for (const s of rows) {
    const st = String((s as any)?.status || '');
    if (st === 'ACTIVE') continue;
    const entry = asNumber((s as any)?.entryPrice, NaN);
    const close = asNumber((s as any)?.closedPrice, NaN);
    if (!Number.isFinite(entry) || !Number.isFinite(close)) continue;
    const q = qtyFor(s);
    const side = inferSide(s);
    const pnl = side === 'LONG' ? (close - entry) * q : (entry - close) * q;

    const closedAt = (s as any)?.closedAt || (s as any)?.updatedAt;
    const closedDateKey = closedAt ? nyDateKey(new Date(closedAt)) : '';
    if (closedDateKey && closedDateKey === todayKey) realizedToday += pnl;
    if (inLastNDaysISO(closedAt, 7)) realized7d += pnl;
  }

  return {
    ok: true,
    asOf,
    scope: autopilotOnly ? 'autopilot' : 'all',
    killSwitch: {
      enabled: Boolean((cfg.autopilot as any).haltNewEntries),
      reason: String((cfg.autopilot as any).haltReason || ''),
      setAt: (cfg.autopilot as any).haltSetAt || null,
    },
    openPositions: {
      total: active.length,
      bySymbol: bySymbolCount,
      byStrategy: byStrategyCount,
    },
    pnl: {
      realizedTodayUSD: realizedToday,
      realized7dUSD: realized7d,
      unrealizedUSD: unrealized,
    },
    exposure: {
      grossNotionalUSD: grossNotional,
      bySymbolUSD: bySymbolNotional,
    },
  };
}
