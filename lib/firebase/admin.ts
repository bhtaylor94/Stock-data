import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore as _getFirestore } from 'firebase-admin/firestore';

export function getFirestore() {
  if (!getApps().length) {
    const projectId = process.env.FIREBASE_PROJECT_ID!;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL!;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY!.replace(/\\n/g, '\n');
    initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
  }
  return _getFirestore();
}
