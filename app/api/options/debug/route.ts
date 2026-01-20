import { NextResponse } from 'next/server';
import { getSchwabAccessToken } from '@/lib/schwab';

function safeHash(input: string): string {
  // non-reversible short fingerprint for debugging env mismatches
  let h = 0;
  for (let i = 0; i < input.length; i++) h = (h * 31 + input.charCodeAt(i)) >>> 0;
  return h.toString(16).padStart(8, '0');
}

export async function GET() {
  const envName = process.env.VERCEL_ENV || process.env.NODE_ENV || 'unknown';

  const key = process.env.SCHWAB_APP_KEY?.trim() || '';
  const secret = process.env.SCHWAB_APP_SECRET?.trim() || '';
  const refresh = process.env.SCHWAB_REFRESH_TOKEN?.trim() || '';

  const envFlags = {
    hasKey: Boolean(key),
    hasSecret: Boolean(secret),
    hasRefreshToken: Boolean(refresh),
    keyLen: key.length,
    secretLen: secret.length,
    refreshLen: refresh.length,
    // fingerprints help confirm you updated the right environment without exposing values
    keyFp: key ? safeHash(key) : null,
    secretFp: secret ? safeHash(secret) : null,
    refreshFp: refresh ? safeHash(refresh) : null,
  };

  // Attempt to fetch an access token (this will try refresh flow)
  const t0 = Date.now();
  const tokenResult = await getSchwabAccessToken('options', { forceRefresh: true }).catch((e: any) => ({
    accessToken: null,
    error: String(e),
    status: null,
  })) as any;
  const ms = Date.now() - t0;

  return NextResponse.json({
    ok: Boolean(tokenResult && tokenResult.accessToken),
    env: envName,
    envFlags,
    token: {
      ok: Boolean(tokenResult && tokenResult.accessToken),
      status: tokenResult.status ?? null,
      error: tokenResult.error ?? null,
      tookMs: ms,
    },
    next: [
      'If env fingerprints changed but ok=false, regenerate refresh token for the same Schwab app key/secret.',
      'If env fingerprints did not change after updating Vercel env vars, you updated the wrong environment (Production vs Preview).',
    ],
  });
}
