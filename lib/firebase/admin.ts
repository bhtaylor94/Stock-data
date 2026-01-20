import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

function mustEnv(name: string): string {
  const v = (process.env[name] || '').toString();
  if (!v) throw new Error(['Missing env var: ', name].join(''));
  return v;
}

export function getAdminDb() {
  if (!getApps().length) {
    const projectId = mustEnv('FIREBASE_PROJECT_ID');
    const clientEmail = mustEnv('FIREBASE_CLIENT_EMAIL');
    const privateKeyRaw = mustEnv('FIREBASE_PRIVATE_KEY');
    const privateKey = privateKeyRaw.replace(/\\n/g, '\n');

    initializeApp({
      credential: cert({ projectId, clientEmail, privateKey }),
    });
  }

  return getFirestore();
}
