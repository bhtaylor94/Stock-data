'use client';
import React from 'react';

interface TermPoint {
  dte: number;
  atmIV: number; // percentage e.g. 28.0
}

interface HVByWindow {
  hv10: number;
  hv20: number;
  hv30: number;
  hv60: number;
  hv90: number;
}

interface VolConeChartProps {
  termStructure: TermPoint[];
  hvByWindow: HVByWindow;
  shape: 'BACKWARDATION' | 'CONTANGO' | 'FLAT' | 'HUMPED';
  nearTermIV: number;
  longerTermIV: number;
  ivSpread: number;
}

const SHAPE_COLOR: Record<string, string> = {
  BACKWARDATION: 'text-amber-400',
  CONTANGO: 'text-blue-400',
  FLAT: 'text-slate-400',
  HUMPED: 'text-purple-400',
};

const SHAPE_DESC: Record<string, string> = {
  BACKWARDATION: 'Near > Far — elevated near-term event risk',
  CONTANGO: 'Far > Near — normal, growing uncertainty priced out',
  FLAT: 'Uniform IV across expirations',
  HUMPED: 'Mid-term IV peak — event in middle dates',
};

export function VolConeChart({ termStructure, hvByWindow, shape, nearTermIV, longerTermIV, ivSpread }: VolConeChartProps) {
  if (!termStructure || termStructure.length < 2) return null;

  const W = 340;
  const H = 150;
  const PAD = { l: 34, r: 16, t: 10, b: 26 };
  const chartW = W - PAD.l - PAD.r;
  const chartH = H - PAD.t - PAD.b;

  // HV values for reference lines
  const hvVals = Object.values(hvByWindow).filter(v => v > 0);
  const hvMin = hvVals.length > 0 ? Math.min(...hvVals) : 0;
  const hvMax = hvVals.length > 0 ? Math.max(...hvVals) : 0;
  const hvRef = hvByWindow.hv30 || hvByWindow.hv20; // primary reference line

  // Scale bounds
  const allIVs = termStructure.map(t => t.atmIV);
  const yMax = Math.max(...allIVs, hvMax) * 1.25;
  const yMin = 0;

  const maxDTE = Math.max(...termStructure.map(t => t.dte));
  const xOf = (dte: number) => (dte / Math.max(maxDTE, 1)) * chartW;
  const yOf = (iv: number) => chartH - ((iv - yMin) / (yMax - yMin)) * chartH;

  // Build the HV cone polygon:
  // Near term (DTE=0): cone collapses to hvRef (realized vol doesn't diverge at near term)
  // Far term (maxDTE): cone spans from hvMin to hvMax
  const STEPS = 40;
  const upperPts: string[] = [];
  const lowerPts: string[] = [];
  for (let i = 0; i <= STEPS; i++) {
    const t = i / STEPS;
    const x = t * chartW;
    const upper = hvRef + t * (hvMax - hvRef);
    const lower = hvRef - t * (hvRef - hvMin);
    upperPts.push(`${x.toFixed(1)},${yOf(upper).toFixed(1)}`);
    lowerPts.push(`${x.toFixed(1)},${yOf(lower).toFixed(1)}`);
  }
  const conePolygon = [...upperPts, ...[...lowerPts].reverse()].join(' ');

  // IV term structure polyline
  const ivPolyline = termStructure.map(t => `${xOf(t.dte).toFixed(1)},${yOf(t.atmIV).toFixed(1)}`).join(' ');

  // Y-axis ticks
  const yTickCount = 4;
  const yTicks = Array.from({ length: yTickCount + 1 }, (_, i) => Math.round((yMax / yTickCount) * i));

  // X-axis labels — show DTE at each data point
  const xLabels = termStructure.filter((_, i) => i === 0 || i === termStructure.length - 1 || i % Math.ceil(termStructure.length / 4) === 0);

  const shapeColor = SHAPE_COLOR[shape] ?? 'text-slate-400';

  return (
    <div className="rounded-2xl border border-slate-700/50 bg-slate-800/30 p-4">
      {/* Header */}
      <div className="flex items-start justify-between mb-2">
        <div>
          <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wide">Vol Cone</h3>
          <p className="text-[10px] text-slate-500 mt-0.5">IV term structure vs realized vol range</p>
        </div>
        <div className="text-right">
          <span className={`text-[10px] font-bold uppercase tracking-wide ${shapeColor}`}>{shape}</span>
          <p className="text-[9px] text-slate-600 mt-0.5 max-w-[140px] text-right leading-tight">{SHAPE_DESC[shape]}</p>
        </div>
      </div>

      {/* SVG chart */}
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="w-full">
        <g transform={`translate(${PAD.l},${PAD.t})`}>
          {/* HV cone shaded area */}
          <polygon points={conePolygon} fill="rgba(100,116,139,0.12)" />

          {/* HV outer bounds (faint lines) */}
          {hvMax > 0 && (
            <line
              x1={0} y1={yOf(hvMax)} x2={chartW} y2={yOf(hvMax)}
              stroke="rgba(100,116,139,0.25)" strokeWidth={1} strokeDasharray="2,4"
            />
          )}
          {hvMin > 0 && hvMin !== hvMax && (
            <line
              x1={0} y1={yOf(hvMin)} x2={chartW} y2={yOf(hvMin)}
              stroke="rgba(100,116,139,0.25)" strokeWidth={1} strokeDasharray="2,4"
            />
          )}

          {/* HV30 reference line */}
          {hvRef > 0 && (
            <>
              <line
                x1={0} y1={yOf(hvRef)} x2={chartW} y2={yOf(hvRef)}
                stroke="rgba(100,116,139,0.55)" strokeWidth={1.5} strokeDasharray="4,3"
              />
              <text x={chartW + 2} y={yOf(hvRef) + 3} fill="rgba(100,116,139,0.65)" fontSize={7.5} dominantBaseline="middle">HV</text>
            </>
          )}

          {/* Current IV polyline */}
          <polyline
            points={ivPolyline}
            fill="none"
            stroke="rgba(59,130,246,0.85)"
            strokeWidth={2}
            strokeLinejoin="round"
          />

          {/* IV data points */}
          {termStructure.map((t, i) => (
            <circle
              key={i}
              cx={xOf(t.dte)}
              cy={yOf(t.atmIV)}
              r={3}
              fill="rgb(59,130,246)"
              stroke="rgba(15,23,42,0.8)"
              strokeWidth={1}
            />
          ))}

          {/* Y-axis */}
          <line x1={0} y1={0} x2={0} y2={chartH} stroke="rgba(100,116,139,0.3)" strokeWidth={1} />
          {yTicks.map(tick => (
            <g key={tick}>
              <line x1={-3} y1={yOf(tick)} x2={0} y2={yOf(tick)} stroke="rgba(100,116,139,0.3)" strokeWidth={1} />
              <text x={-5} y={yOf(tick)} fill="rgba(100,116,139,0.65)" fontSize={7.5} textAnchor="end" dominantBaseline="middle">
                {tick}%
              </text>
            </g>
          ))}

          {/* X-axis */}
          <line x1={0} y1={chartH} x2={chartW} y2={chartH} stroke="rgba(100,116,139,0.3)" strokeWidth={1} />
          {xLabels.map((t, i) => (
            <text
              key={i}
              x={xOf(t.dte)}
              y={chartH + 14}
              fill="rgba(100,116,139,0.65)"
              fontSize={7.5}
              textAnchor="middle"
            >
              {t.dte}d
            </text>
          ))}
        </g>
      </svg>

      {/* Stats row */}
      <div className="flex items-center gap-4 mt-1.5 pt-1.5 border-t border-slate-700/30">
        <div className="flex items-center gap-1.5">
          <div className="w-5 h-[2px] bg-blue-500 rounded" />
          <span className="text-[10px] text-slate-400">Current IV</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-5 h-[1px] border-t border-dashed border-slate-500/60" />
          <span className="text-[10px] text-slate-400">HV30 ref</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-5 h-3 rounded-sm" style={{ background: 'rgba(100,116,139,0.15)', border: '1px solid rgba(100,116,139,0.2)' }} />
          <span className="text-[10px] text-slate-400">HV range</span>
        </div>
        <div className="ml-auto flex items-center gap-3 text-[10px]">
          <span className="text-slate-500">Front</span>
          <span className="font-mono font-semibold text-white">{nearTermIV.toFixed(1)}%</span>
          <span className="text-slate-500">Back</span>
          <span className="font-mono font-semibold text-white">{longerTermIV.toFixed(1)}%</span>
          <span className={`font-mono font-semibold ${ivSpread > 0 ? 'text-amber-400' : ivSpread < 0 ? 'text-blue-400' : 'text-slate-400'}`}>
            {ivSpread > 0 ? '+' : ''}{ivSpread.toFixed(1)}
          </span>
        </div>
      </div>
    </div>
  );
}
