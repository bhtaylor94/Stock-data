import { NextRequest, NextResponse } from 'next/server';
import { evaluateStrategySignal } from '@/strategies/engine';
import { STRATEGY_REGISTRY, type PresetId, type StrategyId } from '@/strategies/registry';

export const runtime = 'nodejs';

function asStr(v: any): string {
  return (v || '').toString().trim();
}

function parseSymbols(v: string): string[] {
  return v
    .split(',')
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean)
    .slice(0, 25);
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const symbols = parseSymbols(asStr(url.searchParams.get('symbols') || ''));
  const presetId = (asStr(url.searchParams.get('presetId') || 'balanced') as PresetId) || 'balanced';
  const mode = (asStr(url.searchParams.get('mode')) || 'paper') as 'paper' | 'live';
  const minConfidence = parseInt(asStr(url.searchParams.get('minConfidence') || '0')) || 0;

  const strategyIdsRaw = asStr(url.searchParams.get('strategyIds') || '');
  const strategyIds = (strategyIdsRaw
    ? strategyIdsRaw.split(',').map((s) => s.trim()).filter(Boolean)
    : STRATEGY_REGISTRY.map((s) => s.id)) as StrategyId[];

  if (!symbols.length) {
    return NextResponse.json({ ok: false, error: 'Missing symbols' }, { status: 400 });
  }

  // Run sequentially to reduce rate-limit pressure on market data.
  const out: any[] = [];
  for (const strategyId of strategyIds) {
    for (const symbol of symbols) {
      const r = await evaluateStrategySignal({ symbol, strategyId, presetId, mode });
      if (r?.ok && r?.signal) {
        const conf = Number(r.signal.confidence || 0);
        if (conf >= minConfidence) out.push(r.signal);
      }
    }
  }

  out.sort((a, b) => (Number(b?.confidence || 0) - Number(a?.confidence || 0)));
  return NextResponse.json({ ok: true, signals: out }, { status: 200 });
}
