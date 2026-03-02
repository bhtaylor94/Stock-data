import { NextRequest, NextResponse } from 'next/server';
import { getSchwabAccessToken, SCHWAB_HEADERS } from '@/lib/schwab';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
  { params }: { params: { symbol: string } },
) {
  const symbol = decodeURIComponent(params.symbol);

  const tokenResult = await getSchwabAccessToken('options');
  if (!tokenResult.token) {
    return NextResponse.json({ error: 'Auth failed' }, { status: 503 });
  }

  try {
    // Fetch today's 5-min OHLCV candles for the specific options contract.
    // Schwab pricehistory accepts OCC-format option symbols (e.g. "NVDA  260402C00200000").
    const url =
      `https://api.schwabapi.com/marketdata/v1/pricehistory` +
      `?symbol=${encodeURIComponent(symbol)}` +
      `&periodType=day&period=1` +
      `&frequencyType=minute&frequency=5` +
      `&needExtendedHoursData=false`;

    const res = await fetch(url, {
      headers: { ...SCHWAB_HEADERS, Authorization: `Bearer ${tokenResult.token}` },
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      console.error(`[ContractHistory] Schwab ${res.status} for ${symbol}: ${text.slice(0, 200)}`);
      return NextResponse.json({ error: `Schwab ${res.status}`, candles: [] }, { status: res.status });
    }

    const raw = await res.json();

    const candles = (raw.candles ?? []).map((c: any) => ({
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
      volume: c.volume ?? 0,
      datetime: c.datetime, // Unix milliseconds
    }));

    return NextResponse.json({
      symbol,
      candles,
      empty: raw.empty ?? candles.length === 0,
    });
  } catch (err: any) {
    console.error('[ContractHistory] Error:', err);
    return NextResponse.json({ error: err.message, candles: [] }, { status: 500 });
  }
}
