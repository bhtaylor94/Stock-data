import { getFirestore } from '@/lib/firebase/admin';

export async function saveSignal(signal: any) {
  const db = getFirestore();
  const ref = db.collection('signals').doc();
  await ref.set({
    ...signal,
    createdAt: Date.now()
  });
}
