'use client';
import React, { useMemo } from 'react';

interface Contract {
  strike: number;
  iv: number;
}
interface ByExpiration {
  [exp: string]: { calls: Contract[]; puts: Contract[] };
}

interface IVSurfaceHeatmapProps {
  byExpiration: ByExpiration;
  currentPrice: number;
  selectedExp: string;
  onSelectExp: (exp: string) => void;
}

function ivColor(iv: number | null): string {
  if (iv === null) return '#1e293b';
  const clamped = Math.min(Math.max(iv * 100, 10), 100);
  // green (low IV) → yellow → red (high IV)
  const hue = 120 - clamped * 1.2;
  return `hsl(${Math.max(0, hue)}, 70%, 32%)`;
}

export function IVSurfaceHeatmap({
  byExpiration, currentPrice, selectedExp, onSelectExp,
}: IVSurfaceHeatmapProps) {
  const { exps, strikeBuckets, matrix } = useMemo(() => {
    const allExps = Object.keys(byExpiration).sort();
    const exps = allExps.slice(0, 8);

    // Build strike buckets: ATM-4 to ATM+4 in 5-point increments
    const atmRaw = Math.round(currentPrice / 5) * 5;
    const strikeBuckets = Array.from({ length: 9 }, (_, i) => atmRaw + (i - 4) * 5);

    // Build IV matrix[exp][strikeIdx]
    const matrix: (number | null)[][] = exps.map((exp) => {
      const { calls = [], puts = [] } = byExpiration[exp] ?? {};
      return strikeBuckets.map((targetStrike) => {
        // Find nearest call by strike
        const allContracts = [...calls, ...puts];
        if (!allContracts.length) return null;
        const nearest = allContracts.reduce((best, c) => {
          return Math.abs(c.strike - targetStrike) < Math.abs(best.strike - targetStrike) ? c : best;
        });
        if (Math.abs(nearest.strike - targetStrike) > 10) return null;
        return nearest.iv && nearest.iv > 0 ? nearest.iv : null;
      });
    });

    return { exps, strikeBuckets, matrix };
  }, [byExpiration, currentPrice]);

  if (exps.length < 2) return null;

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-lg p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-slate-300 uppercase tracking-wide">
          IV Surface
        </span>
        <span className="text-xs text-slate-500">Click expiration to explore chain</span>
      </div>

      <div className="overflow-x-auto">
        <table className="text-[10px] w-full border-collapse">
          <thead>
            <tr>
              <th className="text-slate-500 text-left pr-2 pb-1 font-normal w-20">Exp</th>
              {strikeBuckets.map((s) => (
                <th key={s} className={`text-center pb-1 font-normal px-0.5 ${Math.abs(s - currentPrice) < 3 ? 'text-blue-400' : 'text-slate-500'}`}>
                  ${s}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {exps.map((exp, rowIdx) => (
              <tr
                key={exp}
                className={`cursor-pointer transition-opacity ${selectedExp === exp ? 'opacity-100 ring-1 ring-inset ring-blue-500' : 'opacity-80 hover:opacity-100'}`}
                onClick={() => onSelectExp(exp)}
              >
                <td className="pr-2 py-0.5 text-slate-400 whitespace-nowrap">{exp.slice(5)}</td>
                {matrix[rowIdx].map((iv, colIdx) => (
                  <td
                    key={colIdx}
                    className="text-center py-0.5 px-0.5"
                    style={{ backgroundColor: ivColor(iv) }}
                    title={iv !== null ? `IV: ${(iv * 100).toFixed(1)}%` : 'No data'}
                  >
                    {iv !== null ? (
                      <span className="text-white/80">{Math.round(iv * 100)}</span>
                    ) : (
                      <span className="text-slate-600">—</span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-2 mt-2">
        <span className="text-[10px] text-slate-500">IV%:</span>
        <div className="flex gap-px">
          {[10, 25, 40, 55, 70, 90].map((v) => (
            <div key={v} className="w-6 h-2 rounded-sm" style={{ backgroundColor: ivColor(v / 100) }} title={`${v}%`} />
          ))}
        </div>
        <span className="text-[10px] text-slate-500">Low → High</span>
      </div>
    </div>
  );
}
