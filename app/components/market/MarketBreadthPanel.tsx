'use client';
import React, { useEffect, useState } from 'react';

interface SectorItem { name: string; etf: string; change: number }
interface BreadthData {
  vix: number;
  vixChange: number;
  spyChange: number;
  qqqChange: number;
  iwmChange: number;
  sectors: SectorItem[];
}

function ChangeChip({ label, value }: { label: string; value: number }) {
  const color = value > 0 ? 'text-emerald-400' : value < 0 ? 'text-red-400' : 'text-slate-400';
  return (
    <span className="text-[11px] flex gap-1">
      <span className="text-slate-500">{label}</span>
      <span className={`font-mono ${color}`}>{value >= 0 ? '+' : ''}{value.toFixed(2)}%</span>
    </span>
  );
}

export function MarketBreadthPanel() {
  const [data, setData] = useState<BreadthData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/market-breadth');
        if (res.ok) setData(await res.json());
      } catch { /* silent */ }
      finally { setLoading(false); }
    };
    load();
    const id = setInterval(load, 30000);
    return () => clearInterval(id);
  }, []);

  if (loading) return (
    <div className="bg-slate-900 border border-slate-700 rounded-lg p-3 animate-pulse h-20" />
  );
  if (!data) return null;

  const vixColor = data.vix > 30 ? 'text-red-400' : data.vix > 20 ? 'text-amber-400' : 'text-emerald-400';
  const vixLabel = data.vix > 30 ? 'HIGH FEAR' : data.vix > 20 ? 'ELEVATED' : 'CALM';

  const top3 = data.sectors.slice(0, 3);
  const bot3 = data.sectors.slice(-3).reverse();

  const smallCapSpread = (data.iwmChange - data.spyChange).toFixed(2);
  const riskOn = data.iwmChange > data.spyChange;

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-lg p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-slate-300 uppercase tracking-wide">Market Breadth</span>
        <div className="flex gap-3">
          <ChangeChip label="SPY" value={data.spyChange} />
          <ChangeChip label="QQQ" value={data.qqqChange} />
          <ChangeChip label="IWM" value={data.iwmChange} />
        </div>
      </div>

      <div className="flex items-center gap-4 flex-wrap">
        {/* VIX */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-slate-500">VIX</span>
          <span className={`text-sm font-bold font-mono ${vixColor}`}>{data.vix.toFixed(1)}</span>
          <span className={`text-[10px] px-1 py-0.5 rounded ${vixColor} bg-current/10 border border-current/20`}>{vixLabel}</span>
          <span className="text-[10px] text-slate-500">
            {data.vixChange >= 0 ? '▲' : '▼'}{Math.abs(data.vixChange).toFixed(1)}%
          </span>
        </div>

        {/* Sector leaders */}
        <div className="flex gap-1 flex-wrap">
          <span className="text-[10px] text-slate-500 self-center">Lead:</span>
          {top3.map((s) => (
            <span key={s.etf} className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-900/30 border border-emerald-700/30 text-emerald-400">
              {s.name} +{s.change.toFixed(1)}%
            </span>
          ))}
        </div>

        {/* Sector laggards */}
        <div className="flex gap-1 flex-wrap">
          <span className="text-[10px] text-slate-500 self-center">Lag:</span>
          {bot3.map((s) => (
            <span key={s.etf} className="text-[10px] px-1.5 py-0.5 rounded bg-red-900/30 border border-red-700/30 text-red-400">
              {s.name} {s.change.toFixed(1)}%
            </span>
          ))}
        </div>

        {/* Small/Large cap spread */}
        <div className="ml-auto text-[10px]">
          <span className="text-slate-500">IWM vs SPY: </span>
          <span className={riskOn ? 'text-emerald-400' : 'text-red-400'}>
            {riskOn ? '+' : ''}{smallCapSpread}% {riskOn ? '↑ Risk-On' : '↓ Risk-Off'}
          </span>
        </div>
      </div>
    </div>
  );
}
