'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { TrendingUp, TrendingDown, BarChart2 } from 'lucide-react';

interface SectorData {
  tickers: string[];
  avgHeat: number;
  bullCount: number;
  bearCount: number;
}

export function SectorHeatMap() {
  const [sectorMap, setSectorMap] = useState<Record<string, SectorData>>({});
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/scanner');
      if (!res.ok) return;
      const json = await res.json();
      if (json.sectorMap) setSectorMap(json.sectorMap);
    } catch {
      // silent fail — ScannerFeed shows the error
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30_000);
    return () => clearInterval(interval);
  }, [fetchData]);

  if (loading || Object.keys(sectorMap).length === 0) return null;

  const sectors = Object.entries(sectorMap).sort(([, a], [, b]) => b.avgHeat - a.avgHeat);

  return (
    <div className="rounded-2xl border border-slate-700/50 bg-slate-800/20 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-700/40">
        <h2 className="text-sm font-semibold text-white flex items-center gap-1.5">
          <BarChart2 size={14} className="text-purple-400" />
          Sector Momentum
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Average heat score and directional bias by sector — sorted hottest first
        </p>
      </div>

      <div className="p-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
        {sectors.map(([sector, data]) => {
          const heat = Math.round(data.avgHeat);
          const total = data.bullCount + data.bearCount;
          const bullPct = total > 0 ? Math.round((data.bullCount / total) * 100) : 50;

          const heatBorder =
            heat >= 70 ? 'border-red-500/25 bg-red-500/5'
            : heat >= 40 ? 'border-amber-500/25 bg-amber-500/5'
            : 'border-emerald-500/20 bg-emerald-500/5';
          const barColor = heat >= 70 ? 'bg-red-400' : heat >= 40 ? 'bg-amber-400' : 'bg-emerald-400';
          const textColor = heat >= 70 ? 'text-red-400' : heat >= 40 ? 'text-amber-400' : 'text-emerald-400';

          return (
            <div key={sector} className={`p-3 rounded-xl border ${heatBorder}`}>
              {/* Sector name + heat score */}
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-semibold text-white truncate leading-tight">{sector}</span>
                <span className={`text-xs font-bold ml-2 flex-shrink-0 ${textColor}`}>{heat}</span>
              </div>

              {/* Heat bar */}
              <div className="h-1 bg-slate-800 rounded-full overflow-hidden mb-2">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${barColor}`}
                  style={{ width: `${heat}%` }}
                />
              </div>

              {/* Bull/bear count + bull% */}
              <div className="flex items-center gap-2 text-[10px] mb-1.5">
                <span className="flex items-center gap-0.5 text-emerald-400">
                  <TrendingUp size={9} />{data.bullCount}↑
                </span>
                <span className="flex items-center gap-0.5 text-red-400">
                  <TrendingDown size={9} />{data.bearCount}↓
                </span>
                <span className="ml-auto text-slate-500">{bullPct}% bull</span>
              </div>

              {/* All tickers */}
              <p className="text-[10px] text-slate-500 font-mono truncate">
                {data.tickers.join(' · ')}
              </p>
            </div>
          );
        })}
      </div>

      <div className="px-4 py-2 border-t border-slate-800/60">
        <p className="text-[10px] text-slate-600">
          Heat = avg momentum score of all tickers in that sector · Updated every 30s
        </p>
      </div>
    </div>
  );
}
