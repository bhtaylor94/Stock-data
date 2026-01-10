import { NextRequest, NextResponse } from 'next/server';

import { loadSuggestions, updateSuggestion } from '@/lib/trackerStore';

function asNumber(v: any, fallback = 0): number {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function computePnl(s: any, closedPrice: number): { pnlPct: number; pnlUsd: number } {
  const entry = asNumber(s.entryPrice, 0);
  const exit = asNumber(closedPrice, 0);
  if (!entry || !exit) return { pnlPct: 0, pnlUsd: 0 };

  const pnlPct = ((exit - entry) / entry) * 100;

  // Assumptions:
  // - Stocks: 100 shares
  // - Options: 5 contracts, multiplier 100
  const isOption = Boolean(s.optionContract);
  if (isOption) {
    const contracts = asNumber(s.positionContracts, 5);
    const mult = asNumber(s.contractMultiplier, 100);
    const pnlUsd = (exit - entry) * contracts * mult;
    return { pnlPct, pnlUsd };
  }

  const shares = asNumber(s.positionShares, 100);
  const pnlUsd = (exit - entry) * shares;
  return { pnlPct, pnlUsd };
}

// GET /api/outcomes
// - optional query: ?ticker=SPY
// Returns tracked suggestions including any outcomes.
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const ticker = (url.searchParams.get('ticker') || '').trim().toUpperCase();
    const all = await loadSuggestions();
    const rows = ticker ? all.filter(s => String(s.ticker || '').toUpperCase() === ticker) : all;
    return NextResponse.json({ count: rows.length, rows });
  } catch (err: any) {
    return NextResponse.json({ error: `Outcomes GET error: ${String(err)}` }, { status: 500 });
  }
}

// POST /api/outcomes
// Body:
// {
//   "id": "...",
//   "closedPrice": 123.45,
//   "status": "CLOSED" | "HIT_TARGET" | "STOPPED_OUT" | "EXPIRED",
//   "closedAt": "ISO" (optional)
// }
// Updates the suggestion and returns realized PnL.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const id = String(body?.id || '').trim();
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const closedPrice = asNumber(body?.closedPrice, NaN);
    if (!Number.isFinite(closedPrice) || closedPrice <= 0) {
      return NextResponse.json({ error: 'Invalid closedPrice' }, { status: 400 });
    }

    const status = String(body?.status || 'CLOSED');
    const closedAt = String(body?.closedAt || new Date().toISOString());

    // Load the suggestion so we can compute PnL.
    const all = await loadSuggestions();
    const current = all.find(s => s.id === id);
    if (!current) return NextResponse.json({ error: 'Suggestion not found' }, { status: 404 });

    const { pnlPct, pnlUsd } = computePnl(current, closedPrice);

    const updated = await updateSuggestion(id, {
      status: status as any,
      closedPrice,
      closedAt,
      outcomes: {
        ...(current.outcomes || {}),
        computedAt: new Date().toISOString(),
      },
    });

    return NextResponse.json({ ok: true, updated, realized: { pnlPct, pnlUsd } });
  } catch (err: any) {
    return NextResponse.json({ error: `Outcomes POST error: ${String(err)}` }, { status: 500 });
  }
}
