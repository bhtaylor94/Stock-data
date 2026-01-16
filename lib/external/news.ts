import { cachedJson } from '@/lib/httpCache';

export type NewsItem = {
  source?: string;
  headline: string;
  url?: string;
  summary?: string;
  datetime?: number;
};

function finnhubKey(): string | null {
  const k = process.env.FINNHUB_API_KEY;
  return k && k.trim() ? k.trim() : null;
}

export async function fetchFinnhubNews(symbol: string): Promise<NewsItem[]> {
  const key = finnhubKey();
  if (!key) return [];
  const sym = String(symbol || '').trim().toUpperCase();
  if (!sym) return [];
  const url = 'https://finnhub.io/api/v1/company-news?symbol=' + encodeURIComponent(sym) + '&from=';
  // Use last 7 days
  const from = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const to = new Date().toISOString().slice(0, 10);
  const full = url + encodeURIComponent(from) + '&to=' + encodeURIComponent(to) + '&token=' + encodeURIComponent(key);
  const res = await cachedJson<any>(full, { ttlMs: 60_000 });
  const data = Array.isArray(res) ? res : [];
  return data.map((n: any) => ({
    source: String(n?.source || ''),
    headline: String(n?.headline || ''),
    url: String(n?.url || ''),
    summary: String(n?.summary || ''),
    datetime: typeof n?.datetime === 'number' ? n.datetime : undefined,
  })).filter((x: NewsItem) => x.headline);
}

export async function fetchNews(symbol: string): Promise<NewsItem[]> {
  const a = await fetchFinnhubNews(symbol);
  return a;
}
