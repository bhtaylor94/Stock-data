'use client';
import React, { useRef, useState } from 'react';

interface Contract {
  strike: number;
  iv: number;
  type: 'call' | 'put';
}

interface TooltipState {
  x: number;
  y: number;
  strike: number;
  callIV?: number;
  putIV?: number;
}

export function IVSkewChart({
  calls,
  puts,
  currentPrice,
  expiration,
}: {
  calls: Contract[];
  puts: Contract[];
  currentPrice: number;
  expiration?: string;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  const W = 100; // viewBox units (percentage-based)
  const H = 180;
  const PAD = { top: 10, right: 10, bottom: 24, left: 32 };
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  // Filter to ±20% of current price
  const range = currentPrice * 0.20;
  const filteredCalls = calls.filter(c => c.iv > 0 && Math.abs(c.strike - currentPrice) <= range).sort((a, b) => a.strike - b.strike);
  const filteredPuts = puts.filter(p => p.iv > 0 && Math.abs(p.strike - currentPrice) <= range).sort((a, b) => a.strike - b.strike);

  if (filteredCalls.length < 2 && filteredPuts.length < 2) {
    return (
      <div className="rounded-2xl border border-slate-700/50 bg-slate-800/20 p-4">
        <p className="text-xs text-slate-500 text-center">No IV skew data available</p>
      </div>
    );
  }

  const allStrikes = Array.from(new Set([...filteredCalls.map(c => c.strike), ...filteredPuts.map(p => p.strike)])).sort((a, b) => a - b);
  const allIVs = [...filteredCalls.map(c => c.iv), ...filteredPuts.map(p => p.iv)];
  const minStrike = allStrikes[0];
  const maxStrike = allStrikes[allStrikes.length - 1];
  const maxIV = Math.max(...allIVs) * 1.1;
  const minIV = 0;

  function toX(strike: number): number {
    if (maxStrike === minStrike) return PAD.left + plotW / 2;
    return PAD.left + ((strike - minStrike) / (maxStrike - minStrike)) * plotW;
  }
  function toY(iv: number): number {
    return PAD.top + plotH - ((iv - minIV) / (maxIV - minIV)) * plotH;
  }
  function toXPx(strike: number): number {
    return (toX(strike) / W) * (svgRef.current?.clientWidth ?? 400);
  }

  // Build SVG path strings
  function buildPath(data: { strike: number; iv: number }[]): string {
    if (data.length === 0) return '';
    return data.map((d, i) => `${i === 0 ? 'M' : 'L'} ${toX(d.strike).toFixed(1)} ${toY(d.iv).toFixed(1)}`).join(' ');
  }

  const callPath = buildPath(filteredCalls);
  const putPath = buildPath(filteredPuts);
  const atmX = toX(currentPrice);

  // Y-axis labels (IV%)
  const yTicks = 4;
  const yLabels = Array.from({ length: yTicks + 1 }, (_, i) => {
    const iv = (maxIV * i) / yTicks;
    return { iv, y: toY(iv) };
  });

  // X-axis labels (every ~$5 increment)
  const strikeRange = maxStrike - minStrike;
  const xStep = strikeRange > 50 ? 10 : strikeRange > 20 ? 5 : 2;
  const xStart = Math.ceil(minStrike / xStep) * xStep;
  const xLabels: { strike: number; x: number }[] = [];
  for (let s = xStart; s <= maxStrike; s += xStep) {
    if (s >= minStrike) xLabels.push({ strike: s, x: toX(s) });
  }

  // Mouse interaction
  const callIVMap = new Map(filteredCalls.map(c => [c.strike, c.iv]));
  const putIVMap = new Map(filteredPuts.map(p => [p.strike, p.iv]));

  function handleMouseMove(e: React.MouseEvent<SVGSVGElement>) {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const relX = (e.clientX - rect.left) / rect.width;
    const svgX = relX * W;
    const fracAlongAxis = Math.max(0, Math.min(1, (svgX - PAD.left) / plotW));
    const strike = minStrike + fracAlongAxis * (maxStrike - minStrike);
    // Find nearest strike
    const nearest = allStrikes.reduce((p, s) => Math.abs(s - strike) < Math.abs(p - strike) ? s : p, allStrikes[0]);
    setTooltip({
      x: toXPx(nearest),
      y: e.clientY - rect.top,
      strike: nearest,
      callIV: callIVMap.get(nearest),
      putIV: putIVMap.get(nearest),
    });
  }

  return (
    <div className="rounded-2xl border border-slate-700/50 bg-slate-800/20 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700/40">
        <h3 className="text-sm font-semibold text-white">IV Skew</h3>
        {expiration && <span className="text-xs text-slate-500">{expiration}</span>}
        <div className="flex items-center gap-3">
          <span className="text-xs text-emerald-400 flex items-center gap-1"><span className="w-3 h-0.5 bg-emerald-400 inline-block" />Calls</span>
          <span className="text-xs text-red-400 flex items-center gap-1"><span className="w-3 h-0.5 bg-red-400 inline-block" />Puts</span>
        </div>
      </div>
      <div className="relative px-2 pb-2">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          style={{ height: 160 }}
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setTooltip(null)}
        >
          {/* Grid lines */}
          {yLabels.map(({ y }, i) => (
            <line key={i} x1={PAD.left} x2={W - PAD.right} y1={y} y2={y} stroke="rgba(51,65,85,0.4)" strokeWidth="0.3" />
          ))}

          {/* Y-axis labels (IV %) */}
          {yLabels.map(({ iv, y }, i) => (
            <text key={i} x={PAD.left - 2} y={y + 1} textAnchor="end" fontSize="3.5" fill="#475569">
              {(iv * 100).toFixed(0)}%
            </text>
          ))}

          {/* X-axis labels (strikes) */}
          {xLabels.map(({ strike, x }) => (
            <text key={strike} x={x} y={H - 4} textAnchor="middle" fontSize="3.5" fill="#475569">
              ${strike}
            </text>
          ))}

          {/* ATM vertical line */}
          {currentPrice >= minStrike && currentPrice <= maxStrike && (
            <line
              x1={atmX} x2={atmX}
              y1={PAD.top} y2={H - PAD.bottom}
              stroke="#64748b" strokeWidth="0.5" strokeDasharray="1.5 1"
            />
          )}

          {/* Call IV line */}
          {callPath && <path d={callPath} fill="none" stroke="#10b981" strokeWidth="1.2" strokeLinejoin="round" />}

          {/* Put IV line */}
          {putPath && <path d={putPath} fill="none" stroke="#ef4444" strokeWidth="1.2" strokeLinejoin="round" />}

          {/* ATM label */}
          {currentPrice >= minStrike && currentPrice <= maxStrike && (
            <text x={atmX + 1} y={PAD.top + 5} fontSize="3" fill="#64748b">ATM</text>
          )}

          {/* Tooltip crosshair */}
          {tooltip && (
            <line
              x1={toX(tooltip.strike)} x2={toX(tooltip.strike)}
              y1={PAD.top} y2={H - PAD.bottom}
              stroke="rgba(255,255,255,0.2)" strokeWidth="0.5"
            />
          )}
        </svg>

        {/* HTML tooltip overlay */}
        {tooltip && (
          <div
            className="absolute pointer-events-none bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-xs shadow-lg z-10"
            style={{ left: Math.min(tooltip.x, 260), top: 8, transform: 'translateX(-50%)' }}
          >
            <p className="font-bold text-white mb-0.5">${tooltip.strike}</p>
            {tooltip.callIV != null && (
              <p className="text-emerald-400">Call IV: {(tooltip.callIV * 100).toFixed(1)}%</p>
            )}
            {tooltip.putIV != null && (
              <p className="text-red-400">Put IV: {(tooltip.putIV * 100).toFixed(1)}%</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
