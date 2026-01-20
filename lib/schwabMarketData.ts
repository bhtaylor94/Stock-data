import { getSchwabAccessToken, schwabFetchJson } from '@/lib/schwab';

const MD_BASE = 'https://api.schwabapi.com/marketdata/v1';

export type SchwabQuote = any;

export async function getQuotes(symbols: string[]): Promise<Record<string, SchwabQuote>> {
  const cleaned = (symbols || []).map(s => String(s || '').trim().toUpperCase()).filter(Boolean);
  if (cleaned.length === 0) return {};

  const tokenResult = await getSchwabAccessToken('stock', { forceRefresh: false });
  if (!tokenResult.token) throw new Error(tokenResult.error || 'Schwab auth failed');

  const qs = new URLSearchParams();
  qs.set('symbols', cleaned.join(','));
  qs.set('fields', 'quote,reference,extended,fundamental');

  const url = MD_BASE + '/quotes?' + qs.toString();
  const res = await schwabFetchJson<any>(tokenResult.token, url, { scope: 'stock' });
  if (!res.ok) throw new Error(res.text || res.error);

  if (res.data && typeof res.data === 'object' && !Array.isArray(res.data)) {
    return res.data as Record<string, SchwabQuote>;
  }
  return {};
}

export async function getMovers(index: string, direction?: 'up' | 'down', change?: 'value' | 'percent'): Promise<any[]> {
  const tokenResult = await getSchwabAccessToken('stock', { forceRefresh: false });
  if (!tokenResult.token) throw new Error(tokenResult.error || 'Schwab auth failed');

  const qs = new URLSearchParams();
  if (direction) qs.set('direction', direction);
  if (change) qs.set('change', change);

  const url = MD_BASE + '/movers/' + encodeURIComponent(index) + (qs.toString() ? ('?' + qs.toString()) : '');
  const res = await schwabFetchJson<any>(tokenResult.token, url, { scope: 'stock' });
  if (!res.ok) throw new Error(res.text || res.error);
  return Array.isArray(res.data) ? res.data : [];
}
