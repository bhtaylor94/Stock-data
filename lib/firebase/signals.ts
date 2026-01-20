import type { Signal } from '@/types/signal';
import { getAdminDb } from '@/lib/firebase/admin';

export type StoreSignalsResult = { ok: true; tickId: string; count: number } | { ok: false; error: string };

function isoMinute(ts: number): string {
  const d = new Date(ts);
  d.setSeconds(0, 0);
  return d.toISOString();
}

export async function storeSignalsTick(signals: Signal[], opts?: { tickId?: string }) : Promise<StoreSignalsResult> {
  try {
    const db = getAdminDb();
    const tickId = (opts?.tickId || isoMinute(Date.now())).replace(/[:.]/g, '-');

    const tickRef = db.collection('signal_ticks').doc(tickId);
    await tickRef.set({
      tickId,
      createdAt: Date.now(),
      createdIso: new Date().toISOString(),
      count: signals.length,
    }, { merge: true });

    const batch = db.batch();
    // write signals as subcollection documents
    const sigCol = tickRef.collection('signals');
    signals.forEach((s, idx) => {
      const id = [String(idx).padStart(3,'0'), s.strategyId, s.symbol, s.action].join('_');
      batch.set(sigCol.doc(id), {
        ...s,
        createdAt: Date.now(),
      });
    });

    // also maintain a compact latest snapshot
    const latestRef = db.collection('signals_latest').doc('latest');
    batch.set(latestRef, {
      tickId,
      updatedAt: Date.now(),
      signals: signals.slice(0, 200),
    }, { merge: true });

    await batch.commit();
    return { ok: true, tickId, count: signals.length };
  } catch (e: any) {
    return { ok: false, error: String(e?.message || e) };
  }
}

export async function loadLatestSignals(limit: number = 200) {
  const db = getAdminDb();
  const snap = await db.collection('signals_latest').doc('latest').get();
  const d = snap.data() || {};
  const arr = Array.isArray((d as any).signals) ? (d as any).signals : [];
  return { tickId: (d as any).tickId || null, updatedAt: (d as any).updatedAt || null, signals: arr.slice(0, limit) };
}
