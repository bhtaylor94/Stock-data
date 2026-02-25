'use client';
import React, { useMemo } from 'react';

interface PLDiagramProps {
  strike: number;
  mark: number;        // premium paid per share
  type: 'call' | 'put';
  currentPrice: number;
  iv: number;          // annualised IV (e.g. 0.30)
  dte: number;         // days to expiration
}

const STEPS = 60;

function bsD1(S: number, K: number, t: number, iv: number): number {
  if (t <= 0) return S > K ? Infinity : -Infinity;
  return (Math.log(S / K) + 0.5 * iv * iv * t) / (iv * Math.sqrt(t));
}

function normCDF(x: number): number {
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741;
  const a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
  const sign = x < 0 ? -1 : 1;
  const t = 1 / (1 + p * Math.abs(x));
  const poly = ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t;
  return 0.5 * (1 + sign * (1 - poly * Math.exp(-x * x)));
}

function calcDelta(S: number, K: number, iv: number, dte: number, isCall: boolean): number {
  const t = dte / 365;
  if (t <= 0) return isCall ? (S > K ? 1 : 0) : (S < K ? -1 : 0);
  const d1 = bsD1(S, K, t, iv);
  return isCall ? normCDF(d1) : normCDF(d1) - 1;
}

function calcGamma(S: number, K: number, iv: number, dte: number): number {
  const t = dte / 365;
  if (t <= 0 || S <= 0 || iv <= 0) return 0;
  const d1 = bsD1(S, K, t, iv);
  const phi = Math.exp(-0.5 * d1 * d1) / Math.sqrt(2 * Math.PI);
  return phi / (S * iv * Math.sqrt(t));
}

export function PLDiagram({ strike, mark, type, currentPrice, iv, dte }: PLDiagramProps) {
  const isCall = type === 'call';
  const cost = mark * 100; // 1 contract = 100 shares

  const { prices, expiryPL, todayPL, minPL, maxPL, breakeven } = useMemo(() => {
    const lo = currentPrice * 0.8;
    const hi = currentPrice * 1.2;
    const step = (hi - lo) / STEPS;
    const prices: number[] = [];
    const expiryPL: number[] = [];
    const todayPL: number[] = [];

    const delta = calcDelta(currentPrice, strike, iv, dte, isCall);
    const gamma = calcGamma(currentPrice, strike, iv, dte);
    // Rough theta: option value decay estimate per day (simplified)
    const thetaPerDay = mark * 0.015; // ~1.5% daily decay as rough approx

    for (let i = 0; i <= STEPS; i++) {
      const price = lo + i * step;
      prices.push(price);

      // Expiry P&L
      const intrinsic = isCall
        ? Math.max(price - strike, 0)
        : Math.max(strike - price, 0);
      expiryPL.push(intrinsic * 100 - cost);

      // Today P&L: delta-gamma approx + 1-day theta
      const dS = price - currentPrice;
      const todayVal = delta * dS * 100 + 0.5 * gamma * dS * dS * 100 - thetaPerDay * 100;
      todayPL.push(todayVal);
    }

    const allVals = [...expiryPL, ...todayPL];
    const minPL = Math.min(...allVals);
    const maxPL = Math.max(...allVals);
    const breakeven = isCall ? strike + mark : strike - mark;

    return { prices, expiryPL, todayPL, minPL, maxPL, breakeven };
  }, [strike, mark, isCall, currentPrice, iv, dte]);

  const W = 480, H = 200;
  const padL = 48, padR = 8, padT = 12, padB = 28;
  const chartW = W - padL - padR;
  const chartH = H - padT - padB;

  const pRange = prices[prices.length - 1] - prices[0];
  const plRange = maxPL - minPL || 1;

  const px = (price: number) => padL + ((price - prices[0]) / pRange) * chartW;
  const py = (pl: number) => padT + (1 - (pl - minPL) / plRange) * chartH;

  const zeroY = py(0);

  const expiryPoints = prices.map((p, i) => `${px(p)},${py(expiryPL[i])}`).join(' ');
  const todayPoints = prices.map((p, i) => `${px(p)},${py(todayPL[i])}`).join(' ');

  const breakevenX = px(breakeven);
  const currentX = px(currentPrice);

  // Profit/loss fill for expiry line
  const expiryPath = `M ${prices.map((p, i) => `${px(p)},${py(expiryPL[i])}`).join(' L ')}`;
  const profitFill = `${expiryPath} L ${px(prices[prices.length - 1])},${zeroY} L ${px(prices[0])},${zeroY} Z`;

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-lg p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-slate-300 uppercase tracking-wide">P&amp;L Risk Graph</span>
        <span className="text-xs text-slate-500">
          {type.toUpperCase()} ${strike} · ${mark.toFixed(2)} mark · {dte}d DTE
        </span>
      </div>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} className="overflow-visible">
        {/* Zero line */}
        <line x1={padL} y1={zeroY} x2={W - padR} y2={zeroY} stroke="#475569" strokeWidth={1} strokeDasharray="3,3" />

        {/* Profit fill (above zero) */}
        <clipPath id="profit-clip">
          <rect x={padL} y={padT} width={chartW} height={zeroY - padT} />
        </clipPath>
        <path d={profitFill} fill="rgba(16,185,129,0.12)" clipPath="url(#profit-clip)" />

        {/* Loss fill (below zero) */}
        <clipPath id="loss-clip">
          <rect x={padL} y={zeroY} width={chartW} height={padT + chartH - zeroY} />
        </clipPath>
        <path d={profitFill} fill="rgba(239,68,68,0.12)" clipPath="url(#loss-clip)" />

        {/* Today P&L line */}
        <polyline points={todayPoints} fill="none" stroke="#94a3b8" strokeWidth={1.5} strokeDasharray="4,3" />

        {/* Expiry P&L line */}
        <polyline points={expiryPoints} fill="none" stroke={minPL < 0 ? '#f87171' : '#34d399'} strokeWidth={2} />

        {/* Current price line */}
        <line x1={currentX} y1={padT} x2={currentX} y2={padT + chartH} stroke="#60a5fa" strokeWidth={1} strokeDasharray="2,3" />
        <text x={currentX + 3} y={padT + 10} fontSize={9} fill="#60a5fa">NOW</text>

        {/* Breakeven line */}
        {breakevenX > padL && breakevenX < W - padR && (
          <>
            <line x1={breakevenX} y1={padT} x2={breakevenX} y2={padT + chartH} stroke="#fbbf24" strokeWidth={1} strokeDasharray="2,3" />
            <text x={breakevenX + 2} y={padT + 20} fontSize={9} fill="#fbbf24">BE</text>
          </>
        )}

        {/* Y-axis labels */}
        {[minPL, 0, maxPL].map((val) => (
          <text key={val} x={padL - 4} y={py(val) + 3} textAnchor="end" fontSize={9} fill="#64748b">
            {val >= 0 ? '+' : ''}{Math.round(val)}
          </text>
        ))}

        {/* X-axis labels */}
        {[prices[0], currentPrice, prices[prices.length - 1]].map((p) => (
          <text key={p} x={px(p)} y={H - 6} textAnchor="middle" fontSize={9} fill="#64748b">
            ${Math.round(p)}
          </text>
        ))}
      </svg>
      <div className="flex gap-4 mt-1 text-xs text-slate-500">
        <span><span className="inline-block w-4 border-b-2 border-slate-400 border-dashed mr-1" />Today</span>
        <span><span className="inline-block w-4 border-b-2 border-red-400 mr-1" />Expiry</span>
        <span className="ml-auto text-amber-400">BE: ${breakeven.toFixed(2)}</span>
      </div>
    </div>
  );
}
