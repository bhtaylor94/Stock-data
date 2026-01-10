import { TTLCache } from '@/lib/cache';

type TokenResult = { token: string | null; error: string | null; status?: number };

const tokenCache = new TTLCache<string>();

function env(name: string): string | null {
  const v = process.env[name];
  return v && v.trim() ? v.trim() : null;
}

export async function getSchwabAccessToken(scope: 'stock' | 'options' | 'tracker'): Promise<TokenResult> {
  const appKey = env('SCHWAB_APP_KEY');
  const appSecret = env('SCHWAB_APP_SECRET');
  const refreshToken = env('SCHWAB_REFRESH_TOKEN');

  if (!appKey || !appSecret || !refreshToken) {
    return {
      token: null,
      error: `Missing Schwab credentials. Set SCHWAB_APP_KEY, SCHWAB_APP_SECRET, SCHWAB_REFRESH_TOKEN.`,
      status: 500,
    };
  }

  const cacheKey = 'schwab_access_token';
  const cached = tokenCache.get(cacheKey);
  if (cached) return { token: cached, error: null };

  const basic = Buffer.from(`${appKey}:${appSecret}`).toString('base64');

  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  });

  const url = 'https://api.schwabapi.com/v1/oauth/token';

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basic}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    });

    const text = await res.text();
    let data: any = null;
    try { data = JSON.parse(text); } catch { /* noop */ }

    if (!res.ok) {
      const detail = data?.error_description || data?.error || text || 'Unknown error';
      return { token: null, error: `[Schwab ${scope}] OAuth failed (${res.status}): ${detail}`, status: res.status };
    }

    const accessToken = data?.access_token as string | undefined;
    const expiresIn = Number(data?.expires_in ?? 1800);
    if (!accessToken) return { token: null, error: `[Schwab ${scope}] OAuth response missing access_token`, status: 500 };

    // Cache with 2-minute safety buffer
    const ttlMs = Math.max(0, (expiresIn - 120) * 1000);
    tokenCache.set(cacheKey, accessToken, ttlMs);

    // Schwab can return a new refresh_token sometimes. We can't persist it here, so warn.
    if (data?.refresh_token && data.refresh_token !== refreshToken) {
      console.warn('[Schwab] ⚠️ OAuth returned a new refresh token. Save it to keep access long-term.');
    }

    return { token: accessToken, error: null };
  } catch (err: any) {
    return { token: null, error: `[Schwab ${scope}] Network error: ${String(err)}`, status: 500 };
  }
}

export async function schwabFetchJson<T>(
  token: string,
  url: string,
  opts?: { method?: string; headers?: Record<string, string>; body?: any }
): Promise<{ ok: true; data: T } | { ok: false; status: number; error: string; text?: string }> {
  try {
    const res = await fetch(url, {
      method: opts?.method || 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        ...(opts?.headers || {}),
      },
      body: opts?.body,
    });

    const text = await res.text();
    let data: any = null;
    try { data = text ? JSON.parse(text) : null; } catch { /* ignore */ }

    if (!res.ok) {
      return { ok: false, status: res.status, error: `Schwab API error ${res.status}`, text };
    }
    return { ok: true, data: data as T };
  } catch (err: any) {
    return { ok: false, status: 500, error: `Schwab network error: ${String(err)}` };
  }
}
