import { NextResponse } from 'next/server';
import { fetchFundamentals } from '@/lib/external/fundamentals';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const symbol = String(searchParams.get('symbol') || '').trim();
    if (!symbol) return NextResponse.json({ ok: false, error: 'symbol required' }, { status: 400 });
    const snap = await fetchFundamentals(symbol);
    return NextResponse.json({ ok: true, symbol: symbol.toUpperCase(), fundamentals: snap });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}
