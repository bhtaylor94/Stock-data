'use client';
import React from 'react';

interface SuggestionCardProps {
  suggestion: any;
  onExecute: () => void;
  onDismiss: () => void;
}

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
  const isUrgent = suggestion.priority === 'URGENT';

  return (
    <div className={`p-4 rounded-xl border transition-all ${
      isUrgent 
        ? 'bg-gradient-to-br from-red-500/10 to-orange-500/5 border-red-500/30 shadow-lg shadow-red-500/10' 
        : 'bg-slate-800/50 border-slate-700 hover:border-blue-500/50'
    }`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xl md:text-2xl font-bold text-white truncate">
              {suggestion.symbol}
            </span>
            <span className={`text-xs px-2 py-0.5 rounded-full ${
              isOptions ? 'bg-purple-500/20 text-purple-400' : 'bg-blue-500/20 text-blue-400'
            }`}>
              {isOptions ? '📈 Options' : '📊 Stock'}
            </span>
          </div>
          <p className="text-xs md:text-sm text-slate-400 truncate">
            {suggestion.companyName}
          </p>
        </div>

        {/* Confidence */}
        <div className="text-right flex-shrink-0">
          <div className="text-lg md:text-xl font-bold text-white">
            {suggestion.confidence}%
          </div>
          <div className="text-xs text-slate-400">
            Confidence
          </div>
        </div>
      </div>

      {/* Current Price */}
      <div className="flex items-baseline gap-2 mb-3">
        <span className="text-2xl md:text-3xl font-bold text-emerald-400">
          ${suggestion.currentPrice.toFixed(2)}
        </span>
        {suggestion.details.targetPrice && (
          <span className="text-sm text-slate-400">
            → ${suggestion.details.targetPrice.toFixed(0)}
          </span>
        )}
      </div>

      {/* Reason */}
      <div className="mb-4">
        <p className="text-sm text-slate-300 leading-relaxed">
          {suggestion.reason}
        </p>
      </div>

      {/* Details */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        {isOptions ? (
          <>
            <div className="p-2 rounded-lg bg-slate-900/50">
              <p className="text-xs text-slate-400">Setup</p>
              <p className="text-sm font-bold text-white">
                {suggestion.details.optionType === 'CALL' ? '📈 ' : '📉 '}
                ${suggestion.details.strike} {suggestion.details.optionType}
              </p>
            </div>
            <div className="p-2 rounded-lg bg-slate-900/50">
              <p className="text-xs text-slate-400">Premium</p>
              <p className="text-sm font-bold text-white">
                {formatCurrency(suggestion.details.premiumTotal || 0)}
              </p>
            </div>
            <div className="p-2 rounded-lg bg-slate-900/50">
              <p className="text-xs text-slate-400">Volume</p>
              <p className="text-sm font-bold text-white">
                {(suggestion.details.volumeContracts || 0).toLocaleString()}
              </p>
            </div>
            <div className="p-2 rounded-lg bg-slate-900/50">
              <p className="text-xs text-slate-400">Expiry</p>
              <p className="text-sm font-bold text-white truncate">
                {suggestion.details.expiration}
              </p>
            </div>
          </>
        ) : (
          <>
            <div className="p-2 rounded-lg bg-slate-900/50">
              <p className="text-xs text-slate-400">Target</p>
              <p className="text-sm font-bold text-emerald-400">
                ${suggestion.details.targetPrice?.toFixed(0)}
              </p>
            </div>
            <div className="p-2 rounded-lg bg-slate-900/50">
              <p className="text-xs text-slate-400">Upside</p>
              <p className="text-sm font-bold text-emerald-400">
                +{suggestion.details.expectedReturn?.toFixed(1)}%
              </p>
            </div>
            {suggestion.details.aiVotes && (
              <>
                <div className="p-2 rounded-lg bg-slate-900/50 col-span-2">
                  <p className="text-xs text-slate-400 mb-1">AI Consensus</p>
                  <p className="text-sm font-bold text-white">
                    {suggestion.details.aiVotes.bullish} of {suggestion.details.aiVotes.total} investors agree
                  </p>
                </div>
              </>
            )}
          </>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={onExecute}
          className="flex-1 py-3 rounded-xl bg-gradient-to-r from-blue-500 to-emerald-500 hover:from-blue-600 hover:to-emerald-600 text-white font-bold text-sm transition-all shadow-lg shadow-blue-500/20"
        >
          🎯 View & Execute
        </button>
        <button
          onClick={onDismiss}
          className="px-4 py-3 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-300 transition-all text-sm"
          title="Dismiss"
        >
          ❌
        </button>
      </div>

      {/* Timestamp */}
      <div className="mt-2 text-xs text-slate-500 text-center">
        Detected {new Date(suggestion.timestamp).toLocaleTimeString()}
      </div>
    </div>
  );
}
