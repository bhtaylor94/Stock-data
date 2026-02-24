'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';

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
      // silent fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60_000);
    return () => clearInterval(interval);
  }, [fetchData]);

  if (loading || Object.keys(sectorMap).length === 0) return null;

  const sectors = Object.entries(sectorMap).sort(([, a], [, b]) => b.avgHeat - a.avgHeat);

  return (
    <div className="space-y-2">
      <h2 className="text-sm font-semibold text-white">Sector Heat</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
        {sectors.map(([sector, data]) => {
          const heat = Math.round(data.avgHeat);
          const heatClass =
            heat >= 70 ? 'border-red-500/25 bg-red-500/5'
            : heat >= 40 ? 'border-amber-500/25 bg-amber-500/5'
            : 'border-emerald-500/20 bg-emerald-500/5';
          const barColor = heat >= 70 ? 'bg-red-400' : heat >= 40 ? 'bg-amber-400' : 'bg-emerald-400';
          const textColor = heat >= 70 ? 'text-red-400' : heat >= 40 ? 'text-amber-400' : 'text-emerald-400';
          return (
            <div key={sector} className={`p-3 rounded-xl border ${heatClass}`}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-semibold text-white truncate leading-tight">{sector}</span>
                <span className={`text-xs font-bold ml-2 flex-shrink-0 ${textColor}`}>{heat}</span>
              </div>
              <div className="h-1 bg-slate-800 rounded-full overflow-hidden mb-2">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${barColor}`}
                  style={{ width: `${heat}%` }}
                />
              </div>
              <div className="flex items-center gap-2 text-[10px]">
                <span className="flex items-center gap-0.5 text-emerald-400">
                  <TrendingUp size={9} />{data.bullCount}
                </span>
                <span className="flex items-center gap-0.5 text-red-400">
                  <TrendingDown size={9} />{data.bearCount}
                </span>
                <span className="text-slate-500 ml-auto font-mono">
                  {data.tickers.slice(0, 2).join(' ')}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
