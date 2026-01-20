import { getFirestore } from '@/lib/firebase/admin';

export async function saveSignal(signal: any) {
  const db = getFirestore();
  await db.collection('signals').add(signal);
}
