import { cachedJson } from '@/lib/httpCache';

export type FundamentalSnapshot = {
  symbol: string;
  marketCap?: number;
  pe?: number;
  eps?: number;
  beta?: number;
  dividendYield?: number;
  sector?: string;
  industry?: string;
  exchange?: string;
  lastUpdated?: string;
  raw?: any;
};

function fmpKey(): string | null {
  const k = process.env.FMP_API_KEY;
  return k && k.trim() ? k.trim() : null;
}

export async function fetchFmpFundamentals(symbol: string): Promise<FundamentalSnapshot | null> {
  const key = fmpKey();
  if (!key) return null;
  const sym = String(symbol || '').trim().toUpperCase();
  if (!sym) return null;

  // Company profile is a lightweight way to get common fields.
  const url = 'https://financialmodelingprep.com/api/v3/profile/' + encodeURIComponent(sym) + '?apikey=' + encodeURIComponent(key);
  const res = await cachedJson<any>(url, { ttlMs: 5 * 60_000 });
  const row = Array.isArray(res) && res.length ? res[0] : null;
  if (!row) return null;

  const snap: FundamentalSnapshot = {
    symbol: sym,
    marketCap: typeof row?.mktCap === 'number' ? row.mktCap : typeof row?.marketCap === 'number' ? row.marketCap : undefined,
    pe: typeof row?.pe === 'number' ? row.pe : undefined,
    eps: typeof row?.eps === 'number' ? row.eps : undefined,
    beta: typeof row?.beta === 'number' ? row.beta : undefined,
    dividendYield: typeof row?.lastDiv === 'number' ? row.lastDiv : undefined,
    sector: typeof row?.sector === 'string' ? row.sector : undefined,
    industry: typeof row?.industry === 'string' ? row.industry : undefined,
    exchange: typeof row?.exchangeShortName === 'string' ? row.exchangeShortName : undefined,
    lastUpdated: new Date().toISOString(),
    raw: row,
  };

  return snap;
}

export async function fetchFundamentals(symbol: string): Promise<FundamentalSnapshot | null> {
  const a = await fetchFmpFundamentals(symbol);
  return a;
}
