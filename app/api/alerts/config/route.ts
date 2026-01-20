import { NextResponse } from 'next/server';
import { loadAlertsStore, saveAlertsConfig, normalizeList } from '@/lib/alertsStore';

export async function GET() {
  try {
    const store = await loadAlertsStore();
    return NextResponse.json({ ok: true, config: store.config });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const patch: any = {
      enabled: typeof body.enabled === 'boolean' ? body.enabled : undefined,
      minConfidence: body.minConfidence,
      includePaper: typeof body.includePaper === 'boolean' ? body.includePaper : undefined,
      includeLiveConfirm: typeof body.includeLiveConfirm === 'boolean' ? body.includeLiveConfirm : undefined,
      includeLiveAuto: typeof body.includeLiveAuto === 'boolean' ? body.includeLiveAuto : undefined,
      webhookUrl: typeof body.webhookUrl === 'string' ? body.webhookUrl : undefined,
    };
    if (body.symbols !== undefined) patch.symbols = normalizeList(body.symbols);
    if (body.strategies !== undefined) patch.strategies = Array.isArray(body.strategies) ? body.strategies : normalizeList(body.strategies);

    if (patch.minConfidence !== undefined) {
      const v = Math.max(0, Math.min(100, Number(patch.minConfidence || 0)));
      patch.minConfidence = v;
    }

    const config = await saveAlertsConfig(patch);
    return NextResponse.json({ ok: true, config });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}
