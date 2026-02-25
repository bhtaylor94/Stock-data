'use client';
import React from 'react';
import { TrendingUp, TrendingDown, Shield } from 'lucide-react';

interface FlowEntry {
  alertType?: string;
  strike: number;
  type: string;
  expiration: string;
  dte?: number;
  uoaScore?: number;
  isHedge?: boolean;
  signals?: string[];
  premiumFormatted?: string;
}

function alertChip(alertType: string): string {
  switch (alertType) {
    case 'GOLDEN_SWEEP': return 'text-amber-400 bg-amber-500/10 border-amber-500/30';
    case 'SWEEP':        return 'text-blue-400 bg-blue-500/10 border-blue-500/30';
    case 'BLOCK':        return 'text-indigo-400 bg-indigo-500/10 border-indigo-500/30';
    case 'REPEATED_HIT': return 'text-purple-400 bg-purple-500/10 border-purple-500/30';
    default:             return 'text-slate-400 bg-slate-700/20 border-slate-700/40';
  }
}

export function FlowTape({ activities }: { activities: FlowEntry[] }) {
  if (!activities || activities.length === 0) return null;

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-white px-1">Options Flow Tape</h3>
      <div className="rounded-xl border border-slate-700/40 overflow-hidden">
        <div className="max-h-[280px] overflow-y-auto divide-y divide-slate-800/60">
          {activities.map((a) => {
            const isCall = a.type?.toLowerCase() === 'call';
            const alertType = a.alertType ?? 'UNUSUAL_VOLUME';
            const alertLabel = alertType.replace(/_/g, ' ');
            const scoreColor =
              (a.uoaScore ?? 0) >= 75 ? 'text-red-400'
              : (a.uoaScore ?? 0) >= 50 ? 'text-amber-400'
              : 'text-slate-500';
            return (
              <div
                key={`${a.type}-${a.strike}-${a.expiration}`}
                className={`flex items-center gap-2.5 px-3 py-2 transition-colors ${
                  isCall ? 'hover:bg-emerald-500/5' : 'hover:bg-red-500/5'
                }`}
              >
                {isCall
                  ? <TrendingUp size={12} className="text-emerald-400 flex-shrink-0" />
                  : <TrendingDown size={12} className="text-red-400 flex-shrink-0" />
                }
                <span className="text-xs font-bold text-white font-mono flex-shrink-0">
                  ${a.strike} {a.type?.toUpperCase()}
                </span>
                <span className="text-xs text-slate-500 flex-shrink-0">{a.expiration}</span>
                {a.dte != null && (
                  <span className="text-[10px] text-slate-600 flex-shrink-0">{a.dte}d</span>
                )}
                {a.isHedge && <Shield size={9} className="text-slate-500 flex-shrink-0" />}
                <span className="flex-1" />
                {a.premiumFormatted && (
                  <span className="text-xs text-slate-400 flex-shrink-0">{a.premiumFormatted}</span>
                )}
                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded border flex-shrink-0 ${alertChip(alertType)}`}>
                  {alertLabel}
                </span>
                {a.uoaScore != null && (
                  <span className={`text-xs font-bold w-5 text-right flex-shrink-0 ${scoreColor}`}>
                    {a.uoaScore}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
