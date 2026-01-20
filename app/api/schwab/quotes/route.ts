import { NextRequest, NextResponse } from 'next/server';
import { getQuotes } from '@/lib/schwabMarketData';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const symbolsParam = searchParams.get('symbols') || '';
    const symbols = symbolsParam.split(',').map(s => String(s || '').trim()).filter(Boolean);

    const quotes = await getQuotes(symbols);
    return NextResponse.json({ success: true, quotes, meta: { asOf: new Date().toISOString() } });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: String(e?.message || e) }, { status: 500 });
  }
}
