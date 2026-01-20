import { NextResponse } from 'next/server';
import { listAutomationRuns } from '@/lib/automationRunsStore';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const limit = Math.max(1, Math.min(200, Number(url.searchParams.get('limit') || 25)));
    const runs = await listAutomationRuns(limit);
    return NextResponse.json({ ok: true, runs });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}
