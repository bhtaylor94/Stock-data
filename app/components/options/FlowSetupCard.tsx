'use client';
import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Bookmark, AlertTriangle, CheckCircle2, Zap } from 'lucide-react';
import Badge from '@/app/components/core/Badge';
import { TipLabel } from '@/app/components/core/Tooltip';

type IVContext = 'FAVORABLE' | 'ACCEPTABLE' | 'CAUTION' | 'AVOID';
type ConfidenceLabel = 'EXTREME' | 'VERY_HIGH' | 'HIGH' | 'MEDIUM' | 'WATCH';
type Sentiment = 'BULLISH' | 'BEARISH' | 'NEUTRAL';

function ivContextVariant(ctx: IVContext): 'bullish' | 'info' | 'warning' | 'bearish' {
  if (ctx === 'FAVORABLE') return 'bullish';
  if (ctx === 'ACCEPTABLE') return 'info';
  if (ctx === 'CAUTION') return 'warning';
  return 'bearish';
}

function sentimentVariant(s: Sentiment): 'bullish' | 'bearish' | 'neutral' {
  if (s === 'BULLISH') return 'bullish';
  if (s === 'BEARISH') return 'bearish';
  return 'neutral';
}

function confidenceVariant(label: ConfidenceLabel): 'urgent' | 'bullish' | 'info' | 'neutral' | 'warning' {
  if (label === 'EXTREME') return 'urgent';
  if (label === 'VERY_HIGH') return 'bullish';
  if (label === 'HIGH') return 'info';
  if (label === 'MEDIUM') return 'neutral';
  return 'warning';
}

// Left border color by confluence score
function stripeClass(score: number): string {
  if (score >= 75) return 'border-l-amber-500';
  if (score >= 55) return 'border-l-blue-500';
  return 'border-l-slate-500';
}

// Small SVG arc ring showing confluence score
function ConfluenceRing({ score }: { score: number }) {
  const r = 14;
  const circ = 2 * Math.PI * r;
  const filled = (score / 100) * circ;
  const color = score >= 75 ? '#f59e0b' : score >= 55 ? '#3b82f6' : '#64748b';

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

export function FlowSetupCard({
  setup,
  onTrack,
}: {
  setup: any;
  onTrack?: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const confluenceScore: number = setup.confluenceScore ?? 0;
  const ivCtx: IVContext = setup.ivContext ?? 'CAUTION';
  const sentiment: Sentiment = setup.sentiment ?? 'NEUTRAL';
  const confidenceLabel: ConfidenceLabel = setup.confidenceLabel ?? 'WATCH';
  const rc = setup.recommendedContract;
  const rs = setup.recommendedStructure;

  return (
    <div className={`rounded-xl border border-slate-700/50 bg-slate-800/30 border-l-4 ${stripeClass(confluenceScore)} overflow-hidden`}>
      {/* Header — always visible */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-700/20 transition-colors"
      >
        <div className="flex flex-col items-center gap-0.5 flex-shrink-0">
          <ConfluenceRing score={confluenceScore} />
          <TipLabel labelKey="CONFLUENCE SCORE" iconClassName="inline-flex items-center justify-center w-3 h-3 rounded-full bg-slate-700/70 text-slate-400 text-[8px] leading-none">
            <span className="text-[9px] text-slate-600 uppercase tracking-wide">SCORE</span>
          </TipLabel>
        </div>

        <div className="flex-1 min-w-0 text-left">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="font-semibold text-sm text-white truncate">{setup.name}</span>
            <Badge text={confidenceLabel.replace('_', ' ')} variant={confidenceVariant(confidenceLabel)} dot />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge text={sentiment} variant={sentimentVariant(sentiment)} />
            <Badge text={`IV: ${ivCtx}`} variant={ivContextVariant(ivCtx)} />
            {setup.uoaConfirmation && (
              <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/25">
                <Zap size={9} />UOA Confirmed
              </span>
            )}
            {setup.regimeAdjusted && setup.regimeMultiplier > 1 && (
              <span className="inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-full bg-violet-500/15 text-violet-400 border border-violet-500/25 font-semibold">
                REGIME ↑
              </span>
            )}
          </div>
        </div>

        {expanded ? <ChevronDown size={14} className="text-slate-400 flex-shrink-0" /> : <ChevronRight size={14} className="text-slate-400 flex-shrink-0" />}
      </button>

      {/* Expanded details */}
      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-slate-700/30">
          {/* Description */}
          <p className="text-xs text-slate-400 pt-3">{setup.description}</p>

          {/* Criteria hit */}
          {setup.criteriaHit?.length > 0 && (
            <div className="space-y-1">
              <p className="stat-label">Setup Criteria</p>
              {setup.criteriaHit.map((c: string) => (
                <div key={c} className="flex items-start gap-1.5">
                  <CheckCircle2 size={11} className="text-emerald-400 mt-0.5 flex-shrink-0" />
                  <span className="text-xs text-slate-300">{c}</span>
                </div>
              ))}
            </div>
          )}

          {/* Recommended structure */}
          {rs && (
            <div>
              <p className="stat-label mb-1.5">Recommended Structure</p>
              <div className="p-2.5 rounded-lg bg-slate-900/50 border border-slate-700/40">
                <p className="text-xs font-semibold text-white mb-1">{rs.type} — {rs.description}</p>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <p className="stat-label">DTE Range</p>
                    <p className="text-xs font-bold text-white">{rs.dteLow}–{rs.dteHigh}d</p>
                  </div>
                  <div>
                    <p className="stat-label">Delta Range</p>
                    <p className="text-xs font-bold text-white">{rs.deltaLow.toFixed(2)}–{rs.deltaHigh.toFixed(2)}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Recommended contract */}
          {rc && (
            <div>
              <p className="stat-label mb-1.5">Best Matching Contract</p>
              <div className="grid grid-cols-4 gap-2 p-2.5 rounded-lg bg-slate-900/50 border border-slate-700/40">
                <div>
                  <p className="stat-label">Strike</p>
                  <p className="stat-value">${rc.strike}</p>
                </div>
                <div>
                  <p className="stat-label">Exp</p>
                  <p className="stat-value">{rc.dte}d</p>
                </div>
                <div>
                  <p className="stat-label">Delta</p>
                  <p className="stat-value">{rc.delta?.toFixed(2)}</p>
                </div>
                <div>
                  <p className="stat-label">Ask</p>
                  <p className="text-xs font-bold text-emerald-400">${rc.ask?.toFixed(2)}</p>
                </div>
              </div>
              {rc.spreadPercent > 10 && (
                <p className="mt-1 text-xs text-amber-400 flex items-center gap-1">
                  <AlertTriangle size={10} /> Wide spread ({rc.spreadPercent?.toFixed(0)}%) — low liquidity
                </p>
              )}
            </div>
          )}

          {/* Spread alternative */}
          {setup.spread && (
            <div className={`p-2.5 rounded-lg border ${setup.spread.preferOverNaked ? 'border-amber-500/30 bg-amber-500/5' : 'border-slate-700/40 bg-slate-900/40'}`}>
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs font-semibold text-white">{setup.spread.name}</p>
                {setup.spread.preferOverNaked && (
                  <span className="text-xs px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400">Preferred in high IV</span>
                )}
              </div>
              <p className="text-xs font-mono text-slate-300 mb-1.5">{setup.spread.structure}</p>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <p className="stat-label">Max Risk</p>
                  <p className="text-xs font-bold text-red-400">${(setup.spread.debit * 100).toFixed(0)}</p>
                </div>
                <div>
                  <p className="stat-label">Max Gain</p>
                  <p className="text-xs font-bold text-emerald-400">
                    {isFinite(setup.spread.maxGain) ? `$${(setup.spread.maxGain * 100).toFixed(0)}` : 'Unlimited'}
                  </p>
                </div>
                <div>
                  <p className="stat-label">R:R</p>
                  <p className="text-xs font-bold text-white">{setup.spread.riskReward}</p>
                </div>
              </div>
              <p className="text-xs text-slate-500 mt-1">{setup.spread.note}</p>
            </div>
          )}

          {/* Total UOA premium + risk note */}
          <div className="flex items-start justify-between gap-3">
            {setup.totalPremium > 0 && (
              <div>
                <p className="stat-label">UOA Premium Flow</p>
                <p className="text-xs font-bold text-white">
                  ${setup.totalPremium >= 1e6
                    ? `${(setup.totalPremium / 1e6).toFixed(2)}M`
                    : `${(setup.totalPremium / 1e3).toFixed(0)}K`}
                </p>
              </div>
            )}
            {setup.riskNote && (
              <p className="text-xs text-slate-400 italic flex-1 text-right">{setup.riskNote}</p>
            )}
          </div>

          {/* Track button */}
          {onTrack && (
            <button onClick={onTrack} className="btn-primary w-full justify-center gap-1.5">
              <Bookmark size={12} />
              Track This Setup
            </button>
          )}
        </div>
      )}
    </div>
  );
}
