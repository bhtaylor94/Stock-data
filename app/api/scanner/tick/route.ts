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
  return Boolean(req.headers.get('x-vercel-cron'));
}

function isAuthorized(req: NextRequest): boolean {
  const url = new URL(req.url);
  const token = asStr(url.searchParams.get('token'));
  const tokenEnv = asStr(process.env.SCANNER_TOKEN);
  if (tokenEnv && token && token === tokenEnv) return true;

  const allow = asStr(process.env.ALLOW_SCANNER);
  if (allow === 'true') return true;

  const allowPublic = asStr(process.env.ALLOW_PUBLIC_SCANNER);
  if (allowPublic === 'true') return true;

  return isVercelCron(req);
}

export async function POST(req: NextRequest) {
  try {
    if (!isAuthorized(req)) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'Scanner tick blocked. Set ALLOW_SCANNER=true for manual runs, or set ALLOW_PUBLIC_SCANNER=true for UI-triggered runs, or pass ?token=... matching SCANNER_TOKEN.',
        },
        { status: 403 }
      );
    }

    const url = new URL(req.url);
    const preset = (url.searchParams.get('preset') || 'Balanced') as PresetId;

    const strategies = Object.values(STRATEGY_REGISTRY);
    const universe = DEFAULT_UNIVERSE;

    const signals: any[] = [];

    for (const sym of universe) {
      for (const strat of strategies) {
        try {
          const s = await evaluateStrategySignal({
            strategyId: strat.id,
            symbol: sym,
            preset,
          });
          if (s && s.action && s.action !== 'NO_TRADE') signals.push(s);
        } catch {
          // ignore per-symbol failures
        }
      }
    }

    const top = signals
      .sort((a, b) => Number(b?.confidence || 0) - Number(a?.confidence || 0))
      .slice(0, 50);

    await storeSignalsTick({
      universeSize: universe.length,
      strategies: strategies.map((s: any) => ({ id: s.id, name: s.name })),
      signals: top,
      preset,
      ranAt: Date.now(),
    });

    return NextResponse.json({
      ok: true,
      preset,
      scanned: universe.length,
      strategies: strategies.length,
      storedSignals: top.length,
      ranAt: Date.now(),
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: String(e?.message || e) },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  // allow quick browser testing
  return POST(req);
}
