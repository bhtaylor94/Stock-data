import { NextRequest, NextResponse } from 'next/server';

import { computeBrokerTruthPnlSummary } from '@/lib/brokerTruth/pnlSummary';

export const runtime = 'nodejs';

const TZ = 'America/New_York';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const scopeRaw = String(searchParams.get('scope') || 'live').toLowerCase();
    const scope: 'live' | 'paper' | 'all' = scopeRaw === 'paper' ? 'paper' : scopeRaw === 'all' ? 'all' : 'live';

    // v1: broker-truth only; paper will return broker truth if available (and can be extended later)
    const summary = await computeBrokerTruthPnlSummary({ scope, timeZone: TZ });
    if (!summary.ok) {
      return NextResponse.json(summary, { status: 502 });
    }
    return NextResponse.json(summary);
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}
