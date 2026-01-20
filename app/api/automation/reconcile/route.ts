import { NextResponse } from 'next/server';
import { reconcileSchwabOrders } from '@/lib/orderReconciler';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const lookbackDays = Number(searchParams.get('lookbackDays') || 7);
    const maxResults = Number(searchParams.get('maxResults') || 200);
    const result = await reconcileSchwabOrders({ lookbackDays, maxResults });
    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}
