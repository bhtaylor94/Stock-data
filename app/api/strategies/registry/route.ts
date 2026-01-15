import { NextResponse } from 'next/server';
import { STRATEGY_REGISTRY } from '@/strategies/registry';

export const runtime = 'nodejs';

export async function GET() {
  return NextResponse.json({ ok: true, strategies: STRATEGY_REGISTRY });
}
