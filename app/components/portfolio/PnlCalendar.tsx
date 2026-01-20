'use client';
import React, { useEffect, useMemo, useState } from 'react';

type CalendarResp = {
  ok: boolean;
  month: string; // YYYY-MM
  scope: string;
  timeZone: string;
  source?: 'BROKER' | 'TRACKER';
  days: Record<string, { pnlUsd: number; trades: number }>;
  error?: string;
};

const TZ = 'America/New_York';

function fmtMoney(n: number): string {
  const sign = n > 0 ? '+' : n < 0 ? '-' : '';
  const abs = Math.abs(n);
  return sign + abs.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

function monthLabel(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1, 1));
  return d.toLocaleString(undefined, { month: 'long', year: 'numeric' });
}

function addMonths(ym: string, delta: number): string {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  const yy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${yy}-${mm}`;
}

function daysInMonth(ym: string): number {
  const [y, m] = ym.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

function weekdayMon0(y: number, m0: number, day: number): number {
  // returns 0..6 where 0=Mon
  const js = new Date(Date.UTC(y, m0, day)).getUTCDay(); // 0=Sun
  return (js + 6) % 7;
}

export function PnlCalendar({ scope = 'live' }: { scope?: 'live' | 'paper' | 'all' }) {
  const nowYm = useMemo(() => {
    const s = new Date().toLocaleDateString('en-CA', { timeZone: TZ });
    return s.slice(0, 7);
  }, []);

  const [ym, setYm] = useState<string>(nowYm);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [data, setData] = useState<CalendarResp | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const src = scope === 'paper' ? 'tracker' : 'broker';
        const resp = await fetch(
          `/api/pnl/calendar?month=${encodeURIComponent(ym)}&scope=${encodeURIComponent(scope)}&source=${encodeURIComponent(src)}`
        );
        const json: CalendarResp = await resp.json();
        if (!alive) return;
        if (!resp.ok || !json.ok) {
          setErr(json.error || 'Failed to load calendar P/L');
          setData(null);
        } else {
          setData(json);
        }
      } catch (e: any) {
        if (!alive) return;
        setErr(String(e?.message || e));
        setData(null);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [ym, scope]);

  const grid = useMemo(() => {
    const total = daysInMonth(ym);
    const [y, m] = ym.split('-').map(Number);
    const m0 = m - 1;
    const startOffset = weekdayMon0(y, m0, 1);

    const cells: Array<{ ymd: string | null; dayNum: number | null }> = [];
    for (let i = 0; i < startOffset; i++) cells.push({ ymd: null, dayNum: null });
    for (let d = 1; d <= total; d++) {
      const dd = String(d).padStart(2, '0');
      const mm = String(m).padStart(2, '0');
      const ymd = `${y}-${mm}-${dd}`;
      cells.push({ ymd, dayNum: d });
    }
    while (cells.length % 7 !== 0) cells.push({ ymd: null, dayNum: null });

    const rows: Array<Array<{ ymd: string | null; dayNum: number | null }>> = [];
    for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
    return rows;
  }, [ym]);

  const weeksWithTotals = useMemo(() => {
    const days = data?.days || {};
    return grid.map((week) => {
      let total = 0;
      let trades = 0;
      for (const c of week) {
        if (!c.ymd) continue;
        const v = days[c.ymd];
        if (v) {
          total += v.pnlUsd;
          trades += v.trades;
        }
      }
      return { week, total, trades };
    });
  }, [grid, data]);

  return (
    <div className="rounded-2xl border border-slate-700/50 bg-slate-800/30 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-white">Monthly P/L Calendar</div>
          <div className="text-xs text-slate-400">
            Daily realized P/L (scope: {scope}) — source: {data?.source || (scope === 'paper' ? 'TRACKER' : 'BROKER')}.
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setYm(addMonths(ym, -1))}
            className="px-3 py-2 rounded-lg border border-slate-700 bg-slate-900/40 text-slate-200 text-xs hover:bg-slate-900/60 transition"
          >
            ◀
          </button>
          <div className="px-3 py-2 rounded-lg border border-slate-700 bg-slate-900/40 text-slate-200 text-xs">
            {monthLabel(ym)}
          </div>
          <button
            onClick={() => setYm(addMonths(ym, 1))}
            className="px-3 py-2 rounded-lg border border-slate-700 bg-slate-900/40 text-slate-200 text-xs hover:bg-slate-900/60 transition"
          >
            ▶
          </button>
        </div>
      </div>

      {err ? (
        <div className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{err}</div>
      ) : null}

      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-slate-400">
              {['Mon','Tue','Wed','Thu','Fri','Sat','Sun','Week'].map((h) => (
                <th key={h} className="text-left font-medium py-2 px-2">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {weeksWithTotals.map((row, idx) => (
              <tr key={idx} className="border-t border-slate-700/40">
                {row.week.map((c, i) => {
                  const v = c.ymd ? (data?.days?.[c.ymd] || null) : null;
                  const pnl = v?.pnlUsd || 0;
                  const has = Boolean(v);
                  const pnlCls = pnl > 0 ? 'text-emerald-400' : pnl < 0 ? 'text-red-400' : 'text-slate-500';
                  return (
                    <td key={i} className="py-2 px-2 align-top">
                      {c.dayNum ? (
                        <div className="rounded-lg border border-slate-700/50 bg-slate-900/30 px-2 py-1">
                          <div className="text-slate-200 font-medium">{c.dayNum}</div>
                          <div className={pnlCls}>
                            {has ? `$${fmtMoney(pnl)}` : '—'}
                          </div>
                          <div className="text-[10px] text-slate-500">
                            {has ? `${v!.trades} trade${v!.trades === 1 ? '' : 's'}` : ''}
                          </div>
                        </div>
                      ) : (
                        <div className="text-slate-700">—</div>
                      )}
                    </td>
                  );
                })}

                <td className="py-2 px-2 align-top">
                  <div className="rounded-lg border border-slate-700/50 bg-slate-950/40 px-2 py-1">
                    <div className="text-slate-400 text-[11px]">Total</div>
                    <div className={row.total > 0 ? 'text-emerald-400 font-semibold' : row.total < 0 ? 'text-red-400 font-semibold' : 'text-slate-500 font-semibold'}>
                      ${fmtMoney(row.total)}
                    </div>
                    <div className="text-[10px] text-slate-500">
                      {row.trades ? `${row.trades} trade${row.trades === 1 ? '' : 's'}` : ''}
                    </div>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {loading ? (
        <div className="mt-3 text-xs text-slate-400 flex items-center gap-2">
          <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          Loading...
        </div>
      ) : null}
    </div>
  );
}
