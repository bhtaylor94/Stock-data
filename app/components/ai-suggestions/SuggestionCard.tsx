'use client';
import React from 'react';
import { BarChart2, Layers, TrendingUp, TrendingDown, X } from 'lucide-react';

interface SuggestionCardProps {
  suggestion: any;
  onExecute: () => void;
  onDismiss: () => void;
}

const priorityStripe: Record<string, string> = {
  URGENT: 'border-l-red-500',
  HIGH:   'border-l-amber-500',
  MEDIUM: 'border-l-blue-500',
};

export function SuggestionCard({ suggestion, onExecute, onDismiss }: SuggestionCardProps) {
  const getChangeColor = (change: number) => {
    if (change > 0) return 'text-emerald-400';
    if (change < 0) return 'text-red-400';
    return 'text-slate-400';
  };

  const formatCurrency = (value: number) => {
    if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
    return `$${value.toFixed(0)}`;
  };

  const isOptions = suggestion.type === 'OPTIONS';
  const priority: string = suggestion.priority || 'MEDIUM';
  const stripeClass = priorityStripe[priority] ?? 'border-l-blue-500';

  // Arc ring for confidence (SVG, 32px)
  const conf = Math.min(100, Math.max(0, suggestion.confidence ?? 0));
  const r = 12;
  const circ = 2 * Math.PI * r;
  const dash = (conf / 100) * circ;

  return (
    <div
      className={`relative rounded-xl border-l-4 ${stripeClass} overflow-hidden transition-all hover:shadow-lg hover:shadow-black/20`}
      style={{
        background: 'rgba(15,23,42,0.70)',
        borderTop: '1px solid var(--border)',
        borderRight: '1px solid var(--border)',
        borderBottom: '1px solid var(--border)',
      }}
    >
      <div className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-xl font-bold text-white">{suggestion.symbol}</span>
              <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border ${
                isOptions
                  ? 'bg-purple-500/15 text-purple-400 border-purple-500/30'
                  : 'bg-blue-500/15 text-blue-400 border-blue-500/30'
              }`}>
                {isOptions ? <Layers size={10} /> : <BarChart2 size={10} />}
                {isOptions ? 'Options' : 'Stock'}
              </span>
            </div>
            <p className="text-xs text-slate-400 truncate">{suggestion.companyName}</p>
          </div>

          {/* Confidence arc ring */}
          <div className="flex-shrink-0 flex flex-col items-center gap-0.5">
            <svg width="32" height="32" viewBox="0 0 32 32" className="-rotate-90">
              <circle cx="16" cy="16" r={r} fill="none" stroke="rgba(51,65,85,0.5)" strokeWidth="3" />
              <circle
                cx="16" cy="16" r={r}
                fill="none"
                stroke={conf >= 70 ? '#10b981' : conf >= 45 ? '#3b82f6' : '#f59e0b'}
                strokeWidth="3"
                strokeDasharray={`${dash} ${circ - dash}`}
                strokeLinecap="round"
              />
            </svg>
            <span className="text-xs font-semibold text-white leading-none">{conf}%</span>
          </div>
        </div>

        {/* Price */}
        <div className="flex items-baseline gap-2 mb-3">
          <span className="text-2xl font-bold text-emerald-400">
            ${suggestion.currentPrice.toFixed(2)}
          </span>
          {suggestion.details.targetPrice && (
            <span className="text-sm text-slate-400">
              → ${suggestion.details.targetPrice.toFixed(0)}
            </span>
          )}
        </div>

        {/* Reason */}
        <p className="text-sm text-slate-300 leading-relaxed mb-4">
          {suggestion.reason}
        </p>

        {/* Detail grid */}
        <div className="grid grid-cols-2 gap-2 mb-4">
          {isOptions ? (
            <>
              <div className="p-2 rounded-lg bg-slate-900/50">
                <p className="stat-label mb-0.5">Setup</p>
                <p className="stat-value flex items-center gap-1">
                  {suggestion.details.optionType === 'CALL'
                    ? <TrendingUp size={12} className="text-emerald-400" />
                    : <TrendingDown size={12} className="text-red-400" />}
                  ${suggestion.details.strike} {suggestion.details.optionType}
                </p>
              </div>
              <div className="p-2 rounded-lg bg-slate-900/50">
                <p className="stat-label mb-0.5">Premium</p>
                <p className="stat-value">{formatCurrency(suggestion.details.premiumTotal || 0)}</p>
              </div>
              <div className="p-2 rounded-lg bg-slate-900/50">
                <p className="stat-label mb-0.5">Volume</p>
                <p className="stat-value">{(suggestion.details.volumeContracts || 0).toLocaleString()}</p>
              </div>
              <div className="p-2 rounded-lg bg-slate-900/50">
                <p className="stat-label mb-0.5">Expiry</p>
                <p className="stat-value truncate">{suggestion.details.expiration}</p>
              </div>
            </>
          ) : (
            <>
              <div className="p-2 rounded-lg bg-slate-900/50">
                <p className="stat-label mb-0.5">Target</p>
                <p className="stat-value text-emerald-400">${suggestion.details.targetPrice?.toFixed(0)}</p>
              </div>
              <div className="p-2 rounded-lg bg-slate-900/50">
                <p className="stat-label mb-0.5">Upside</p>
                <p className="stat-value text-emerald-400">+{suggestion.details.expectedReturn?.toFixed(1)}%</p>
              </div>
              {suggestion.details.aiVotes && (
                <div className="p-2 rounded-lg bg-slate-900/50 col-span-2">
                  <p className="stat-label mb-0.5">AI Consensus</p>
                  <p className="stat-value">
                    {suggestion.details.aiVotes.bullish} of {suggestion.details.aiVotes.total} investors agree
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <button onClick={onExecute} className="btn-primary flex-1 justify-center">
            View &amp; Execute
          </button>
          <button
            onClick={onDismiss}
            className="btn-ghost px-2.5"
            title="Dismiss"
          >
            <X size={14} />
          </button>
        </div>

        {/* Timestamp */}
        <p className="mt-2 text-xs text-slate-600 text-center">
          Detected {new Date(suggestion.timestamp).toLocaleTimeString()}
        </p>
      </div>
    </div>
  );
}
