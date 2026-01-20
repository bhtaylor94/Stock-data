import { NextResponse } from 'next/server';
import { getApps, initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

function getDb() {
  if (!getApps().length) {
    const projectId = process.env.FIREBASE_PROJECT_ID || '';
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL || '';
    const privateKeyRaw = process.env.FIREBASE_PRIVATE_KEY || '';
    const privateKey = privateKeyRaw.replace(/\\n/g, '\n');

    initializeApp({
      credential: cert({ projectId, clientEmail, privateKey }),
    });
  }

  return getFirestore();
}

export async function GET() {
  try {
    const db = getDb();
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
