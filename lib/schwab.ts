// lib/schwab.ts
// Central Schwab OAuth + fetch helpers (server-side). Designed for Vercel/Next.js.

type Scope = 'marketdata' | 'trading' | 'streaming';

type TokenResult = {
  token?: string;
  error?: string;
  expiresAt?: number;
};

let cached: { token: string; expiresAt: number } | null = null;

function nowMs(): number {
  return Date.now();
}

function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(['Missing env var: ', name].join(''));
  return v;
}

function basicAuthHeader(clientId: string, clientSecret: string): string {
  const raw = [clientId, ':', clientSecret].join('');
  const b64 = Buffer.from(raw).toString('base64');
  return ['Basic ', b64].join('');
}

// NOTE: Schwab access tokens are short-lived. We cache in-memory for the current runtime.
export async function getSchwabAccessToken(_scope: Scope = 'marketdata'): Promise<TokenResult> {
  try {
    // Return cached token if still valid (30s safety buffer)
    if (cached && cached.expiresAt - nowMs() > 30_000) {
      return { token: cached.token, expiresAt: cached.expiresAt };
    }

    const clientId = env('SCHWAB_APP_KEY');
    const clientSecret = env('SCHWAB_APP_SECRET');
    const refreshToken = env('SCHWAB_REFRESH_TOKEN');

    const body = new URLSearchParams();
    body.set('grant_type', 'refresh_token');
    body.set('refresh_token', refreshToken);

    const resp = await fetch('https://api.schwabapi.com/v1/oauth/token', {
      method: 'POST',
      headers: {
        Authorization: basicAuthHeader(clientId, clientSecret),
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: body.toString()
    });

    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      return { error: ['Token refresh failed: ', String(resp.status), ' ', text].join('') };
    }

    const data = (await resp.json()) as { access_token: string; expires_in: number };
    const token = data.access_token;
    const expiresAt = nowMs() + (Number(data.expires_in) * 1000);

    cached = { token, expiresAt };
    return { token, expiresAt };
  } catch (e: any) {
    return { error: e?.message ? String(e.message) : 'Unknown token error' };
  }
}

export async function schwabFetchJson<T>(
  token: string,
  url: string,
  init?: RequestInit
): Promise<{ ok: true; data: T } | { ok: false; status: number; error: string }> {
  const resp = await fetch(url, {
    ...(init || {}),
    headers: {
      ...(init?.headers || {}),
      Authorization: ['Bearer ', token].join(''),
      Accept: 'application/json'
    }
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    return { ok: false, status: resp.status, error: text || 'Request failed' };
  }

  const data = (await resp.json()) as T;
  return { ok: true, data };
}
