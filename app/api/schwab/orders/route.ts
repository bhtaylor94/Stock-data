import { NextRequest, NextResponse } from 'next/server';
import { getPrimaryAccountHash, listAccountOrders } from '@/lib/schwabBroker';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') || undefined;
    const maxResultsRaw = searchParams.get('maxResults');
    const maxResults = maxResultsRaw ? Math.max(1, Math.min(500, Number(maxResultsRaw))) : 50;

    const now = new Date();
    const from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const to = now.toISOString();

    const accountHash = await getPrimaryAccountHash();
    const orders = await listAccountOrders(accountHash, {
      maxResults,
      fromEnteredTime: from,
      toEnteredTime: to,
      status: status || undefined,
    });

    return NextResponse.json({ success: true, accountHash, orders, meta: { asOf: new Date().toISOString() } });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: String(e?.message || e) }, { status: 500 });
  }
}
