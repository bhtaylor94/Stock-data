'use client';
import React, { useState, useEffect, useCallback } from 'react';
import {
  Bot, RefreshCw, TrendingUp, TrendingDown, DollarSign,
  BarChart2, ChevronDown, ChevronRight, AlertTriangle, CheckCircle2,
  XCircle, Clock, Loader2,
} from 'lucide-react';
import type {
  PaperPortfolio,
  PaperPosition,
  AgentLogEntry,
  EquitySnapshot,
} from '@/lib/paperTradingStore';

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function fmt$(n: number): string {
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function fmtPct(n: number, sign = true): string {
  const s = n.toFixed(2) + '%';
  return sign && n > 0 ? '+' + s : s;
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  });
}

function dirLabel(d: string): string {
  if (d === 'LONG_CALL') return 'CALL';
  if (d === 'LONG_PUT')  return 'PUT';
  return 'STOCK';
}

function dirColor(d: string): string {
  if (d === 'LONG_CALL') return 'text-emerald-400';
  if (d === 'LONG_PUT')  return 'text-red-400';
  return 'text-blue-400';
}

// ─────────────────────────────────────────────────────────────────────────────
// PERFORMANCE METRICS
// ─────────────────────────────────────────────────────────────────────────────

function computeMetrics(positions: PaperPosition[], equity: EquitySnapshot[], portfolio: PaperPortfolio) {
  const closed  = positions.filter(p => p.status === 'CLOSED');
  const winners = closed.filter(p => (p.realizedPnl ?? 0) > 0);
  const losers  = closed.filter(p => (p.realizedPnl ?? 0) <= 0);

  const winRate = closed.length > 0 ? winners.length / closed.length : 0;
  const grossProfit = winners.reduce((s, p) => s + (p.realizedPnl ?? 0), 0);
  const grossLoss   = Math.abs(losers.reduce((s, p) => s + (p.realizedPnl ?? 0), 0));
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : (grossProfit > 0 ? 99 : 0);

  let sharpe = 0;
  if (equity.length >= 5) {
    const returns: number[] = [];
    for (let i = 1; i < equity.length; i++) {
      const prev = equity[i - 1].value;
      if (prev > 0) returns.push((equity[i].value - prev) / prev);
    }
    if (returns.length >= 2) {
      const mean = returns.reduce((s, r) => s + r, 0) / returns.length;
      const variance = returns.reduce((s, r) => s + Math.pow(r - mean, 2), 0) / returns.length;
      const stddev = Math.sqrt(variance);
      if (stddev > 0) sharpe = (mean / stddev) * Math.sqrt(252);
    }
  }

  const totalReturnPct = (portfolio.totalValue - portfolio.startingCapital) / portfolio.startingCapital * 100;
  const drawdownPct    = portfolio.peakValue > 0
    ? (portfolio.totalValue - portfolio.peakValue) / portfolio.peakValue * 100
    : 0;

  return { winRate, profitFactor, sharpe, totalReturnPct, drawdownPct, winCount: winners.length, lossCount: losers.length, totalClosed: closed.length };
}

// ─────────────────────────────────────────────────────────────────────────────
// EQUITY CURVE
// ─────────────────────────────────────────────────────────────────────────────

function EquityCurve({ equity, startingCapital }: { equity: EquitySnapshot[]; startingCapital: number }) {
  if (equity.length < 2) {
    return (
      <div className="flex items-center justify-center h-32 text-sm text-slate-500">
        Equity curve builds after 2+ daily snapshots
      </div>
    );
  }

  const W = 600, H = 120, PAD = { top: 10, bottom: 20, left: 50, right: 10 };
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;

  const values  = equity.map(s => s.value);
  const minVal  = Math.min(...values, startingCapital) * 0.985;
  const maxVal  = Math.max(...values, startingCapital) * 1.015;
  const range   = maxVal - minVal || 1;

  const toX = (i: number) => PAD.left + (i / (equity.length - 1)) * innerW;
  const toY = (v: number) => PAD.top + (1 - (v - minVal) / range) * innerH;

  const pts = equity.map((s, i) => `${toX(i)},${toY(s.value)}`).join(' ');
  const baselineY = toY(startingCapital);
  const lastVal   = equity[equity.length - 1].value;
  const isProfit  = lastVal >= startingCapital;

  // Area fill path
  const areaPath = `M ${PAD.left},${toY(equity[0].value)} ` +
    equity.map((s, i) => `L ${toX(i)},${toY(s.value)}`).join(' ') +
    ` L ${toX(equity.length - 1)},${PAD.top + innerH} L ${PAD.left},${PAD.top + innerH} Z`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 120 }}>
      {/* Area */}
      <defs>
        <linearGradient id="equityGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={isProfit ? '#10b981' : '#ef4444'} stopOpacity="0.25" />
          <stop offset="100%" stopColor={isProfit ? '#10b981' : '#ef4444'} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill="url(#equityGrad)" />

      {/* $25K baseline */}
      {baselineY >= PAD.top && baselineY <= PAD.top + innerH && (
        <line
          x1={PAD.left} y1={baselineY} x2={W - PAD.right} y2={baselineY}
          stroke="#64748b" strokeWidth="1" strokeDasharray="4 3" opacity="0.6"
        />
      )}

      {/* Equity line */}
      <polyline
        points={pts}
        fill="none"
        stroke={isProfit ? '#10b981' : '#ef4444'}
        strokeWidth="2"
        strokeLinejoin="round"
      />

      {/* Y labels */}
      <text x={PAD.left - 4} y={PAD.top + 4} textAnchor="end" fill="#64748b" fontSize="9">
        {fmt$(maxVal)}
      </text>
      <text x={PAD.left - 4} y={PAD.top + innerH} textAnchor="end" fill="#64748b" fontSize="9">
        {fmt$(minVal)}
      </text>
      {/* $25K label */}
      {baselineY >= PAD.top && baselineY <= PAD.top + innerH && (
        <text x={PAD.left - 4} y={baselineY + 3} textAnchor="end" fill="#64748b" fontSize="8">
          {fmt$(startingCapital)}
        </text>
      )}

      {/* Date labels */}
      <text x={PAD.left} y={H - 4} textAnchor="start" fill="#475569" fontSize="8">
        {equity[0].date}
      </text>
      <text x={W - PAD.right} y={H - 4} textAnchor="end" fill="#475569" fontSize="8">
        {equity[equity.length - 1].date}
      </text>
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// OPEN POSITIONS TABLE
// ─────────────────────────────────────────────────────────────────────────────

function OpenPositionsTable({ positions }: { positions: PaperPosition[] }) {
  const open = positions.filter(p => p.status === 'OPEN');
  if (open.length === 0) {
    return <p className="text-sm text-slate-500 py-4 text-center">No open positions</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-slate-500 border-b border-slate-700/50">
            <th className="text-left py-2 pr-3 font-medium">Ticker</th>
            <th className="text-left py-2 pr-3 font-medium">Type</th>
            <th className="text-left py-2 pr-3 font-medium">Dir</th>
            <th className="text-right py-2 pr-3 font-medium">Entry</th>
            <th className="text-right py-2 pr-3 font-medium">Mark</th>
            <th className="text-right py-2 pr-3 font-medium">P&L%</th>
            <th className="text-right py-2 pr-3 font-medium">Target</th>
            <th className="text-right py-2 pr-3 font-medium">Stop</th>
            <th className="text-right py-2 pr-3 font-medium">DTE</th>
            <th className="text-left py-2 font-medium">Sector</th>
          </tr>
        </thead>
        <tbody>
          {open.map(pos => {
            const pnlPct = (pos.unrealizedPnlPct ?? 0) * 100;
            const dteLeft = pos.expiration
              ? Math.max(0, Math.floor((new Date(pos.expiration).getTime() - Date.now()) / 86_400_000))
              : null;
            return (
              <tr key={pos.id} className="border-b border-slate-800/50 hover:bg-slate-800/20">
                <td className="py-2 pr-3 font-mono font-semibold text-white">{pos.ticker}</td>
                <td className="py-2 pr-3 text-slate-400">{pos.positionType}</td>
                <td className={`py-2 pr-3 font-medium ${dirColor(pos.direction)}`}>
                  {dirLabel(pos.direction)}
                </td>
                <td className="py-2 pr-3 text-right font-mono text-slate-300">
                  {pos.positionType === 'OPTIONS' ? `$${pos.entryPrice.toFixed(2)}` : fmt$(pos.entryPrice)}
                </td>
                <td className="py-2 pr-3 text-right font-mono text-slate-300">
                  {pos.positionType === 'OPTIONS' ? `$${pos.currentPrice.toFixed(2)}` : fmt$(pos.currentPrice)}
                </td>
                <td className={`py-2 pr-3 text-right font-mono font-semibold ${pnlPct >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {fmtPct(pnlPct)}
                </td>
                <td className="py-2 pr-3 text-right font-mono text-slate-400">
                  {pos.positionType === 'OPTIONS' ? `$${pos.targetPrice.toFixed(2)}` : fmt$(pos.targetPrice)}
                </td>
                <td className="py-2 pr-3 text-right font-mono text-slate-400">
                  {pos.positionType === 'OPTIONS' ? `$${pos.stopPrice.toFixed(2)}` : fmt$(pos.stopPrice)}
                </td>
                <td className="py-2 pr-3 text-right text-slate-400">
                  {dteLeft !== null ? dteLeft + 'd' : '—'}
                </td>
                <td className="py-2 text-slate-400">{pos.sector}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CLOSED TRADES TABLE
// ─────────────────────────────────────────────────────────────────────────────

function ClosedTradesTable({ positions }: { positions: PaperPosition[] }) {
  const closed = positions
    .filter(p => p.status === 'CLOSED')
    .sort((a, b) => new Date(b.exitDate ?? '').getTime() - new Date(a.exitDate ?? '').getTime())
    .slice(0, 20);

  if (closed.length === 0) {
    return <p className="text-sm text-slate-500 py-4 text-center">No closed trades yet</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-slate-500 border-b border-slate-700/50">
            <th className="text-left py-2 pr-3 font-medium">Ticker</th>
            <th className="text-left py-2 pr-3 font-medium">Dir</th>
            <th className="text-right py-2 pr-3 font-medium">Entry</th>
            <th className="text-right py-2 pr-3 font-medium">Exit</th>
            <th className="text-right py-2 pr-3 font-medium">P&L</th>
            <th className="text-right py-2 pr-3 font-medium">P&L%</th>
            <th className="text-left py-2 pr-3 font-medium">Reason</th>
            <th className="text-left py-2 font-medium">Closed</th>
          </tr>
        </thead>
        <tbody>
          {closed.map(pos => {
            const pnlPct = (pos.realizedPnlPct ?? 0) * 100;
            const isWin  = (pos.realizedPnl ?? 0) > 0;
            return (
              <tr
                key={pos.id}
                className={`border-b border-slate-800/40 ${isWin ? 'bg-emerald-500/5' : 'bg-red-500/5'}`}
              >
                <td className="py-2 pr-3 font-mono font-semibold text-white">{pos.ticker}</td>
                <td className={`py-2 pr-3 font-medium ${dirColor(pos.direction)}`}>
                  {dirLabel(pos.direction)}
                </td>
                <td className="py-2 pr-3 text-right font-mono text-slate-400">
                  {pos.positionType === 'OPTIONS' ? `$${pos.entryPrice.toFixed(2)}` : fmt$(pos.entryPrice)}
                </td>
                <td className="py-2 pr-3 text-right font-mono text-slate-400">
                  {pos.exitPrice != null
                    ? (pos.positionType === 'OPTIONS' ? `$${pos.exitPrice.toFixed(2)}` : fmt$(pos.exitPrice))
                    : '—'}
                </td>
                <td className={`py-2 pr-3 text-right font-mono font-semibold ${isWin ? 'text-emerald-400' : 'text-red-400'}`}>
                  {pos.realizedPnl != null ? (isWin ? '+' : '') + fmt$(pos.realizedPnl) : '—'}
                </td>
                <td className={`py-2 pr-3 text-right font-mono ${isWin ? 'text-emerald-400' : 'text-red-400'}`}>
                  {fmtPct(pnlPct)}
                </td>
                <td className="py-2 pr-3 text-slate-400">
                  {pos.exitReason?.replace('_', ' ') ?? '—'}
                </td>
                <td className="py-2 text-slate-500 text-[10px]">
                  {pos.exitDate ? fmtDate(pos.exitDate) : '—'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// AGENT LOG
// ─────────────────────────────────────────────────────────────────────────────

function AgentLog({ log }: { log: AgentLogEntry[] }) {
  const [expanded, setExpanded] = useState<Set<number>>(new Set([0]));
  const recent = log.slice(0, 10);

  if (recent.length === 0) {
    return <p className="text-sm text-slate-500 py-4 text-center">No agent runs yet</p>;
  }

  const toggle = (i: number) => setExpanded(prev => {
    const next = new Set(prev);
    if (next.has(i)) next.delete(i); else next.add(i);
    return next;
  });

  return (
    <div className="space-y-2">
      {recent.map((entry, i) => {
        const isOpen = expanded.has(i);
        return (
          <div key={i} className="rounded-xl border border-slate-700/40 bg-slate-800/20 overflow-hidden">
            {/* Header row */}
            <button
              onClick={() => toggle(i)}
              className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-700/20 transition-colors"
            >
              {/* Market open indicator */}
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${entry.marketOpen ? 'bg-emerald-400' : 'bg-slate-600'}`} />

              {/* Run time */}
              <span className="text-xs text-slate-500 flex-shrink-0 w-36">{fmtDate(entry.runAt)}</span>

              {/* Portfolio value */}
              <span className="text-xs font-mono text-slate-300 flex-shrink-0">
                {fmt$(entry.portfolioValue)}
              </span>

              {/* Activity summary */}
              <div className="flex items-center gap-3 flex-1">
                {entry.entered.length > 0 && (
                  <span className="text-xs text-emerald-400 flex items-center gap-1">
                    <TrendingUp size={11} /> {entry.entered.length} entered
                  </span>
                )}
                {entry.exited.length > 0 && (
                  <span className="text-xs text-blue-400 flex items-center gap-1">
                    <DollarSign size={11} /> {entry.exited.length} exited
                  </span>
                )}
                {entry.skipped.length > 0 && (
                  <span className="text-xs text-slate-500 flex items-center gap-1">
                    <XCircle size={11} /> {entry.skipped.length} skipped
                  </span>
                )}
                {entry.errors.length > 0 && (
                  <span className="text-xs text-amber-400 flex items-center gap-1">
                    <AlertTriangle size={11} /> {entry.errors.length} errors
                  </span>
                )}
              </div>

              {/* Duration */}
              <span className="text-[10px] text-slate-600 flex-shrink-0 flex items-center gap-1">
                <Clock size={9} /> {(entry.durationMs / 1000).toFixed(1)}s
              </span>

              <ChevronDown size={14} className={`text-slate-500 flex-shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Expanded body */}
            {isOpen && (
              <div className="px-4 pb-4 space-y-3 border-t border-slate-700/30">
                <p className="text-xs text-slate-400 pt-3 italic">{entry.message}</p>

                {entry.entered.map((t, j) => (
                  <div key={j} className="p-2.5 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
                    <div className="flex items-center gap-2 mb-1">
                      <TrendingUp size={11} className="text-emerald-400" />
                      <span className="text-xs font-semibold text-emerald-400">
                        ENTERED {t.ticker} {dirLabel(t.direction)} · {fmt$(t.cost)}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed">{t.reasoning}</p>
                  </div>
                ))}

                {entry.exited.map((t, j) => (
                  <div key={j} className={`p-2.5 rounded-lg border ${(t.realizedPnl ?? 0) >= 0 ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-red-500/5 border-red-500/20'}`}>
                    <div className="flex items-center gap-2">
                      {(t.realizedPnl ?? 0) >= 0
                        ? <CheckCircle2 size={11} className="text-emerald-400" />
                        : <XCircle size={11} className="text-red-400" />
                      }
                      <span className={`text-xs font-semibold ${(t.realizedPnl ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        EXITED {t.ticker} {dirLabel(t.direction)} · {t.exitReason?.replace('_', ' ')}
                        {' '}· {(t.realizedPnl ?? 0) >= 0 ? '+' : ''}{fmt$(t.realizedPnl ?? 0)} ({fmtPct((t.realizedPnlPct ?? 0) * 100)})
                      </span>
                    </div>
                  </div>
                ))}

                {entry.skipped.slice(0, 5).map((s, j) => (
                  <div key={j} className="flex items-start gap-2 text-[11px] text-slate-500">
                    <XCircle size={10} className="mt-0.5 flex-shrink-0 text-slate-600" />
                    <span><span className="font-mono text-slate-400">{s.ticker}</span> — {s.reason}</span>
                  </div>
                ))}
                {entry.skipped.length > 5 && (
                  <p className="text-[11px] text-slate-600">…and {entry.skipped.length - 5} more skipped</p>
                )}

                {entry.errors.map((e, j) => (
                  <p key={j} className="text-[11px] text-amber-400/80">{e}</p>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN DASHBOARD
// ─────────────────────────────────────────────────────────────────────────────

interface State {
  portfolio: PaperPortfolio | null;
  positions: PaperPosition[];
  log: AgentLogEntry[];
  equity: EquitySnapshot[];
  redisConnected: boolean;
}

export function PaperTradingDashboard() {
  const [state, setState]     = useState<State>({ portfolio: null, positions: [], log: [], equity: [], redisConnected: true });
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [lastFetch, setLastFetch] = useState<Date | null>(null);

  const fetchState = useCallback(async () => {
    try {
      const res  = await fetch('/api/paper-trade', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Failed to load agent state');
        return;
      }
      setState({
        portfolio:      data.portfolio ?? null,
        positions:      data.positions ?? [],
        log:            data.log ?? [],
        equity:         data.equity ?? [],
        redisConnected: data.redisConnected ?? false,
      });
      setError(null);
      setLastFetch(new Date());
    } catch (err: any) {
      setError(String(err?.message ?? err));
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => { fetchState(); }, [fetchState]);

  // Auto-refresh every 15s
  useEffect(() => {
    const id = setInterval(fetchState, 15_000);
    return () => clearInterval(id);
  }, [fetchState]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={24} className="animate-spin text-blue-400" />
        <span className="ml-3 text-slate-400">Loading agent state…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 rounded-2xl border border-red-500/30 bg-red-500/5">
        <p className="text-red-400 text-sm flex items-center gap-2">
          <AlertTriangle size={15} /> {error}
        </p>
      </div>
    );
  }

  const { portfolio, positions, log, equity, redisConnected } = state;
  if (!portfolio) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={24} className="animate-spin text-blue-400" />
        <span className="ml-3 text-slate-400">Waiting for first agent run…</span>
      </div>
    );
  }

  const metrics  = computeMetrics(positions, equity, portfolio);
  const openPositions = positions.filter(p => p.status === 'OPEN');
  const isActive = log.length > 0 && Date.now() - new Date(log[0].runAt).getTime() < 300_000;

  return (
    <div className="space-y-5 animate-fade-in">

      {/* ── Redis warning ────────────────────────────────────────────────────── */}
      {!redisConnected && (
        <div className="p-4 rounded-2xl border border-red-500/40 bg-red-500/8">
          <p className="text-sm font-semibold text-red-400 flex items-center gap-2 mb-1">
            <AlertTriangle size={14} /> Redis not connected — agent state cannot be saved
          </p>
          <p className="text-xs text-slate-400">
            Add <code className="bg-slate-700 px-1 rounded">UPSTASH_REDIS_REST_URL</code> and{' '}
            <code className="bg-slate-700 px-1 rounded">UPSTASH_REDIS_REST_TOKEN</code> to your
            Vercel environment variables, then redeploy. All agent runs are silently discarded until this is fixed.
          </p>
        </div>
      )}

      {/* ── Header Card ─────────────────────────────────────────────────────── */}
      <div className="p-5 rounded-2xl border border-slate-700/50 bg-slate-800/30">
        {/* Top row */}
        <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-violet-500/20 border border-violet-500/30 flex items-center justify-center">
              <Bot size={18} className="text-violet-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white">Hedge Fund Agent</h2>
                <span className={`flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-medium ${isActive ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-400' : 'bg-slate-700/50 border border-slate-600/50 text-slate-400'}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
                  {isActive ? 'Active' : 'Idle'}
                </span>
              </div>
              <p className="text-xs text-slate-500">
                {fmt$(portfolio.startingCapital)} starting · {lastFetch ? `Updated ${fmtDate(lastFetch.toISOString())}` : ''}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-white font-mono">{fmt$(portfolio.totalValue)}</span>
                <span className={`text-sm font-semibold ${metrics.totalReturnPct >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {fmtPct(metrics.totalReturnPct)}
                </span>
              </div>
            </div>
            <button
              onClick={fetchState}
              className="p-2 rounded-lg bg-slate-700/50 hover:bg-slate-600/50 border border-slate-600/50 text-slate-400 hover:text-white transition-colors"
              title="Refresh"
            >
              <RefreshCw size={14} />
            </button>
          </div>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatBox label="Win Rate" value={`${(metrics.winRate * 100).toFixed(0)}%`} sub={`${metrics.winCount}W / ${metrics.lossCount}L`} />
          <StatBox label="Profit Factor" value={metrics.profitFactor < 99 ? metrics.profitFactor.toFixed(2) : '—'} sub={`${metrics.totalClosed} closed trades`} />
          <StatBox label="Sharpe (ann.)" value={equity.length >= 5 ? metrics.sharpe.toFixed(2) : '—'} sub={`${equity.length} daily snapshots`} />
          <StatBox label="Drawdown" value={fmtPct(metrics.drawdownPct, false)} sub={`Peak: ${fmt$(portfolio.peakValue)}`} color={metrics.drawdownPct < -5 ? 'text-red-400' : 'text-slate-300'} />
        </div>

        {/* Open / Cash row */}
        <div className="mt-3 flex flex-wrap gap-4 text-sm">
          <span className="text-slate-400">
            Open: <span className="text-white font-medium">{openPositions.length}</span>
            <span className="text-slate-600"> / 8</span>
          </span>
          <span className="text-slate-400">
            Cash: <span className="text-white font-mono font-medium">{fmt$(portfolio.cash)}</span>
            <span className="text-slate-600"> ({((portfolio.cash / portfolio.totalValue) * 100).toFixed(0)}%)</span>
          </span>
          {metrics.drawdownPct < -12 && (
            <span className="flex items-center gap-1 text-amber-400 text-xs">
              <AlertTriangle size={12} /> Drawdown mode — position sizes reduced 50%
            </span>
          )}
          {metrics.drawdownPct < -20 && (
            <span className="flex items-center gap-1 text-red-400 text-xs font-semibold">
              <AlertTriangle size={12} /> HALT — no new entries until recovery
            </span>
          )}
        </div>
      </div>

      {/* ── Equity Curve ───────────────────────────────────────────────────── */}
      <div className="p-5 rounded-2xl border border-slate-700/50 bg-slate-800/30">
        <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
          <BarChart2 size={14} className="text-violet-400" /> Equity Curve
        </h3>
        <EquityCurve equity={equity} startingCapital={portfolio.startingCapital} />
      </div>

      {/* ── Open Positions ──────────────────────────────────────────────────── */}
      <div className="p-5 rounded-2xl border border-slate-700/50 bg-slate-800/30">
        <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
          <TrendingUp size={14} className="text-emerald-400" />
          Open Positions
          <span className="text-xs text-slate-500 font-normal">({openPositions.length})</span>
        </h3>
        <OpenPositionsTable positions={positions} />
      </div>

      {/* ── Closed Trades ───────────────────────────────────────────────────── */}
      <div className="p-5 rounded-2xl border border-slate-700/50 bg-slate-800/30">
        <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
          <TrendingDown size={14} className="text-blue-400" />
          Closed Trades
          <span className="text-xs text-slate-500 font-normal">(last 20)</span>
        </h3>
        <ClosedTradesTable positions={positions} />
      </div>

      {/* ── Agent Log ───────────────────────────────────────────────────────── */}
      <div className="p-5 rounded-2xl border border-slate-700/50 bg-slate-800/30">
        <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
          <Bot size={14} className="text-violet-400" />
          Agent Log
          <span className="text-xs text-slate-500 font-normal">(last 10 runs)</span>
        </h3>
        <AgentLog log={log} />
      </div>

      {/* ── Setup Guide ─────────────────────────────────────────────────────── */}
      {log.length === 0 && (
        <div className="p-5 rounded-2xl border border-blue-500/20 bg-blue-500/5">
          <h4 className="text-sm font-semibold text-blue-300 mb-2">Setup cron-job.org to activate the agent</h4>
          <ol className="text-xs text-slate-400 space-y-1.5 list-decimal list-inside">
            <li>Add <code className="bg-slate-700 px-1 rounded">PAPER_TRADE_SECRET</code> to Vercel env vars (random 32-char string)</li>
            <li>Go to <span className="text-blue-400">cron-job.org</span> (free account)</li>
            <li>Create job: <code className="bg-slate-700 px-1 rounded text-[10px]">/api/paper-trade/run?secret=YOUR_SECRET</code></li>
            <li>Set frequency: every 1 minute</li>
            <li>The agent will auto-initialize a $25K portfolio on first run</li>
          </ol>
        </div>
      )}
    </div>
  );
}

// Small stat box component
function StatBox({ label, value, sub, color = 'text-slate-300' }: {
  label: string; value: string; sub: string; color?: string;
}) {
  return (
    <div className="p-3 rounded-xl bg-slate-900/50 border border-slate-700/30">
      <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-1">{label}</p>
      <p className={`text-lg font-bold font-mono ${color}`}>{value}</p>
      <p className="text-[10px] text-slate-600 mt-0.5">{sub}</p>
    </div>
  );
}
