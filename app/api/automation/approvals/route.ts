import { NextResponse } from 'next/server';

import { listPendingApprovals, updateApproval } from '@/lib/pendingApprovalsStore';
import { placeMarketEquityOrder } from '@/lib/liveOrders';
import { loadAutomationConfig, isLiveArmed } from '@/lib/automationStore';
import { upsertSuggestion } from '@/lib/trackerStore';
import { STRATEGY_REGISTRY } from '@/strategies/registry';

function nowIso(): string {
  return new Date().toISOString();
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const limit = Math.max(1, Math.min(200, Number(url.searchParams.get('limit') || 50)));
  const pending = await listPendingApprovals(limit);
  return NextResponse.json({ ok: true, approvals: pending });
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const action = String(body.action || '').toUpperCase();
    const approvalId = String(body.approvalId || '').trim();
    const note = String(body.note || '').trim();
    if (!approvalId) return NextResponse.json({ ok: false, error: 'Missing approvalId' }, { status: 400 });
    if (action !== 'APPROVE' && action !== 'REJECT') return NextResponse.json({ ok: false, error: 'Invalid action' }, { status: 400 });

    // Load current pending approvals and locate the requested one.
    const pending = await listPendingApprovals(200);
    const appr = pending.find((a) => a.id === approvalId) || null;
    if (!appr) return NextResponse.json({ ok: false, error: 'Approval not found (or not pending).' }, { status: 404 });

    if (action === 'REJECT') {
      const updated = await updateApproval(approvalId, {
        status: 'REJECTED',
        decidedAt: nowIso(),
        decisionNote: note || 'Rejected',
      });
      return NextResponse.json({ ok: true, approval: updated });
    }

    // APPROVE: enforce LIVE safety gates again
    const cfg = await loadAutomationConfig();
    if (cfg.autopilot.mode !== 'LIVE') {
      return NextResponse.json({ ok: false, error: 'Autopilot is not in LIVE mode.' }, { status: 400 });
    }
    if (process.env.ALLOW_LIVE_AUTOPILOT !== 'true') {
      return NextResponse.json({ ok: false, error: 'LIVE blocked: set ALLOW_LIVE_AUTOPILOT=true' }, { status: 403 });
    }
    if (!isLiveArmed(cfg)) {
      return NextResponse.json({ ok: false, error: 'LIVE blocked: not armed (arm window expired).' }, { status: 403 });
    }
    if (cfg.autopilot.requireLiveAllowlist) {
      const allow = (cfg.autopilot.liveAllowlistSymbols || []).map((s) => String(s).trim().toUpperCase()).filter(Boolean);
      if (allow.length && !allow.includes(appr.symbol)) {
        return NextResponse.json({ ok: false, error: 'LIVE allowlist blocked this symbol.' }, { status: 403 });
      }
    }

    // Place the order
    const placed = await placeMarketEquityOrder(appr.symbol, appr.quantity, appr.instruction);

    // Track it (same shape as autopilot tracking)
    const entry = Number(appr.signal.tradePlan?.entry);
    const stop = Number(appr.signal.tradePlan?.stop);
    const target = Number(appr.signal.tradePlan?.target);
    const strat = STRATEGY_REGISTRY.find((s) => s.id === appr.strategyId);
    const trackedId = `${appr.signal.symbol}-${appr.signal.strategyId}-${Date.now()}`;
    if (Number.isFinite(entry) && Number.isFinite(stop) && Number.isFinite(target)) {
      await upsertSuggestion({
        id: trackedId,
        ticker: appr.signal.symbol,
        type: appr.signal.action === 'BUY' ? 'STOCK_BUY' : appr.signal.action === 'SELL' ? 'STOCK_SELL' : 'NO_TRADE',
        strategy: appr.signal.strategyName,
        setup: appr.signal.strategyId,
        regime: (strat?.marketRegimes || [])[0],
        entryPrice: entry,
        targetPrice: target,
        stopLoss: stop,
        confidence: Number(appr.signal.confidence || 0),
        reasoning: Array.isArray(appr.signal.why) ? appr.signal.why.slice(0, 3) : [],
        status: 'ACTIVE',
        createdAt: nowIso(),
        updatedAt: nowIso(),
        evidencePacket: {
          kind: 'autopilot_signal_v1',
          capturedAt: nowIso(),
          presetId: appr.presetId,
          signal: appr.signal,
          orderId: placed.orderId,
          approvalId,
        },
      } as any);
    }

    const updated = await updateApproval(approvalId, {
      status: 'APPROVED',
      decidedAt: nowIso(),
      decisionNote: note || 'Approved',
      orderId: placed.orderId,
      trackedId,
    });

    return NextResponse.json({ ok: true, approval: updated, orderId: placed.orderId, trackedId });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}
