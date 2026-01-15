import { NextRequest, NextResponse } from 'next/server';
import { evaluateStrategySignal } from '@/strategies/engine';
import type { PresetId, StrategyId } from '@/strategies/registry';

export const runtime = 'nodejs';

function asStr(v: any): string {
  return (v || '').toString().trim();
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const symbol = asStr(url.searchParams.get('symbol') || url.searchParams.get('ticker')).toUpperCase();
  const strategyId = asStr(url.searchParams.get('strategyId')) as StrategyId;
  const presetId = asStr(url.searchParams.get('presetId') || 'balanced') as PresetId;
  const mode = (asStr(url.searchParams.get('mode')) || 'paper') as 'paper' | 'live';

  if (!symbol || !strategyId) {
    return NextResponse.json({ ok: false, error: 'Missing symbol or strategyId' }, { status: 400 });
  }

  const r = await evaluateStrategySignal({ symbol, strategyId, presetId, mode });
  return NextResponse.json(r, { status: r.ok ? 200 : (r.status || 500) });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const symbol = asStr(body.symbol || body.ticker).toUpperCase();
    const strategyId = asStr(body.strategyId) as StrategyId;
    const presetId = asStr(body.presetId || 'balanced') as PresetId;
    const mode = (asStr(body.mode) || 'paper') as 'paper' | 'live';

    if (!symbol || !strategyId) {
      return NextResponse.json({ ok: false, error: 'Missing symbol or strategyId' }, { status: 400 });
    }

    const r = await evaluateStrategySignal({ symbol, strategyId, presetId, mode });
    return NextResponse.json(r, { status: r.ok ? 200 : (r.status || 500) });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'Invalid request' }, { status: 400 });
  }
}
