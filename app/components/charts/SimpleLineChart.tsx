'use client';

import React, { useMemo } from 'react';

type Point = { x: number; y: number };

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export default function SimpleLineChart({
  values,
  height = 220,
  className = '',
}: {
  values: { t: number; v: number }[];
  height?: number;
  className?: string;
}) {
  const { path, last, changePct } = useMemo(() => {
    const pts = (values || []).filter((p) => Number.isFinite(p.v));
    if (pts.length < 2) return { path: '', last: null as number | null, changePct: null as number | null };

    const minV = Math.min(...pts.map((p) => p.v));
    const maxV = Math.max(...pts.map((p) => p.v));
    const span = Math.max(1e-9, maxV - minV);

    const w = 1000; // virtual width for smoother path
    const h = 1000;
    const toX = (i: number) => (i / (pts.length - 1)) * w;
    const toY = (v: number) => h - ((v - minV) / span) * h;

    const points: Point[] = pts.map((p, i) => ({ x: toX(i), y: toY(p.v) }));

    // Build a simple polyline-style path (works great + fast)
    const d = points
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
      .join(' ');

    const first = pts[0]?.v;
    const lastV = pts[pts.length - 1]?.v;
    const pct = Number.isFinite(first) && first !== 0 ? ((lastV - first) / first) * 100 : null;

    return { path: d, last: lastV, changePct: pct };
  }, [values]);

  // We don't set explicit colors per your general preference; we style via CSS classes.
  const trendClass = (changePct ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400';

  return (
    <div className={`rounded-2xl border border-slate-800 bg-slate-900/20 p-3 ${className}`.trim()}>
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs text-slate-400">Chart</div>
        {last !== null && changePct !== null && (
          <div className={`text-xs font-semibold ${trendClass}`}>
            {changePct >= 0 ? '▲' : '▼'} {Math.abs(changePct).toFixed(2)}%
          </div>
        )}
      </div>

      <div className="relative w-full" style={{ height }}>
        {path ? (
          <svg
            viewBox="0 0 1000 1000"
            preserveAspectRatio="none"
            className="absolute inset-0 w-full h-full"
          >
            <path
              d={path}
              fill="none"
              stroke="currentColor"
              strokeWidth="6"
              className={trendClass}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          </svg>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-slate-500">
            Chart data unavailable
          </div>
        )}
        {/* subtle baseline */}
        <div className="absolute left-0 right-0 bottom-0 h-px bg-slate-800" />
      </div>
    </div>
  );
}
