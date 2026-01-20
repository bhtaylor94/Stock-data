"use client";

import React, { useEffect, useMemo, useState } from "react";

type Scope = "live" | "paper" | "all";

type SummaryResp = {
  ok: boolean;
  scope: Scope;
  timeZone: string;
  source: "BROKER";
  realized: { todayUsd: number; wtdUsd: number; mtdUsd: number };
  unrealized: { totalUsd: number };
  balances?: { cashBalance?: number; buyingPower?: number; equity?: number };
  meta?: any;
  error?: string;
};

function fmtUsd(n: number): string {
  const v = Number.isFinite(n) ? n : 0;
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(v);
}

function signClass(n: number): string {
  if (n > 0) return "text-emerald-300";
  if (n < 0) return "text-rose-300";
  return "text-slate-200";
}

export function PnlSummaryCard({ scope }: { scope: Scope }) {
  const [loading, setLoading] = useState<boolean>(true);
  const [data, setData] = useState<SummaryResp | null>(null);

  useEffect(() => {
    let alive = true;
    async function run() {
      try {
        setLoading(true);
        const res = await fetch("/api/pnl/summary?scope=" + encodeURIComponent(scope), { cache: "no-store" });
        const j = (await res.json()) as SummaryResp;
        if (!alive) return;
        setData(j);
      } catch (e) {
        if (!alive) return;
        setData({
          ok: false,
          scope,
          timeZone: "America/New_York",
          source: "BROKER",
          realized: { todayUsd: 0, wtdUsd: 0, mtdUsd: 0 },
          unrealized: { totalUsd: 0 },
          error: "Failed to load broker-truth P&L summary",
        });
      } finally {
        if (alive) setLoading(false);
      }
    }
    run();
    return () => {
      alive = false;
    };
  }, [scope]);

  const realized = data?.realized || { todayUsd: 0, wtdUsd: 0, mtdUsd: 0 };
  const unreal = data?.unrealized?.totalUsd ?? 0;
  const balances = data?.balances || {};

  const sourceLabel = useMemo(() => {
    if (!data) return "";
    return data.ok ? "BROKER TRUTH" : "BROKER (unavailable)";
  }, [data]);

  return (
    <div className="p-6 rounded-2xl border border-slate-700/50 bg-slate-800/30">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-sm text-slate-300">P&L Summary</div>
          <div className="text-xs text-slate-500 mt-1">{sourceLabel}</div>
        </div>
        <div className="text-xs text-slate-500">Scope: {scope.toUpperCase()}</div>
      </div>

      {data?.error ? (
        <div className="mt-3 text-xs text-rose-300">{data.error}</div>
      ) : null}

      <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-xl border border-slate-700/40 bg-slate-900/30 p-4">
          <div className="text-xs text-slate-400">Realized Today</div>
          <div className={"mt-1 text-lg font-semibold " + signClass(realized.todayUsd)}>
            {loading ? "…" : fmtUsd(realized.todayUsd)}
          </div>
        </div>

        <div className="rounded-xl border border-slate-700/40 bg-slate-900/30 p-4">
          <div className="text-xs text-slate-400">Realized WTD</div>
          <div className={"mt-1 text-lg font-semibold " + signClass(realized.wtdUsd)}>
            {loading ? "…" : fmtUsd(realized.wtdUsd)}
          </div>
        </div>

        <div className="rounded-xl border border-slate-700/40 bg-slate-900/30 p-4">
          <div className="text-xs text-slate-400">Realized MTD</div>
          <div className={"mt-1 text-lg font-semibold " + signClass(realized.mtdUsd)}>
            {loading ? "…" : fmtUsd(realized.mtdUsd)}
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-xl border border-slate-700/40 bg-slate-900/30 p-4">
          <div className="text-xs text-slate-400">Unrealized (Open Positions)</div>
          <div className={"mt-1 text-lg font-semibold " + signClass(unreal)}>
            {loading ? "…" : fmtUsd(unreal)}
          </div>
        </div>

        <div className="rounded-xl border border-slate-700/40 bg-slate-900/30 p-4">
          <div className="text-xs text-slate-400">Equity</div>
          <div className="mt-1 text-lg font-semibold text-slate-200">
            {loading ? "…" : fmtUsd(Number(balances.equity || 0))}
          </div>
        </div>

        <div className="rounded-xl border border-slate-700/40 bg-slate-900/30 p-4">
          <div className="text-xs text-slate-400">Buying Power</div>
          <div className="mt-1 text-lg font-semibold text-slate-200">
            {loading ? "…" : fmtUsd(Number(balances.buyingPower || 0))}
          </div>
        </div>
      </div>
    </div>
  );
}
