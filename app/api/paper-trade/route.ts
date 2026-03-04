import { NextRequest, NextResponse } from 'next/server';
import {
  loadPortfolio,
  loadPositions,
  loadLog,
  loadEquity,
  resetPaperTrading,
} from '@/lib/paperTradingStore';
import { isRedisAvailable } from '@/lib/redis';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/paper-trade — full state for dashboard */
export async function GET() {
  const redisAvailable = isRedisAvailable();

  // Ping Redis so connection errors are visible in the response
  let redisPing: string = 'skip';
  if (redisAvailable) {
    try {
      const { getRedis } = await import('@/lib/redis');
      await getRedis().ping();
      redisPing = 'ok';
    } catch (err: any) {
      redisPing = `FAIL: ${String(err?.message ?? err)}`;
    }
  }

  try {
    const [portfolio, positions, log, equity] = await Promise.all([
      loadPortfolio(),
      loadPositions(),
      loadLog(),
      loadEquity(),
    ]);
    return NextResponse.json(
      { portfolio, positions, log, equity, redisConnected: redisAvailable, redisPing },
      { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate' } }
    );
  } catch (err: any) {
    console.error('[paper-trade] GET error:', err);
    return NextResponse.json({ error: String(err?.message ?? err), redisPing }, { status: 500 });
  }
}

/** DELETE /api/paper-trade?secret=X — reset to clean $25K slate */
export async function DELETE(req: NextRequest) {
  const secret   = req.nextUrl.searchParams.get('secret');
  const expected = process.env.PAPER_TRADE_SECRET;

  if (!expected || !expected.trim()) {
    return NextResponse.json({ error: 'PAPER_TRADE_SECRET not configured' }, { status: 500 });
  }
  if (!secret || secret !== expected.trim()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await resetPaperTrading();
    return NextResponse.json({ ok: true, message: 'Paper trading account reset to $25,000' });
  } catch (err: any) {
    console.error('[paper-trade] DELETE error:', err);
    return NextResponse.json({ error: String(err?.message ?? err) }, { status: 500 });
  }
}
