import { NextResponse } from 'next/server';
import { listAlertEvents, clearAlertEvents } from '@/lib/alertsStore';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const limit = Number(url.searchParams.get('limit') || '50');
    const events = await listAlertEvents(limit);
    return NextResponse.json({ ok: true, events });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || '').toUpperCase();
    if (action === 'CLEAR') {
      await clearAlertEvents();
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ ok: false, error: 'Unsupported action' }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}
