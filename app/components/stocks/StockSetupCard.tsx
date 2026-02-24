'use client';
import React, { useState } from 'react';
import { ChevronDown, ChevronRight, CheckCircle2, AlertTriangle } from 'lucide-react';
import Badge from '@/app/components/core/Badge';

// ── Helpers ──────────────────────────────────────────────────────────────────

type ConfidenceLabel = 'VERY_HIGH' | 'HIGH' | 'MEDIUM';

function stripeClass(score: number): string {
  if (score >= 75) return 'border-l-amber-500';
  if (score >= 55) return 'border-l-blue-500';
  return 'border-l-slate-500';
}

function confidenceVariant(label: ConfidenceLabel): 'bullish' | 'info' | 'neutral' {
  if (label === 'VERY_HIGH') return 'bullish';
  if (label === 'HIGH') return 'info';
  return 'neutral';
}

function statusVariant(status: string): 'bullish' | 'bearish' | 'warning' | 'info' {
  if (status === 'BREAKOUT' || status === 'CONFIRMED') return 'bullish';
  if (status === 'BREAKDOWN') return 'bearish';
  if (status === 'FORMING') return 'warning';
  return 'info';
}

// ── Confluence ring (same design as FlowSetupCard) ────────────────────────────

function ConfluenceRing({ score }: { score: number }) {
  const r     = 14;
  const circ  = 2 * Math.PI * r;
  const filled = (score / 100) * circ;
  const color  = score >= 75 ? '#f59e0b' : score >= 55 ? '#3b82f6' : '#64748b';

  return (
    <svg width="36" height="36" viewBox="0 0 36 36" className="flex-shrink-0">
      <circle cx="18" cy="18" r={r} fill="none" stroke="#1e293b" strokeWidth="3.5" />
      <circle
        cx="18" cy="18" r={r}
        fill="none"
        stroke={color}
        strokeWidth="3.5"
        strokeDasharray={`${filled} ${circ - filled}`}
        strokeLinecap="round"
        transform="rotate(-90 18 18)"
        style={{ transition: 'stroke-dasharray 0.7s ease-out' }}
      />
      <text x="18" y="22" textAnchor="middle" fontSize="8" fontWeight="700" fill={color}>
        {score}
      </text>
    </svg>
  );
}

// ── Card ─────────────────────────────────────────────────────────────────────

export function StockSetupCard({ result }: { result: any }) {
  const [expanded, setExpanded] = useState(false);
  const { ticker, price, changePct, sector, setup } = result;

  const rrNum  = parseFloat((setup.riskReward ?? '').replace('1:', ''));
  const rrGood = !isNaN(rrNum) && rrNum >= 2;

  return (
    <div
      className={`rounded-xl border border-slate-700/50 bg-slate-800/30 border-l-4 ${stripeClass(setup.confidence)} overflow-hidden`}
    >
      {/* ── Header ── */}
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-700/20 transition-colors"
      >
        <ConfluenceRing score={setup.confidence} />

        <div className="flex-1 min-w-0 text-left">
          {/* Row 1: setup name + badges */}
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="font-semibold text-sm text-white">
              {setup.emoji} {setup.name}
            </span>
            <Badge
              text={setup.confidenceLabel.replace('_', ' ')}
              variant={confidenceVariant(setup.confidenceLabel)}
              dot
            />
            <Badge text={setup.status} variant={statusVariant(setup.status)} />
          </div>

          {/* Row 2: ticker + price + outlook + sector */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-sm text-white font-mono">{ticker}</span>
            <span
              className={`text-xs font-medium ${changePct >= 0 ? 'text-emerald-400' : 'text-red-400'}`}
            >
              ${price.toFixed(2)} ({changePct >= 0 ? '+' : ''}{changePct.toFixed(2)}%)
            </span>
            <Badge
              text={setup.outlook === 'bullish' ? 'Bullish' : 'Bearish'}
              variant={setup.outlook === 'bullish' ? 'bullish' : 'bearish'}
            />
            {sector && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-700/60 text-slate-400">
                {sector}
              </span>
            )}
          </div>
        </div>

        {expanded
          ? <ChevronDown size={14} className="text-slate-400 flex-shrink-0" />
          : <ChevronRight size={14} className="text-slate-400 flex-shrink-0" />}
      </button>

      {/* ── Expanded body ── */}
      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-slate-700/30">
          {/* Setup criteria checklist */}
          <div className="space-y-1 pt-3">
            <p className="stat-label">Setup Criteria</p>
            {(setup.criteria ?? []).map((c: string, i: number) => (
              <div key={i} className="flex items-start gap-1.5">
                <CheckCircle2 size={11} className="text-emerald-400 mt-0.5 flex-shrink-0" />
                <span className="text-xs text-slate-300">{c}</span>
              </div>
            ))}
          </div>

          {/* Action levels */}
          <div>
            <p className="stat-label mb-1.5">Action Levels</p>
            <div className="grid grid-cols-3 gap-2">
              <div className="p-2.5 rounded-lg bg-emerald-500/5 border border-emerald-500/20 text-center">
                <p className="text-[10px] text-emerald-400 font-semibold uppercase tracking-wide mb-0.5">Entry</p>
                <p className="text-sm font-bold text-emerald-400">${setup.entry.toFixed(2)}</p>
              </div>
              <div className="p-2.5 rounded-lg bg-red-500/5 border border-red-500/20 text-center">
                <p className="text-[10px] text-red-400 font-semibold uppercase tracking-wide mb-0.5">Stop</p>
                <p className="text-sm font-bold text-red-400">${setup.stop.toFixed(2)}</p>
              </div>
              <div className="p-2.5 rounded-lg bg-blue-500/5 border border-blue-500/20 text-center">
                <p className="text-[10px] text-blue-400 font-semibold uppercase tracking-wide mb-0.5">Target</p>
                <p className="text-sm font-bold text-blue-400">${setup.target.toFixed(2)}</p>
              </div>
            </div>
          </div>

          {/* R:R + hold period */}
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-1.5">
              <span className="stat-label">Risk/Reward:</span>
              <span className={`text-xs font-bold ${rrGood ? 'text-emerald-400' : 'text-slate-300'}`}>
                {setup.riskReward}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="stat-label">Hold:</span>
              <span className="text-xs text-slate-300">{setup.holdPeriod}</span>
            </div>
          </div>

          {/* Disclaimer */}
          <p className="text-[10px] text-slate-600 flex items-center gap-1">
            <AlertTriangle size={9} />
            Educational purposes only. Always use a stop-loss.
          </p>
        </div>
      )}
    </div>
  );
}
