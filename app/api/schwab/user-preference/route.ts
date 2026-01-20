import { NextResponse } from 'next/server';
import { getUserPreference } from '@/lib/schwabBroker';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const preference = await getUserPreference();
    return NextResponse.json({ success: true, preference, meta: { asOf: new Date().toISOString() } });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: String(e?.message || e) }, { status: 500 });
  }
}
