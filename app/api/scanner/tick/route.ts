import { NextRequest, NextResponse } from 'next/server';
import { evaluateStrategySignal } from '@/strategies/engine';
import { STRATEGY_REGISTRY, type PresetId } from '@/strategies/registry';
import { DEFAULT_UNIVERSE } from '@/lib/universe/top100';
import { storeSignalsTick } from '@/lib/firebase/signals';

export const runtime = 'nodejs';

function asStr(v: any): string {
  return (v || '').toString().trim();
}

function isVercelCron(req: NextRequest): boolean {
  // Vercel adds this header for Cron invocations.
  return !!req.headers.get('x-vercel-cron');
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const presetId = (asStr(url.searchParams.get('presetId') || 'balanced') as PresetId) || 'balanced';
  const mode = (asStr(url.searchParams.get('mode') || 'paper') as 'paper' | 'live');
  const maxSymbols = Math.min(150, Math.max(1, parseInt(asStr(url.searchParams.get('maxSymbols') || '100')) || 100));
  const minConfidence = Math.min(100, Math.max(0, parseInt(asStr(url.searchParams.get('minConfidence') || '60')) || 60));
  const allow = (process.env.ALLOW_SCANNER || '').toString();

  // Allow either Vercel Cron header OR explicit allow env (useful for local testing)
  if (!isVercelCron(req) && allow !== 'true') {
    return NextResponse.json({ ok: false, error: 'Scanner disabled (set ALLOW_SCANNER=true or invoke via Vercel Cron)' }, { status: 403 });
  }

  const universe = DEFAULT_UNIVERSE.slice(0, maxSymbols);
  const strategyIds = STRATEGY_REGISTRY.map((s) => s.id);

  const out: any[] = [];

  // Sequential to reduce API pressure.
  for (const strategyId of strategyIds) {
    for (const symbol of universe) {
      try {
        const r = await evaluateStrategySignal({ symbol, strategyId, presetId, mode });
        if (r?.ok && r?.signal) {
          const conf = Number(r.signal.confidence || 0);
          if (conf >= minConfidence) out.push(r.signal);
        }
      } catch (e) {
        // ignore per-symbol failures
      }
    }
  }

  out.sort((a, b) => (Number(b?.confidence || 0) - Number(a?.confidence || 0)));

  // Keep the payload modest and UI-friendly.
  const top = out.slice(0, 200);

  const stored = await storeSignalsTick(top);
  if (!stored.ok) {
    return NextResponse.json({ ok: false, error: stored.error, count: top.length }, { status: 500 });
  }

  return NextResponse.json({ ok: true, tickId: stored.tickId, count: stored.count }, { status: 200 });
}
