'use client';
import React, { useEffect, useState } from 'react';

interface COTMarket {
  date: string;
  largeSpecNet: number;
  commercialNet: number;
  largeSpecNorm: number;  // -100 to +100
  commercialNorm: number; // -100 to +100
}
interface COTData {
  sp500: COTMarket | null;
  nasdaq: COTMarket | null;
}

function Gauge({ norm, label, color }: { norm: number; label: string; color: string }) {
  // norm is -100 to +100
  const pct = (norm + 100) / 2; // 0..100%
  const barColor = norm > 20 ? 'bg-emerald-500' : norm < -20 ? 'bg-red-500' : 'bg-amber-500';
  return (
    <div className="space-y-0.5">
      <div className="flex justify-between text-[10px] text-slate-500">
        <span>{label}</span>
        <span className={norm > 0 ? 'text-emerald-400' : 'text-red-400'}>
          {norm > 0 ? '+' : ''}{norm}
        </span>
      </div>
      <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
        <div
          className={`h-full ${barColor} rounded-full transition-all`}
          style={{ width: `${Math.max(4, pct)}%` }}
        />
      </div>
      <div className="flex justify-between text-[9px] text-slate-600">
        <span>Max Short</span>
        <span>Max Long</span>
      </div>
    </div>
  );
}

function MarketBlock({ label, data }: { label: string; data: COTMarket }) {
  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <span className="text-xs font-semibold text-slate-300">{label}</span>
        <span className="text-[10px] text-slate-500">as of {data.date.slice(5)}</span>
      </div>
      <Gauge norm={data.largeSpecNorm} label="Large Specs (trend-following)" color="blue" />
      <Gauge norm={data.commercialNorm} label="Commercials (smart money)" color="purple" />
      <p className="text-[10px] text-slate-500 leading-relaxed">
        {data.commercialNorm < -60
          ? '⚠️ Smart money heavily short — contrarian bullish signal'
          : data.commercialNorm > 40
          ? '⚠️ Smart money heavily long — contrarian bearish signal'
          : 'Commercials near neutral — no extreme contrarian signal'}
      </p>
    </div>
  );
}

export function COTWidget() {
  const [data, setData] = useState<COTData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch('/api/cot')
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setData)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="bg-slate-900 border border-slate-700 rounded-lg p-3 animate-pulse h-40" />
  );
  if (error || (!data?.sp500 && !data?.nasdaq)) return (
    <div className="bg-slate-900 border border-slate-700 rounded-lg p-3">
      <p className="text-xs text-slate-500">COT data unavailable</p>
    </div>
  );

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-lg p-3 space-y-4">
      <span className="text-xs font-semibold text-slate-300 uppercase tracking-wide">CFTC COT Positioning</span>
      {data.sp500 && <MarketBlock label="E-Mini S&P 500" data={data.sp500} />}
      {data.nasdaq && <MarketBlock label="E-Mini NASDAQ-100" data={data.nasdaq} />}
    </div>
  );
}
