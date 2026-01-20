import { NextResponse } from 'next/server';
import { getSchwabAccessToken, schwabFetchJson } from '@/lib/schwab';

export const runtime = 'nodejs';

export async function GET() {
  try {
    // Use the same scope as other account/trading endpoints.
    const tokenResult = await getSchwabAccessToken('tracker', { forceRefresh: false });
    if (!tokenResult.token) {
      return NextResponse.json({ ok: false, canTrade: false, hasAccount: false, error: tokenResult.error, status: tokenResult.status }, { status: tokenResult.status || 401 });
    }

    // Accounts endpoint is the most reliable lightweight auth check.
    const accounts = await schwabFetchJson<any[]>(
      tokenResult.token,
      'https://api.schwabapi.com/trader/v1/accounts/accountNumbers',
      { scope: 'tracker' }
    );

    if (!accounts.ok) {
      return NextResponse.json(
        { ok: false, canTrade: false, hasAccount: false, error: accounts.error, status: accounts.status },
        { status: accounts.status }
      );
    }

    const hasAccount = Array.isArray(accounts.data) && accounts.data.length > 0;
    return NextResponse.json({
      ok: true,
      canTrade: hasAccount,
      hasAccount,
      accounts: hasAccount ? accounts.data.map(a => ({ accountNumber: a.accountNumber, hashValue: a.hashValue })) : [],
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, canTrade: false, hasAccount: false, error: e?.message || 'Unknown error' }, { status: 500 });
  }
}
