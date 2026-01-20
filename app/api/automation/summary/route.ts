import { NextRequest, NextResponse } from 'next/server';
import { getAutomationRiskSummary } from '@/lib/automationRiskSummary';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const scope = String(searchParams.get('scope') || 'autopilot');
    const autopilotOnly = scope !== 'all';

    const summary = await getAutomationRiskSummary({ autopilotOnly });
    return NextResponse.json({ ok: true, summary });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}
