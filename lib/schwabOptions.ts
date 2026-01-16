import { getSchwabAccessToken, schwabFetchJson } from '@/lib/schwab';

const MD_BASE = 'https://api.schwabapi.com/marketdata/v1';

// The Schwab chains payload is not strictly typed; we treat as opaque and normalize downstream.
export type SchwabOptionsChain = any;

export async function getOptionsChain(symbol: string): Promise<SchwabOptionsChain> {
  const sym = String(symbol || '').trim().toUpperCase();
  if (!sym) throw new Error('symbol required');

  const tokenResult = await getSchwabAccessToken('options', { forceRefresh: false });
  if (!tokenResult.token) throw new Error(tokenResult.error || 'Schwab auth failed');

  const qs = new URLSearchParams();
  qs.set('symbol', sym);
  qs.set('contractType', 'ALL');
  qs.set('strikeCount', '50');
  qs.set('includeUnderlyingQuote', 'true');
  qs.set('range', 'ALL');

  const url = MD_BASE + '/chains?' + qs.toString();
  const res = await schwabFetchJson<any>(tokenResult.token, url, { scope: 'options' });
  if (!res.ok) throw new Error(res.text || res.error);
  return res.data;
}
