import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore as _getFirestore } from 'firebase-admin/firestore';

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

export function getFirestore() {
  if (!getApps().length) {
    const projectId = required('FIREBASE_PROJECT_ID');
    const clientEmail = required('FIREBASE_CLIENT_EMAIL');
    const privateKeyRaw = required('FIREBASE_PRIVATE_KEY');
    const privateKey = privateKeyRaw.replace(/\\n/g, '\n');

    initializeApp({
      credential: cert({ projectId, clientEmail, privateKey }),
    });
  }
  return _getFirestore();
}
