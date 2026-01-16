import { TTLCache } from '@/lib/cache';

type Cached = { text: string; status: number; headers: Record<string,string> };

const cache = new TTLCache<Cached>();

// Convenience helper used by external enrichers (news/fundamentals).
// Returns parsed JSON with best-effort caching.
export async function cachedJson<T>(
  url: string,
  opts?: { ttlMs?: number; headers?: Record<string, string> }
): Promise<T> {
  const ttlMs = Math.max(0, Number(opts?.ttlMs ?? 30_000));
  const key = `json:${url}`;
  const init: RequestInit = {
    method: 'GET',
    headers: {
      accept: 'application/json',
      ...(opts?.headers || {}),
    },
    cache: 'no-store',
  };

  const res = await fetchCached(key, url, init, ttlMs);
  if (!res.ok) return JSON.parse('null') as T;

  try {
    return JSON.parse(res.text) as T;
  } catch {
    return JSON.parse('null') as T;
  }
}

export async function fetchCached(
  key: string,
  url: string,
  init: RequestInit,
  ttlMs: number
): Promise<{ ok: boolean; status: number; text: string; fromCache: boolean }> {
  const hit = cache.get(key);
  if (hit) {
    return { ok: hit.status >= 200 && hit.status < 300, status: hit.status, text: hit.text, fromCache: true };
  }

  const res = await fetch(url, init);
  const text = await res.text();
  cache.set(key, { text, status: res.status, headers: {} }, ttlMs);
  return { ok: res.ok, status: res.status, text, fromCache: false };
}
