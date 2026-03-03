import { NextRequest, NextResponse } from 'next/server';
import { acquireLock, releaseLock } from '@/lib/paperTradingStore';
import { runPaperTradingAgent } from '@/lib/paperTradingAgent';

export const runtime    = 'nodejs';
export const dynamic    = 'force-dynamic';
export const maxDuration = 55; // Vercel Pro — maximize function timeout

export async function GET(req: NextRequest) {
  // ── 1. Secret gate ─────────────────────────────────────────────────────────
  const secret = req.nextUrl.searchParams.get('secret');
  const expected = process.env.PAPER_TRADE_SECRET;

  if (!expected || !expected.trim()) {
    return NextResponse.json({ error: 'PAPER_TRADE_SECRET env var not set' }, { status: 500 });
  }
  if (!secret || secret !== expected.trim()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // ── 2. Advisory lock (prevents concurrent Vercel instances) ────────────────
  const lockAcquired = await acquireLock();
  if (!lockAcquired) {
    return NextResponse.json({ skipped: true, message: 'Another run already in progress — skipped' });
  }

  try {
    // ── 3. Run agent ─────────────────────────────────────────────────────────
    const result = await runPaperTradingAgent();
    return NextResponse.json({ ok: true, ...result });
  } catch (err: any) {
    console.error('[paper-trade/run] Unexpected error:', err);
    return NextResponse.json(
      { ok: false, error: String(err?.message ?? err) },
      { status: 500 }
    );
  } finally {
    await releaseLock();
  }
}
