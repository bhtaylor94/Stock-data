'use client';

import React from 'react';

export type TradePlan = {
  entry?: number | string;
  stop?: number | string;
  target?: number | string;
  horizon?: string;
  why?: string[];
};

export function TradePlanDrawer({
  isOpen,
  onClose,
  title,
  plan,
}: {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  plan: TradePlan;
}) {
  if (!isOpen) return null;

  const fmt = (v: any) => (v === undefined || v === null || v === '' ? '—' : String(v));

  return (
    <div className="fixed inset-0 z-50">
      <button
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-black/50"
      />
      <div className="absolute bottom-0 left-0 right-0 max-h-[85vh] overflow-auto rounded-t-3xl border border-slate-800 bg-slate-950/95 p-5 shadow-2xl">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div>
            <div className="text-[11px] text-slate-400">Trade plan</div>
            <div className="text-lg font-bold text-white">{title || 'Plan'}</div>
          </div>
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-xl border border-slate-700 bg-slate-900/40 text-slate-200 hover:bg-slate-900/70"
          >
            Close
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/20 p-3">
            <div className="text-[11px] text-slate-400">Entry</div>
            <div className="text-sm font-semibold text-white">{fmt(plan.entry)}</div>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900/20 p-3">
            <div className="text-[11px] text-slate-400">Stop</div>
            <div className="text-sm font-semibold text-white">{fmt(plan.stop)}</div>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900/20 p-3">
            <div className="text-[11px] text-slate-400">Target</div>
            <div className="text-sm font-semibold text-white">{fmt(plan.target)}</div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/10 p-4">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold text-white">Why this setup</div>
            <div className="text-[11px] text-slate-400">{plan.horizon ? `Horizon: ${plan.horizon}` : ''}</div>
          </div>
          <div className="mt-3 space-y-2">
            {(plan.why || []).length ? (
              <ul className="list-disc pl-5 space-y-1.5 text-sm text-slate-200">
                {(plan.why || []).slice(0, 10).map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            ) : (
              <div className="text-sm text-slate-400">No rationale provided yet.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
