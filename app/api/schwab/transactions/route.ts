import { NextRequest, NextResponse } from 'next/server';
import { getPrimaryAccountHash, listTransactions } from '@/lib/schwabBroker';

export const runtime = 'nodejs';

function toYMD(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return y + '-' + m + '-' + day;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const daysRaw = searchParams.get('days');
    const days = daysRaw ? Math.max(1, Math.min(30, Number(daysRaw))) : 7;
    const types = searchParams.get('types') || undefined;

    const now = new Date();
    const start = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

    const accountHash = await getPrimaryAccountHash();
    const transactions = await listTransactions(accountHash, {
      startDate: toYMD(start),
      endDate: toYMD(now),
      types,
    });

    return NextResponse.json({
      success: true,
      accountHash,
      transactions,
      meta: { asOf: new Date().toISOString(), windowDays: days },
    });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: String(e?.message || e) }, { status: 500 });
  }
}
