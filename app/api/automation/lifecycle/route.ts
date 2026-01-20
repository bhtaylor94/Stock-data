import { NextRequest, NextResponse } from 'next/server';
import { loadAutomationConfig } from '@/lib/automationStore';
import { runTradeLifecycleSweep } from '@/lib/tradeLifecycle';

export const runtime = 'nodejs';

// Manual trigger for the trade lifecycle manager.
// GET /api/automation/lifecycle?dryRun=true
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const dryRun = url.searchParams.get('dryRun') === 'true';
    const cfg = await loadAutomationConfig();

    const r: any = await runTradeLifecycleSweep({
      dryRun,
      autopilotOnly: true,
      timeStopDays: Number((cfg.autopilot as any).timeStopDays ?? 10),
      enableTrailing: Boolean((cfg.autopilot as any).enableTrailingStop ?? true),
      trailAfterR: Number((cfg.autopilot as any).trailAfterR ?? 1),
      trailLockInR: Number((cfg.autopilot as any).trailLockInR ?? 0.1),
    });

    const { ok: _ignored, ...rest } = r || {};
    return NextResponse.json({ ok: true, ...rest });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}
