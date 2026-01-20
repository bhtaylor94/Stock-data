import { NextRequest, NextResponse } from 'next/server';

import { getForwardStats, getForwardStatsAll } from '@/lib/forwardStats';

// GET /api/forward-stats
// Optional: ?strategyId=trend_rider_v1
// Returns forward-test summary stats computed from tracked + closed outcomes.
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const strategyId = String(url.searchParams.get('strategyId') || '').trim();

    if (strategyId) {
      const stats = await getForwardStats(strategyId);
      if (!stats) return NextResponse.json({ ok: false, error: 'Unknown strategyId' }, { status: 404 });
      return NextResponse.json({ ok: true, stats });
    }

    const all = await getForwardStatsAll();
    return NextResponse.json({ ok: true, statsByStrategy: all });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: `Forward stats error: ${String(err)}` }, { status: 500 });
  }
}
