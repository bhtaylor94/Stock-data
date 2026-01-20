import { NextResponse } from 'next/server';
import { UNIVERSE } from '@/lib/market/universe';
import { runStrategiesForSymbol } from '@/lib/strategies/runner';
import { saveSignal } from '@/lib/storage/signals';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST() {
  let signals = 0;

  for (const symbol of UNIVERSE) {
    const signal = await runStrategiesForSymbol(symbol);
    if (signal) {
      await saveSignal(signal);
      signals++;
    }
  }

  return NextResponse.json({ ok: true, scanned: UNIVERSE.length, signals });
}
