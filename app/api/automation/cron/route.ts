import { NextResponse } from 'next/server';
import { runAutopilotTick } from '@/lib/autopilot';

export const dynamic = 'force-dynamic';

function isVercelCron(req: Request): boolean {
  // Vercel adds this header for Cron invocations.
  const h = req.headers;
  const flag = h.get('x-vercel-cron');
  return Boolean(flag && flag.trim());
}

export async function GET(req: Request) {
  try {
    // Disabled by default
    if (process.env.AUTOMATION_CRON_ENABLED !== 'true') {
      return NextResponse.json({ ok: false, error: 'Cron disabled (set AUTOMATION_CRON_ENABLED=true).' }, { status: 403 });
    }

    // Only allow Vercel Cron (prevents casual public hits)
    if (!isVercelCron(req)) {
      return NextResponse.json({ ok: false, error: 'Forbidden.' }, { status: 403 });
    }

    const result = await runAutopilotTick({ dryRun: false });
    return NextResponse.json({ ok: true, ...result });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}
