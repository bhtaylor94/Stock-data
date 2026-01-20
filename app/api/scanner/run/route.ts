import { NextResponse } from 'next/server';
import { UNIVERSE } from '@/lib/market/universe';
import { runStrategiesForSymbol } from '@/lib/strategies/runner';
import { saveSignal } from '@/lib/storage/signals';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST() {
  let count = 0;
  for (const symbol of UNIVERSE) {
    const signal = await runStrategiesForSymbol(symbol);
    await saveSignal(signal);
    count++;
  }
  return NextResponse.json({ ok: true, scanned: UNIVERSE.length, saved: count });
}
