'use client';
import React, { useState, useEffect } from 'react';
import { Calendar } from 'lucide-react';

interface EarningsEntry {
  ticker: string;
  date: string;
  quarter?: number;
  year?: number;
  hour?: string;
  epsEstimate?: number | null;
  revenueEstimate?: number | null;
}

function daysUntil(dateStr: string): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const target = new Date(dateStr + 'T00:00:00');
  return Math.round((target.getTime() - now.getTime()) / (1000 * 3600 * 24));
}

export function EarningsWidget({ ticker }: { ticker: string }) {
  const [earnings, setEarnings] = useState<EarningsEntry[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!ticker) return;
    setLoading(true);
    fetch(`/api/earnings?ticker=${ticker}`)
      .then(r => r.json())
      .then(d => setEarnings(d.earnings ?? []))
      .catch(() => setEarnings([]))
      .finally(() => setLoading(false));
  }, [ticker]);

  if (loading || earnings.length === 0) return null;

  const next = earnings[0];
  const days = daysUntil(next.date);
  const isClose = days <= 7;
  const isSoon = days <= 21;
  const when = next.hour === 'bmo' ? 'Before market open' : next.hour === 'amc' ? 'After market close' : '';

  return (
    <div className="p-3 rounded-xl border border-slate-700/50 bg-slate-800/20 flex items-start gap-3">
      <Calendar size={14} className="text-slate-400 mt-0.5 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold text-white">Earnings</span>
          <span className={`text-xs font-bold ${isClose ? 'text-amber-400' : isSoon ? 'text-blue-400' : 'text-slate-400'}`}>
            {days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : `In ${days} days`}
          </span>
          {next.quarter && (
            <span className="text-xs text-slate-500">Q{next.quarter} {next.year}</span>
          )}
        </div>
        <p className="text-xs text-slate-500 mt-0.5">{next.date}{when ? ` · ${when}` : ''}</p>
        {next.epsEstimate != null && (
          <p className="text-xs text-slate-400 mt-0.5">EPS est: <span className="text-white font-medium">${next.epsEstimate.toFixed(2)}</span></p>
        )}
        {isSoon && (
          <p className="text-xs text-emerald-400 mt-1">Consider IV expansion plays before event</p>
        )}
      </div>
    </div>
  );
}
