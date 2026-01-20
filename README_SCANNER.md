Market Scanner v1 (Fixed2)

Fixes:
- Adds lib/firebase/admin.ts used by lib/storage/signals.ts
- Keeps tsconfig path alias @/* working on Vercel
- Scanner endpoint runs in Node runtime (firebase-admin required)

Endpoint:
POST /api/scanner/run

Free Vercel compatible:
- No cron required; trigger manually for now.
