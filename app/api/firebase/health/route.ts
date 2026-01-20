import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase/admin';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const db = getAdminDb();
    const ref = db.collection('health').doc('ping');
    await ref.set({ ok: true, ts: Date.now() }, { merge: true });
    const snap = await ref.get();
    return NextResponse.json({ ok: true, data: snap.data() || null });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: String(e?.message || e) },
      { status: 500 }
    );
  }
}
