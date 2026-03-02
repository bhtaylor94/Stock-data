'use client';
import React, { useState, useEffect } from 'react';
import { X, RefreshCw } from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────
interface DrillContract {
  symbol: string;
  strike: number;
  expiration: string;
  dte: number;
  type: 'call' | 'put';
  bid: number;
  ask: number;
  mark: number;
  last?: number;
  volume: number;
  openInterest: number;
  delta: number;
  gamma: number;
  theta: number;
  vega: number;
  iv: number;
  itm: boolean;
  spreadPercent: number;
  volumeOIRatio: number;
  isUnusual: boolean;
  unusualScore?: number;
  flowSide?: 'ASK' | 'BID' | 'MID';
  intrinsicValue?: number;
  extrinsicValue?: number;
}

interface Candle {
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  datetime: number; // Unix ms
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtPrem(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000) return `$${Math.round(v / 1_000)}K`;
  return `$${v.toFixed(0)}`;
}

function fmtTime(ms: number): string {
  const d = new Date(ms);
  const h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${m.toString().padStart(2, '0')} ${ampm}`;
}

// ── Intraday chart ─────────────────────────────────────────────────────────────
function IntradayChart({ symbol }: { symbol: string }) {
  const [candles, setCandles] = useState<Candle[]>([]);
  const [loading, setLoading] = useState(true);
  const [empty, setEmpty] = useState(false);

  const load = () => {
    setLoading(true);
    setEmpty(false);
    fetch(`/api/contract/${encodeURIComponent(symbol)}`)
      .then(r => r.json())
      .then(d => {
        if (Array.isArray(d.candles) && d.candles.length > 0) {
          setCandles(d.candles);
        } else {
          setEmpty(true);
        }
      })
      .catch(() => setEmpty(true))
      .finally(() => setLoading(false));
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [symbol]);

  if (loading) {
    return (
      <div className="h-36 flex items-center justify-center">
        <RefreshCw size={14} className="text-slate-500 animate-spin mr-2" />
        <span className="text-xs text-slate-500">Loading intraday chart…</span>
      </div>
    );
  }

  if (empty || candles.length === 0) {
    return (
      <div className="h-36 flex flex-col items-center justify-center gap-1">
        <p className="text-xs text-slate-500">No intraday data yet for this contract</p>
        <button
          onClick={load}
          className="text-[11px] text-blue-400 hover:text-blue-300 transition-colors"
        >
          Try again
        </button>
      </div>
    );
  }

  // ── SVG chart ────────────────────────────────────────────────────────────────
  const W = 520;
  const H = 140;
  const PAD = { l: 8, r: 52, t: 8, b: 24 };
  const CW = W - PAD.l - PAD.r;
  const CH = H - PAD.t - PAD.b;

  const prices = candles.map(c => c.close);
  const volumes = candles.map(c => c.volume);
  const pMin = Math.min(...prices) * 0.997;
  const pMax = Math.max(...prices) * 1.003;
  const vMax = Math.max(...volumes) || 1;
  const n = candles.length;

  const xOf = (i: number) => (n <= 1 ? CW / 2 : (i / (n - 1)) * CW);
  const yP = (p: number) => CH - ((p - pMin) / (pMax - pMin || 1)) * CH;
  const barW = Math.max(2, (CW / Math.max(n, 1)) * 0.65);

  const priceLine = candles
    .map((c, i) => `${xOf(i).toFixed(1)},${yP(c.close).toFixed(1)}`)
    .join(' ');

  // Y-axis price ticks (right side)
  const pRange = pMax - pMin;
  const step = pRange > 0 ? Math.pow(10, Math.floor(Math.log10(pRange / 3))) : 1;
  const pTicks = [pMin, pMin + pRange * 0.33, pMin + pRange * 0.67, pMax].map(v =>
    Math.round(v / step) * step,
  );

  // X-axis: show 3–4 time labels evenly
  const xLabelIdxs = [0, Math.floor(n / 3), Math.floor((2 * n) / 3), n - 1].filter(
    (v, i, arr) => arr.indexOf(v) === i && v < n,
  );

  const firstClose = candles[0]?.close ?? 0;
  const lastClose = candles[n - 1]?.close ?? 0;
  const isUp = lastClose >= firstClose;

  return (
    <div>
      <svg
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        aria-label="Intraday price chart"
      >
        <g transform={`translate(${PAD.l},${PAD.t})`}>
          {/* Volume bars (bottom 30% of chart area) */}
          {candles.map((c, i) => {
            const bH = (c.volume / vMax) * (CH * 0.28);
            return (
              <rect
                key={i}
                x={xOf(i) - barW / 2}
                y={CH - bH}
                width={barW}
                height={bH}
                fill="rgba(100,116,139,0.3)"
                rx={1}
              />
            );
          })}

          {/* Price area fill */}
          {n > 1 && (
            <polygon
              points={[
                `${xOf(0).toFixed(1)},${CH}`,
                ...candles.map((c, i) => `${xOf(i).toFixed(1)},${yP(c.close).toFixed(1)}`),
                `${xOf(n - 1).toFixed(1)},${CH}`,
              ].join(' ')}
              fill={isUp ? 'rgba(52,211,153,0.07)' : 'rgba(248,113,113,0.07)'}
            />
          )}

          {/* Price line */}
          <polyline
            points={priceLine}
            fill="none"
            stroke={isUp ? 'rgba(52,211,153,0.9)' : 'rgba(248,113,113,0.9)'}
            strokeWidth={1.5}
            strokeLinejoin="round"
          />

          {/* Last close dot */}
          <circle
            cx={xOf(n - 1)}
            cy={yP(lastClose)}
            r={3}
            fill={isUp ? 'rgb(52,211,153)' : 'rgb(248,113,113)'}
          />

          {/* Right Y-axis price labels */}
          {pTicks.map((p, i) => (
            <text
              key={i}
              x={CW + 4}
              y={yP(p) + 3}
              fill="rgba(100,116,139,0.7)"
              fontSize={7.5}
            >
              ${p < 1 ? p.toFixed(2) : p.toFixed(2)}
            </text>
          ))}

          {/* X-axis baseline */}
          <line
            x1={0} y1={CH} x2={CW} y2={CH}
            stroke="rgba(100,116,139,0.2)"
            strokeWidth={1}
          />

          {/* X-axis time labels */}
          {xLabelIdxs.map(i => (
            <text
              key={i}
              x={xOf(i)}
              y={CH + 14}
              fill="rgba(100,116,139,0.6)"
              fontSize={7}
              textAnchor="middle"
            >
              {fmtTime(candles[i].datetime)}
            </text>
          ))}
        </g>
      </svg>

      {/* Chart legend */}
      <div className="flex items-center gap-3 px-1 mt-1 text-[10px] text-slate-500">
        <span className="flex items-center gap-1">
          <span
            className="inline-block w-5 h-0.5 rounded"
            style={{ background: isUp ? 'rgb(52,211,153)' : 'rgb(248,113,113)' }}
          />
          Price (5 min)
        </span>
        <span className="flex items-center gap-1">
          <span
            className="inline-block w-4 h-2 rounded-sm"
            style={{ background: 'rgba(100,116,139,0.35)' }}
          />
          Volume
        </span>
        <span className="ml-auto">
          Open <span className="text-slate-300 font-mono">${firstClose.toFixed(2)}</span>
          {' → '}
          Last <span className={`font-mono font-semibold ${isUp ? 'text-emerald-400' : 'text-red-400'}`}>
            ${lastClose.toFixed(2)}
          </span>
        </span>
      </div>
    </div>
  );
}

// ── Main panel ────────────────────────────────────────────────────────────────
export function ContractDrillDown({
  contract: c,
  ticker,
  currentPrice,
  onClose,
}: {
  contract: DrillContract;
  ticker: string;
  currentPrice: number;
  onClose: () => void;
}) {
  const isCall = c.type === 'call';
  const totalPremium = c.mark * c.volume * 100;

  const pctFromMoney = isCall
    ? ((c.strike - currentPrice) / currentPrice) * 100
    : ((currentPrice - c.strike) / currentPrice) * 100;
  const moneyLabel =
    pctFromMoney > 0
      ? `${pctFromMoney.toFixed(1)}% OTM`
      : pctFromMoney < -0.1
      ? `${Math.abs(pctFromMoney).toFixed(1)}% ITM`
      : 'ATM';

  const intrinsic =
    c.intrinsicValue ??
    Math.max(0, isCall ? currentPrice - c.strike : c.strike - currentPrice);
  const extrinsic = c.extrinsicValue ?? Math.max(0, c.mark - intrinsic);

  const flowColor =
    c.flowSide === 'ASK'
      ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/25'
      : c.flowSide === 'BID'
      ? 'text-red-400 bg-red-500/10 border-red-500/25'
      : 'text-slate-400 bg-slate-700/30 border-slate-700/40';
  const flowLabel =
    c.flowSide === 'ASK' ? '↑ Ask-side (aggressive buy)' :
    c.flowSide === 'BID' ? '↓ Bid-side (aggressive sell)' :
    '= Mid-market';

  const expParts = c.expiration.split('-');
  const expFormatted = expParts.length === 3
    ? `${expParts[1]}/${expParts[2]}/${expParts[0]}`
    : c.expiration;

  const stats = [
    { label: 'Volume', value: c.volume.toLocaleString() },
    { label: 'OI', value: c.openInterest.toLocaleString() },
    { label: 'Mark', value: `$${c.mark.toFixed(2)}` },
    { label: 'Bid / Ask', value: `$${c.bid.toFixed(2)} / $${c.ask.toFixed(2)}` },
    { label: 'Spread', value: `${c.spreadPercent.toFixed(1)}%` },
    { label: 'Vol/OI', value: `${c.volumeOIRatio.toFixed(2)}×` },
    { label: 'Premium', value: fmtPrem(totalPremium) },
    { label: moneyLabel.includes('OTM') || moneyLabel === 'ATM' ? 'OTM' : 'ITM', value: `${Math.abs(pctFromMoney).toFixed(1)}%` },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/65 backdrop-blur-sm" />

      {/* Panel */}
      <div
        className="relative w-full max-w-[580px] max-h-[92vh] overflow-y-auto rounded-2xl border border-slate-700/60 bg-slate-900 shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div className="sticky top-0 z-10 px-5 py-3.5 border-b border-slate-700/50 bg-slate-900/95 backdrop-blur-sm flex items-start justify-between">
          <div>
            <div className="flex items-center flex-wrap gap-2">
              <span className="text-base font-bold text-white font-mono tracking-tight">
                {ticker} {c.strike % 1 === 0 ? c.strike.toFixed(0) : c.strike.toFixed(2)} {isCall ? 'C' : 'P'} {expFormatted}
              </span>
              <span className="text-[11px] text-slate-400 bg-slate-800 px-2 py-0.5 rounded-full border border-slate-700/50">
                {c.dte}D
              </span>
              <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${
                isCall
                  ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/25'
                  : 'bg-red-500/15 text-red-300 border-red-500/25'
              }`}>
                {isCall ? 'CALL' : 'PUT'}
              </span>
              {c.isUnusual && (
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/25">
                  ⚡ Unusual
                </span>
              )}
            </div>
            <p className="text-[10px] text-slate-600 mt-0.5 font-mono">{c.symbol}</p>
          </div>
          <button
            onClick={onClose}
            className="ml-3 p-1.5 rounded-lg hover:bg-slate-800 transition-colors text-slate-400 hover:text-white shrink-0"
            aria-label="Close"
          >
            <X size={15} />
          </button>
        </div>

        {/* ── Stats grid ── */}
        <div className="px-5 py-3 border-b border-slate-800/60 grid grid-cols-4 gap-x-3 gap-y-2.5">
          {stats.map(({ label, value }) => (
            <div key={label}>
              <div className="text-[10px] text-slate-500 leading-none mb-0.5">{label}</div>
              <div className="text-xs font-semibold text-slate-200 font-mono">{value}</div>
            </div>
          ))}
        </div>

        {/* ── Flow side ── */}
        <div className="px-5 py-2.5 border-b border-slate-800/60 flex items-center gap-3 flex-wrap">
          <span className="text-[11px] text-slate-500">Last fill:</span>
          <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${flowColor}`}>
            {flowLabel}
          </span>
          <span className="text-[11px] text-slate-500 ml-auto">
            IV: <span className="text-white font-mono font-semibold">{(c.iv * 100).toFixed(1)}%</span>
          </span>
        </div>

        {/* ── Intraday chart ── */}
        <div className="px-5 pt-4 pb-2">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">
              Intraday Price · Today
            </h3>
            <p className="text-[10px] text-slate-600">5-min candles · Schwab live</p>
          </div>
          <IntradayChart symbol={c.symbol} />
        </div>

        {/* ── Greeks ── */}
        <div className="px-5 pb-3 pt-1 border-t border-slate-800/60">
          <h3 className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-2.5">Greeks</h3>
          <div className="grid grid-cols-4 gap-2">
            {[
              { label: 'Delta Δ', value: c.delta.toFixed(3), color: isCall ? 'text-emerald-400' : 'text-red-400' },
              { label: 'Gamma Γ', value: c.gamma.toFixed(4), color: 'text-blue-400' },
              { label: 'Theta Θ', value: c.theta.toFixed(4), color: 'text-orange-400' },
              { label: 'Vega V', value: c.vega.toFixed(4), color: 'text-purple-400' },
            ].map(({ label, value, color }) => (
              <div key={label} className="bg-slate-800/60 rounded-xl px-3 py-2.5 text-center border border-slate-700/30">
                <div className="text-[9px] text-slate-500 mb-1">{label}</div>
                <div className={`text-sm font-bold font-mono ${color}`}>{value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Value breakdown ── */}
        <div className="px-5 pb-4 flex items-center gap-4 text-[11px] border-t border-slate-800/60 pt-3">
          <div>
            <span className="text-slate-500">Intrinsic  </span>
            <span className="text-slate-200 font-mono font-semibold">${intrinsic.toFixed(2)}</span>
          </div>
          <div>
            <span className="text-slate-500">Extrinsic (time)  </span>
            <span className="text-slate-200 font-mono font-semibold">${extrinsic.toFixed(2)}</span>
          </div>
          <div className="ml-auto text-slate-500">
            {c.itm ? (
              <span className={`font-semibold ${isCall ? 'text-emerald-400' : 'text-red-400'}`}>In-the-Money</span>
            ) : (
              <span className="text-slate-400">Out-of-the-Money</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
