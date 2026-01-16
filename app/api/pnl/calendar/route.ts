import { NextRequest, NextResponse } from 'next/server';

import { loadSuggestions, type TrackedSuggestion } from '@/lib/trackerStore';
import { computeRealizedPnlUsd, isClosedStatus } from '@/lib/pnl';

export const runtime = 'nodejs';

const TZ = 'America/New_York';

function ymdInTZ(iso: string, timeZone: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-CA', { timeZone });
}

function isLiveTrade(s: TrackedSuggestion): boolean {
  return Boolean(s.broker?.orderId);
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const monthRaw = String(searchParams.get('month') || '').trim(); // YYYY-MM
    const scope = String(searchParams.get('scope') || 'live').toLowerCase(); // live|paper|all

    const nowMonth = new Date().toLocaleDateString('en-CA', { timeZone: TZ }).slice(0, 7);
    const month = /^\d{4}-\d{2}$/.test(monthRaw) ? monthRaw : nowMonth;

    const all = await loadSuggestions();
    const closed = all.filter(s => isClosedStatus(s.status) && Boolean(s.closedAt) && Boolean(s.closedPrice));

    const filtered = closed.filter(s => {
      if (scope === 'all') return true;
      if (scope === 'paper') return !isLiveTrade(s);
      return isLiveTrade(s);
    });

    const days: Record<string, { pnlUsd: number; trades: number }> = {};

    for (const s of filtered) {
      const day = ymdInTZ(String(s.closedAt), TZ);
      if (!day || !day.startsWith(month)) continue;
      const pnl = computeRealizedPnlUsd(s);
      const cur = days[day] || { pnlUsd: 0, trades: 0 };
      cur.pnlUsd += pnl;
      cur.trades += 1;
      days[day] = cur;
    }

    return NextResponse.json({
      ok: true,
      month,
      scope,
      timeZone: TZ,
      days,
      meta: { asOf: new Date().toISOString(), tradesCount: filtered.length },
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}
