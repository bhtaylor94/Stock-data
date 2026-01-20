import { TTLCache } from '@/lib/cache';

type Cached = { text: string; status: number; headers: Record<string,string> };

const cache = new TTLCache<Cached>();

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
