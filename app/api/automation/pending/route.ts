import { NextRequest, NextResponse } from 'next/server';

import type { Signal } from '@/strategies/signalTypes';
import type { PresetId, StrategyId } from '@/strategies/registry';
import { loadAutomationConfig, isLiveArmed } from '@/lib/automationStore';
import { placeMarketEquityOrder } from '@/lib/liveOrders';
import { getPendingApproval, loadPendingApprovals, updatePendingApproval } from '@/lib/pendingApprovalsStore';
import { upsertSuggestion } from '@/lib/trackerStore';

export const runtime = 'nodejs';

function nowIso(): string {
  return new Date().toISOString();
}

function signalToTrackedSuggestion(signal: Signal, presetId: PresetId) {
  const entry = Number(signal.tradePlan?.entry);
  const stop = Number(signal.tradePlan?.stop);
  const target = Number(signal.tradePlan?.target);
  if (!Number.isFinite(entry) || !Number.isFinite(stop) || !Number.isFinite(target)) return null;

  return {
    id: `${signal.symbol}-${signal.strategyId}-${Date.now()}`,
    ticker: signal.symbol,
    type: signal.action === 'BUY' ? 'STOCK_BUY' : signal.action === 'SELL' ? 'STOCK_SELL' : 'NO_TRADE',
    strategy: signal.strategyName,
    setup: signal.strategyId,
    entryPrice: entry,
    targetPrice: target,
    stopLoss: stop,
    confidence: Number(signal.confidence || 0),
    reasoning: Array.isArray(signal.why) ? signal.why.slice(0, 3) : [],
    status: 'ACTIVE' as const,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    evidencePacket: {
      kind: 'live_confirm_approval_v1',
      capturedAt: nowIso(),
      presetId,
      signal,
    },
  };
}

export async function GET() {
  try {
    const all = await loadPendingApprovals();
    const pending = all.filter((x) => x.status === 'PENDING').slice(0, 100);
    return NextResponse.json({ ok: true, pending });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const id = String(body?.id || '').trim();
    const action = String(body?.action || '').toUpperCase();
    if (!id) return NextResponse.json({ ok: false, error: 'Missing id' }, { status: 400 });
    if (action !== 'APPROVE' && action !== 'DECLINE') return NextResponse.json({ ok: false, error: 'Invalid action' }, { status: 400 });

    const item = await getPendingApproval(id);
    if (!item) return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 });
    if (item.status !== 'PENDING') return NextResponse.json({ ok: false, error: 'Not pending' }, { status: 400 });

    if (action === 'DECLINE') {
      const updated = await updatePendingApproval(id, { status: 'DECLINED' });
      return NextResponse.json({ ok: true, pending: updated });
    }

    // APPROVE: enforce LIVE gates at approval-time
    const cfg = await loadAutomationConfig();
    const envGate = process.env.ALLOW_LIVE_AUTOPILOT === 'true';
    if (!envGate) return NextResponse.json({ ok: false, error: 'LIVE blocked: set ALLOW_LIVE_AUTOPILOT=true' }, { status: 400 });
    if (!isLiveArmed(cfg)) return NextResponse.json({ ok: false, error: 'LIVE blocked: not armed (arm window expired)' }, { status: 400 });

    if (cfg.autopilot.requireLiveAllowlist) {
      const allow = (cfg.autopilot.liveAllowlistSymbols || []).map((s: any) => String(s).trim().toUpperCase()).filter(Boolean);
      if (allow.length && !allow.includes(String(item.symbol).toUpperCase())) {
        return NextResponse.json({ ok: false, error: 'LIVE allowlist blocked this symbol' }, { status: 400 });
      }
    }

    const instruction = item.action;
    const qty = Math.max(1, Math.min(1000, Number(item.quantity || 1)));

    const placed = await placeMarketEquityOrder(item.symbol, qty, instruction);
    const orderId = placed.orderId;

    const tracked = signalToTrackedSuggestion(item.signal as Signal, item.presetId as PresetId);
    if (tracked) {
      tracked.evidencePacket = { ...(tracked.evidencePacket || {}), orderId } as any;
      await upsertSuggestion(tracked as any);
    }

    const updated = await updatePendingApproval(id, {
      status: 'APPROVED',
      orderId,
      executedAt: nowIso(),
    });

    return NextResponse.json({ ok: true, pending: updated, orderId, trackedId: tracked?.id });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}
