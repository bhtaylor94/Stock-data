import { getSchwabAccessToken, schwabFetchJson } from '@/lib/schwab';

export type SchwabAccountNumber = { accountNumber: string; hashValue: string };
export type SchwabAccountDetails = any;
export type SchwabOrder = any;
export type SchwabTransaction = any;
export type SchwabUserPreference = any;

const TRADER_BASE = 'https://api.schwabapi.com/trader/v1';

async function getToken(scope: 'stock' | 'options' | 'tracker', forceRefresh?: boolean): Promise<string> {
  const tokenResult = await getSchwabAccessToken(scope, { forceRefresh: Boolean(forceRefresh) });
  if (!tokenResult.token) throw new Error(tokenResult.error || 'Schwab auth failed');
  return tokenResult.token;
}

export async function listAccountNumbers(): Promise<SchwabAccountNumber[]> {
  const token = await getToken('tracker', false);
  const res = await schwabFetchJson<SchwabAccountNumber[]>(token, TRADER_BASE + '/accounts/accountNumbers', { scope: 'tracker' });
  if (!res.ok) throw new Error(res.text || res.error);
  return Array.isArray(res.data) ? res.data : [];
}

export async function getPrimaryAccountHash(): Promise<string> {
  const accounts = await listAccountNumbers();
  if (!accounts.length) throw new Error('No Schwab accounts returned');
  const hash = accounts[0]?.hashValue;
  if (!hash) throw new Error('Schwab account hash missing');
  return hash;
}

export async function getAccountDetails(accountHash: string, fields?: string): Promise<SchwabAccountDetails> {
  const token = await getToken('tracker', false);
  const url = TRADER_BASE + '/accounts/' + encodeURIComponent(accountHash) + (fields ? ('?fields=' + encodeURIComponent(fields)) : '');
  const res = await schwabFetchJson<any>(token, url, { scope: 'tracker' });
  if (!res.ok) throw new Error(res.text || res.error);
  return res.data;
}

export async function listAccountOrders(accountHash: string, params?: {
  maxResults?: number;
  fromEnteredTime?: string;
  toEnteredTime?: string;
  status?: string;
}): Promise<SchwabOrder[]> {
  const token = await getToken('tracker', false);
  const qs = new URLSearchParams();
  if (params?.maxResults) qs.set('maxResults', String(params.maxResults));
  if (params?.fromEnteredTime) qs.set('fromEnteredTime', params.fromEnteredTime);
  if (params?.toEnteredTime) qs.set('toEnteredTime', params.toEnteredTime);
  if (params?.status) qs.set('status', params.status);
  const url = TRADER_BASE + '/accounts/' + encodeURIComponent(accountHash) + '/orders' + (qs.toString() ? ('?' + qs.toString()) : '');
  const res = await schwabFetchJson<any>(token, url, { scope: 'tracker' });
  if (!res.ok) throw new Error(res.text || res.error);
  return Array.isArray(res.data) ? res.data : [];
}

export async function listTransactions(accountHash: string, params?: {
  startDate?: string;
  endDate?: string;
  types?: string;
}): Promise<SchwabTransaction[]> {
  const token = await getToken('tracker', false);
  const qs = new URLSearchParams();
  if (params?.startDate) qs.set('startDate', params.startDate);
  if (params?.endDate) qs.set('endDate', params.endDate);
  if (params?.types) qs.set('types', params.types);
  const url = TRADER_BASE + '/accounts/' + encodeURIComponent(accountHash) + '/transactions' + (qs.toString() ? ('?' + qs.toString()) : '');
  const res = await schwabFetchJson<any>(token, url, { scope: 'tracker' });
  if (!res.ok) throw new Error(res.text || res.error);
  return Array.isArray(res.data) ? res.data : [];
}

export async function getUserPreference(): Promise<SchwabUserPreference> {
  const token = await getToken('tracker', false);
  const url = TRADER_BASE + '/userPreference';
  const res = await schwabFetchJson<any>(token, url, { scope: 'tracker' });
  if (!res.ok) throw new Error(res.text || res.error);
  return res.data;
}
