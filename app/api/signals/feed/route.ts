import { NextResponse } from 'next/server';
import { loadLatestSignals } from '@/lib/firebase/signals';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const r = await loadLatestSignals(200);
    return NextResponse.json({ ok: true, source: 'FIRESTORE', ...r }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}
