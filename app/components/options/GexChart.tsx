'use client';
import React, { useMemo } from 'react';

interface GexStrike {
  strike: number;
  callGEX: number;
  putGEX: number;
  netGEX: number;
}

interface GexWall {
  strike: number;
  level: number;
  type: 'CALL_WALL' | 'PUT_WALL';
}

interface GexData {
  netGEX: number;
  byStrike: GexStrike[];
  gexWalls: GexWall[];
  flipPoint: number | null;
  regime: 'POSITIVE' | 'NEGATIVE';
}

interface GexChartProps {
  gex: GexData;
  currentPrice: number;
}

// Format GEX value for display (values are already scaled in route)
function fmtGex(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 1000) return `${(v / 1000).toFixed(1)}K`;
  if (abs >= 1) return v.toFixed(1);
  return v.toFixed(2);
}

export function GexChart({ gex, currentPrice }: GexChartProps) {
  // Filter to ±12% from current price and keep meaningful strikes
  const strikes = useMemo(() => {
    const window = currentPrice * 0.12;
    return gex.byStrike
      .filter(s =>
        Math.abs(s.strike - currentPrice) <= window &&
        (Math.abs(s.callGEX) > 0.001 || Math.abs(s.putGEX) > 0.001)
      )
      .sort((a, b) => a.strike - b.strike);
  }, [gex.byStrike, currentPrice]);

  if (strikes.length === 0) return null;

  // Scale bars: max absolute value across all call/put bars
  const maxVal = Math.max(
    ...strikes.map(s => Math.max(Math.abs(s.callGEX), Math.abs(s.putGEX))),
    0.001
  );

  const wallStrikes = new Set(gex.gexWalls.map(w => w.strike));
  const isPositive = gex.regime === 'POSITIVE';

  // Net GEX label
  const netAbs = Math.abs(gex.netGEX);
  const netLabel = netAbs >= 1000
    ? `${(gex.netGEX / 1000).toFixed(1)}K`
    : gex.netGEX.toFixed(1);

  return (
    <div className="rounded-2xl border border-slate-700/50 bg-slate-800/30 p-4">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wide">
            Gamma Exposure (GEX)
          </h3>
          <p className="text-[10px] text-slate-500 mt-0.5">
            Dealer hedging pressure by strike · ±12% from spot
          </p>
        </div>
        <div className="text-right space-y-0.5">
          <div className={`text-xs font-bold font-mono ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
            Net {netLabel}
          </div>
          <div className={`text-[10px] px-2 py-0.5 rounded font-medium ${
            isPositive
              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
              : 'bg-red-500/10 text-red-400 border border-red-500/20'
          }`}>
            {isPositive ? '⊕ Long Gamma — moves dampened' : '⊖ Short Gamma — moves amplified'}
          </div>
        </div>
      </div>

      {/* Key levels row */}
      <div className="flex flex-wrap gap-2 mb-3">
        {gex.flipPoint != null && (
          <div className="flex items-center gap-1 text-[10px] px-2 py-1 rounded bg-amber-500/10 border border-amber-500/20">
            <span className="text-amber-400 font-semibold">↕ Flip</span>
            <span className="text-amber-300 font-mono">${gex.flipPoint}</span>
          </div>
        )}
        {gex.gexWalls.map((w, i) => (
          <div
            key={i}
            className={`flex items-center gap-1 text-[10px] px-2 py-1 rounded ${
              w.type === 'CALL_WALL'
                ? 'bg-emerald-500/10 border border-emerald-500/20'
                : 'bg-red-500/10 border border-red-500/20'
            }`}
          >
            <span className={w.type === 'CALL_WALL' ? 'text-emerald-400 font-semibold' : 'text-red-400 font-semibold'}>
              {w.type === 'CALL_WALL' ? '▲ Call Wall' : '▼ Put Wall'}
            </span>
            <span className={`font-mono ${w.type === 'CALL_WALL' ? 'text-emerald-300' : 'text-red-300'}`}>
              ${w.strike}
            </span>
          </div>
        ))}
      </div>

      {/* Bar chart */}
      <div className="space-y-1">
        {strikes.map((s) => {
          const callPct = Math.min((s.callGEX / maxVal) * 100, 100);
          const putPct = Math.min((s.putGEX / maxVal) * 100, 100);
          const isCurrentPrice = Math.abs(s.strike - currentPrice) / currentPrice < 0.005;
          const isWall = wallStrikes.has(s.strike);
          const isFlip = gex.flipPoint != null && s.strike === gex.flipPoint;

          return (
            <div key={s.strike} className="flex items-center gap-2">
              {/* Strike label */}
              <div className={`w-14 text-right text-[10px] font-mono shrink-0 ${
                isCurrentPrice ? 'text-white font-bold' : isWall ? 'text-amber-400' : 'text-slate-400'
              }`}>
                {isCurrentPrice && <span className="text-blue-400 mr-0.5">▶</span>}
                ${s.strike}
              </div>

              {/* Call GEX bar (right side, green) */}
              <div className="flex-1 flex items-center gap-1">
                {/* Put bar grows left */}
                <div className="flex-1 flex justify-end">
                  {s.putGEX > 0.001 && (
                    <div
                      className={`h-3 rounded-l-sm ${isWall && s.netGEX < 0 ? 'bg-red-400' : 'bg-red-500/60'}`}
                      style={{ width: `${putPct}%` }}
                      title={`Put GEX: ${fmtGex(s.putGEX)}`}
                    />
                  )}
                </div>

                {/* Center divider — current price marker */}
                <div className={`w-px h-4 shrink-0 ${isFlip ? 'bg-amber-400' : 'bg-slate-600'}`} />

                {/* Call bar grows right */}
                <div className="flex-1">
                  {s.callGEX > 0.001 && (
                    <div
                      className={`h-3 rounded-r-sm ${isWall && s.netGEX > 0 ? 'bg-emerald-400' : 'bg-emerald-500/60'}`}
                      style={{ width: `${callPct}%` }}
                      title={`Call GEX: ${fmtGex(s.callGEX)}`}
                    />
                  )}
                </div>
              </div>

              {/* Net label */}
              <div className={`w-10 text-[9px] font-mono shrink-0 ${
                s.netGEX > 0 ? 'text-emerald-400' : 'text-red-400'
              }`}>
                {s.netGEX > 0 ? '+' : ''}{fmtGex(s.netGEX)}
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-3 pt-2 border-t border-slate-700/40 text-[10px] text-slate-500">
        <span className="flex items-center gap-1">
          <span className="inline-block w-4 h-2 rounded-sm bg-emerald-500/60" /> Call GEX
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-4 h-2 rounded-sm bg-red-500/60" /> Put GEX
        </span>
        <span className="flex items-center gap-1">
          <span className="text-blue-400">▶</span> Spot
        </span>
        {gex.flipPoint != null && (
          <span className="flex items-center gap-1">
            <span className="inline-block w-px h-3 bg-amber-400" /> Flip point
          </span>
        )}
      </div>
    </div>
  );
}
