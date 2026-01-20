'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { SignalsFeed } from '@/app/components/signals/SignalsFeed';

type AutomationConfigResponse = { ok: boolean; config?: any; error?: string };
type ApprovalsResponse = { ok: boolean; approvals?: any[]; error?: string };

function fmtPct(x: any): string {
  const n = Number(x);
  if (!Number.isFinite(n)) return '-';
  return `${Math.round(n * 100)}%`;
}

function StatusPill({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-800 bg-slate-900/30">
      <div className="text-xs text-slate-400">{label}</div>
      <div className="text-xs font-semibold text-slate-100">{value}</div>
    </div>
  );
}

function PendingApprovalsPanel() {
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<any[]>([]);
  const [error, setError] = useState<string>('');

  async function refresh() {
    setLoading(true);
    setError('');
    try {
      const r = await fetch('/api/automation/approvals', { cache: 'no-store' });
      const j = (await r.json()) as ApprovalsResponse;
      if (!j.ok) throw new Error(j.error || 'Failed to load approvals');
      setRows(Array.isArray(j.approvals) ? j.approvals : []);
    } catch (e: any) {
      setError(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function act(approvalId: string, action: 'APPROVE' | 'REJECT') {
    try {
      const r = await fetch('/api/automation/approvals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approvalId, action }),
      });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || 'Action failed');
      void refresh();
    } catch (e: any) {
      alert(String(e?.message || e));
    }
  }

  const pending = useMemo(() => rows.filter((r) => String(r.status || '').toUpperCase() === 'PENDING'), [rows]);

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/20 p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-bold">Pending approvals</div>
          <div className="text-xs text-slate-400">Only used in LIVE_CONFIRM. Approve places the order.</div>
        </div>
        <button
          className="text-xs font-semibold px-3 py-2 rounded-lg border border-slate-700 bg-slate-900/40 hover:bg-slate-900"
          onClick={refresh}
          disabled={loading}
        >
          Refresh
        </button>
      </div>

      {error ? <div className="mt-3 text-xs text-red-300">{error}</div> : null}

      <div className="mt-4 space-y-3">
        {pending.length === 0 ? (
          <div className="text-sm text-slate-400">No pending approvals.</div>
        ) : (
          pending.slice(0, 20).map((a) => (
            <div key={a.id} className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-bold">
                    {a.symbol} <span className="text-slate-400">•</span> {String(a.strategyName || a.strategyId || 'Strategy')}
                  </div>
                  <div className="mt-1 text-xs text-slate-400">
                    Conf {Number(a.confidence || 0).toFixed(0)} • Qty {Number(a.quantity || 1)} • {String(a.executionInstrument || 'STOCK')}
                  </div>
                  {a.selectedOptionContract ? (
                    <div className="mt-2 text-xs text-slate-300">
                      Option: {String(a.selectedOptionContract.optionSymbol || '')} • {String(a.selectedOptionContract.optionType || '')} {String(a.selectedOptionContract.strike || '')} • Exp {String(a.selectedOptionContract.expiration || '')}
                    </div>
                  ) : null}
                  <div className="mt-2 text-xs text-slate-300">
                    Why: {Array.isArray(a.why) ? a.why.join(' • ') : Array.isArray(a.signal?.why) ? a.signal.why.join(' • ') : '-'}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    className="text-xs font-bold px-3 py-2 rounded-lg bg-emerald-600/80 hover:bg-emerald-600"
                    onClick={() => act(String(a.id), 'APPROVE')}
                  >
                    Approve
                  </button>
                  <button
                    className="text-xs font-bold px-3 py-2 rounded-lg bg-rose-600/70 hover:bg-rose-600"
                    onClick={() => act(String(a.id), 'REJECT')}
                  >
                    Decline
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default function ConsolePage() {
  const [cfg, setCfg] = useState<any>(null);
  const [cfgErr, setCfgErr] = useState<string>('');

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch('/api/automation/config', { cache: 'no-store' });
        const j = (await r.json()) as AutomationConfigResponse;
        if (!j.ok) throw new Error(j.error || 'Failed to load automation config');
        setCfg(j.config || null);
      } catch (e: any) {
        setCfgErr(String(e?.message || e));
      }
    })();
  }, []);

  const mode = String(cfg?.autopilot?.mode || 'OFF');
  const execInstr = String(cfg?.autopilot?.executionInstrument || 'STOCK');
  const opt = cfg?.autopilot?.options || {};

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-800 bg-slate-900/20 p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-lg font-black">Console</div>
            <div className="text-sm text-slate-400">
              This is a strategy-first automation platform. Signals are produced by strategies, gated by safety rules, then executed and managed.
            </div>
          </div>
          <Link
            href="/settings"
            className="text-xs font-bold px-3 py-2 rounded-lg border border-slate-700 bg-slate-900/40 hover:bg-slate-900"
          >
            Settings
          </Link>
        </div>

        {cfgErr ? <div className="mt-3 text-xs text-red-300">{cfgErr}</div> : null}

        <div className="mt-4 flex flex-wrap gap-2">
          <StatusPill label="Autopilot" value={mode} />
          <StatusPill label="Execution" value={execInstr} />
          {execInstr === 'OPTION' ? (
            <>
              <StatusPill label="Max spend" value={`$${Number(opt.maxPremiumNotionalUSD || 0).toFixed(0)}`} />
              <StatusPill label="TP" value={fmtPct(opt.takeProfitPct)} />
              <StatusPill label="SL" value={fmtPct(opt.stopLossPct)} />
              <StatusPill label="Max contracts" value={String(opt.maxContractsPerTrade ?? '-')} />
            </>
          ) : null}
        </div>
      </div>

      <PendingApprovalsPanel />

      <div className="rounded-2xl border border-slate-800 bg-slate-900/20 p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-bold">Signals</div>
            <div className="text-xs text-slate-400">Grouped by strategy, sorted by confidence. Open a signal to see the trade plan and why.</div>
          </div>
          <Link href="/strategies" className="text-xs font-semibold text-slate-300 hover:text-slate-100">
            View strategy library
          </Link>
        </div>

        <div className="mt-4">
          <SignalsFeed />
        </div>
      </div>
    </div>
  );
}
