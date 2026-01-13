import { NextRequest, NextResponse } from 'next/server';

import { loadSuggestions, TrackedSuggestion } from '@/lib/trackerStore';

function asNumber(v: any, fallback = 0): number {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function bucketFromConfidence(c: any): 'HIGH' | 'MED' | 'LOW' | 'N/A' {
  const v = asNumber(c, 0);
  if (v >= 75) return 'HIGH';
  if (v >= 60) return 'MED';
  if (v > 0) return 'LOW';
  return 'N/A';
}

function isRealized(s: TrackedSuggestion): boolean {
  return s.status === 'CLOSED' || s.status === 'HIT_TARGET' || s.status === 'STOPPED_OUT' || s.status === 'EXPIRED';
}

function pnlPctForSuggestion(s: TrackedSuggestion): number {
  // Best-effort realized PnL%: use closedPrice when present, else 0.
  const entry = asNumber(s.entryPrice, 0);
  const exit = asNumber(s.closedPrice, NaN);
  if (!Number.isFinite(entry) || entry <= 0) return 0;
  if (!Number.isFinite(exit) || exit <= 0) return 0;
  return ((exit - entry) / entry) * 100;
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const includeOutcomes = url.searchParams.get('outcomes') !== '0';

    const all = await loadSuggestions();
    const realized = all.filter(isRealized);

    const byBucket: Record<string, any> = {};
    const bySetup: Record<string, any> = {};
    const horizonAgg: Record<string, any> = {};

    for (const s of realized) {
      const bucket = bucketFromConfidence((s as any).confidence);
      const setupKey = String((s as any).setup || (s as any).strategy || (s as any).type || 'UNKNOWN');
      const pnlPct = pnlPctForSuggestion(s);
      const win = s.status === 'HIT_TARGET' || pnlPct > 0;

      byBucket[bucket] = byBucket[bucket] || { count: 0, wins: 0, avgPnlPct: 0 };
      byBucket[bucket].count += 1;
      if (win) byBucket[bucket].wins += 1;
      byBucket[bucket].avgPnlPct += pnlPct;

      bySetup[setupKey] = bySetup[setupKey] || { count: 0, wins: 0, avgPnlPct: 0 };
      bySetup[setupKey].count += 1;
      if (win) bySetup[setupKey].wins += 1;
      bySetup[setupKey].avgPnlPct += pnlPct;

      if (includeOutcomes && !s.optionContract && s.outcomes && s.outcomes.returnsPct) {
        for (const k of Object.keys(s.outcomes.returnsPct)) {
          const val = asNumber(s.outcomes.returnsPct[k], NaN);
          if (!Number.isFinite(val)) continue;
          horizonAgg[k] = horizonAgg[k] || { count: 0, avgReturnPct: 0 };
          horizonAgg[k].count += 1;
          horizonAgg[k].avgReturnPct += val;
        }
      }
    }

    for (const k of Object.keys(byBucket)) {
      const o = byBucket[k];
      o.winRate = o.count ? o.wins / o.count : 0;
      o.avgPnlPct = o.count ? o.avgPnlPct / o.count : 0;
    }
    for (const k of Object.keys(bySetup)) {
      const o = bySetup[k];
      o.winRate = o.count ? o.wins / o.count : 0;
      o.avgPnlPct = o.count ? o.avgPnlPct / o.count : 0;
    }
    for (const k of Object.keys(horizonAgg)) {
      const o = horizonAgg[k];
      o.avgReturnPct = o.count ? o.avgReturnPct / o.count : 0;
    }

    return NextResponse.json({
      totalTracked: all.length,
      realizedCount: realized.length,
      byBucket,
      bySetup,
      horizonReturns: horizonAgg,
      note:
        'Calibration is computed from tracked suggestions. Realized PnL% uses closedPrice when available; horizonReturns are best-effort for STOCK suggestions only.',
    });
  } catch (err: any) {
    return NextResponse.json({ error: `Calibration GET error: ${String(err)}` }, { status: 500 });
  }
}
