'use client';
import React, { useState, useRef, useEffect } from 'react';
import { X, HelpCircle } from 'lucide-react';

interface Contract {
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
  intrinsicValue?: number;
  extrinsicValue?: number;
  flowSide?: 'ASK' | 'BID' | 'MID';
}

// ── Glossary ──────────────────────────────────────────────────────────────────
type GlossaryKey = 'bid' | 'ask' | 'delta' | 'iv' | 'vol' | 'oi' | 'strike';

const GLOSSARY: Record<GlossaryKey, { title: string; body: string; tip: string }> = {
  bid: {
    title: 'Bid',
    body: 'The highest price a buyer is currently willing to pay for this option contract.',
    tip: 'If you\'re selling to open, you\'ll receive close to the bid. A wide bid-ask spread means higher transaction costs — thin markets hurt you on entry and exit.',
  },
  ask: {
    title: 'Ask',
    body: 'The lowest price a seller is currently willing to accept for this option contract.',
    tip: 'If you\'re buying to open, you\'ll pay close to the ask. Try to fill at the "mark" (midpoint between bid and ask) to save cost. Click any Ask to send it to the position sizing calculator below.',
  },
  delta: {
    title: 'Delta (Δ)',
    body: 'How much the option\'s price moves for every $1 change in the underlying stock. Calls range 0 to +1, puts range −1 to 0.',
    tip: 'A delta of 0.50 means the option gains $0.50 when the stock gains $1.00. It\'s also a rough probability the option expires in-the-money. Most directional traders target 0.30–0.50 delta.',
  },
  iv: {
    title: 'Implied Volatility (IV)',
    body: 'The market\'s forward-looking expectation of how much the stock will move, expressed as an annualized percentage.',
    tip: 'High IV = expensive options (market expects big moves, often near earnings or events). Low IV = cheap options. Compare to Historical Volatility (HV20): if IV >> HV, options may be overpriced — better to sell premium. If IV << HV, better to buy.',
  },
  vol: {
    title: 'Volume',
    body: 'The number of contracts that have traded today.',
    tip: 'Volume spikes — especially when today\'s volume exceeds open interest — signal fresh positions being opened, not just existing ones being closed. This drives the unusual activity (⚡) alerts you see elsewhere on this page.',
  },
  oi: {
    title: 'Open Interest (OI)',
    body: 'Total outstanding contracts that are open but not yet closed, expired, or exercised.',
    tip: 'High OI at a strike means that level matters to the market. The key ratio is Vol ÷ OI: a ratio above 3× is a strong unusual signal. Note: OI only updates overnight — it shows yesterday\'s closing positions.',
  },
  strike: {
    title: 'Strike Price',
    body: 'The price at which you have the right to buy (call) or sell (put) the underlying stock at or before expiration.',
    tip: 'ATM (at-the-money) strikes have the most time value and delta near 0.50. ITM strikes cost more but move more like the stock. OTM strikes are cheaper but need a larger move to profit. Strike selection is one of the most impactful decisions in options trading.',
  },
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtVol(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
  return String(v);
}

function ivColor(iv: number): string {
  const pct = iv * 100;
  if (pct > 70) return 'text-red-400';
  if (pct > 50) return 'text-orange-400';
  if (pct > 30) return 'text-amber-400';
  return 'text-emerald-400';
}

// ── Tappable header cell ───────────────────────────────────────────────────────
function HeaderCell({
  col,
  label,
  align,
  active,
  onClick,
  className,
}: {
  col: GlossaryKey;
  label: React.ReactNode;
  align: 'left' | 'right' | 'center';
  active: boolean;
  onClick: (col: GlossaryKey) => void;
  className?: string;
}) {
  return (
    <th
      className={`px-2 py-2 font-medium ${className ?? ''}`}
      style={{ textAlign: align }}
    >
      <button
        onClick={() => onClick(col)}
        className={`inline-flex items-center gap-0.5 rounded transition-colors group ${
          active
            ? 'text-blue-400'
            : 'text-slate-500 hover:text-slate-300'
        }`}
      >
        <span>{label}</span>
        <HelpCircle
          size={9}
          className={`transition-opacity ${
            active ? 'opacity-100 text-blue-400' : 'opacity-0 group-hover:opacity-60'
          }`}
        />
      </button>
    </th>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export function OptionsChainTable({
  calls,
  puts,
  currentPrice,
  onSelectContract,
}: {
  calls: Contract[];
  puts: Contract[];
  currentPrice: number;
  onSelectContract?: (c: Contract) => void;
}) {
  const [compact, setCompact] = useState(false);
  const [activeCol, setActiveCol] = useState<GlossaryKey | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  // Dismiss tooltip when clicking outside
  useEffect(() => {
    if (!activeCol) return;
    function handleClick(e: MouseEvent) {
      if (tooltipRef.current && !tooltipRef.current.contains(e.target as Node)) {
        setActiveCol(null);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [activeCol]);

  function toggleCol(col: GlossaryKey) {
    setActiveCol(prev => (prev === col ? null : col));
  }

  const putMap = new Map(puts.map(p => [p.strike, p]));
  const strikes = Array.from(
    new Set([...calls.map(c => c.strike), ...puts.map(p => p.strike)])
  ).sort((a, b) => a - b);
  const atmStrike = strikes.reduce(
    (prev, s) => (Math.abs(s - currentPrice) < Math.abs(prev - currentPrice) ? s : prev),
    strikes[0] ?? currentPrice,
  );
  const filteredStrikes = strikes.filter(
    s => Math.abs(s - currentPrice) / currentPrice <= 0.20,
  );
  const callMap = new Map(calls.map(c => [c.strike, c]));

  const glossaryEntry = activeCol ? GLOSSARY[activeCol] : null;

  return (
    <div className="rounded-2xl border border-slate-700/50 bg-slate-800/20 overflow-hidden">
      {/* ── Card header ── */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700/40">
        <div>
          <h3 className="text-sm font-semibold text-white">Options Chain</h3>
          <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
            <HelpCircle size={10} />
            Tap any column header to learn what it means
          </p>
        </div>
        <button
          onClick={() => setCompact(!compact)}
          className="text-xs text-slate-400 hover:text-white transition"
        >
          {compact ? 'Full view' : 'Compact'}
        </button>
      </div>

      {/* ── Glossary tooltip panel ── */}
      {glossaryEntry && (
        <div
          ref={tooltipRef}
          className="mx-3 my-2 p-3 rounded-xl bg-slate-900 border border-blue-500/30 shadow-lg animate-fade-in"
        >
          <div className="flex items-start justify-between gap-2 mb-1.5">
            <span className="text-sm font-bold text-blue-400">{glossaryEntry.title}</span>
            <button
              onClick={() => setActiveCol(null)}
              className="text-slate-500 hover:text-white flex-shrink-0 mt-0.5"
            >
              <X size={13} />
            </button>
          </div>
          <p className="text-xs text-slate-200 mb-2 leading-relaxed">{glossaryEntry.body}</p>
          <div className="flex items-start gap-1.5">
            <span className="text-[10px] font-semibold text-amber-400 uppercase tracking-wide flex-shrink-0 mt-0.5">
              Why it matters
            </span>
            <p className="text-[11px] text-slate-400 leading-relaxed">{glossaryEntry.tip}</p>
          </div>
        </div>
      )}

      {/* ── Aggregate flow bias strip ── */}
      {(() => {
        const allContracts = [...calls, ...puts].filter(c => c.flowSide && c.flowSide !== 'MID');
        const askCount = allContracts.filter(c => c.flowSide === 'ASK').length;
        const bidCount = allContracts.filter(c => c.flowSide === 'BID').length;
        const total = askCount + bidCount;
        if (total === 0) return null;
        const askPct = Math.round((askCount / total) * 100);
        const bias = askPct >= 60 ? 'BULLISH' : askPct <= 40 ? 'BEARISH' : 'NEUTRAL';
        const color = bias === 'BULLISH' ? 'text-emerald-400' : bias === 'BEARISH' ? 'text-red-400' : 'text-slate-400';
        return (
          <div className={`px-4 py-1.5 border-b border-slate-700/30 text-[10px] flex items-center gap-1.5 ${color} bg-slate-900/30`}>
            <span className="font-semibold">Flow: {askPct}% ask-side today</span>
            <span className="text-slate-500">→</span>
            <span className="font-bold uppercase">{bias}</span>
          </div>
        );
      })()}

      {/* ── Table ── */}
      <div className="overflow-auto max-h-[420px]">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-slate-900 z-10">
            <tr>
              {/* Calls side */}
              {!compact && (
                <HeaderCell col="bid" label="Bid" align="right" active={activeCol === 'bid'} onClick={toggleCol} />
              )}
              <HeaderCell col="ask" label="Ask" align="right" active={activeCol === 'ask'} onClick={toggleCol} />
              <HeaderCell col="delta" label="Δ" align="right" active={activeCol === 'delta'} onClick={toggleCol} />
              <HeaderCell
                col="iv"
                label="IV"
                align="right"
                active={activeCol === 'iv'}
                onClick={toggleCol}
                className="text-emerald-500"
              />
              <HeaderCell
                col="vol"
                label="VOL"
                align="right"
                active={activeCol === 'vol'}
                onClick={toggleCol}
                className="text-emerald-500"
              />
              {!compact && (
                <HeaderCell col="oi" label="OI" align="right" active={activeCol === 'oi'} onClick={toggleCol} />
              )}

              {/* Flow dot column — calls side */}
              <th className="px-1 py-2 text-center text-[9px] text-slate-600 font-medium">●</th>

              {/* Center */}
              <HeaderCell
                col="strike"
                label="Strike"
                align="center"
                active={activeCol === 'strike'}
                onClick={toggleCol}
                className="text-slate-300 font-bold bg-slate-800/60"
              />

              {/* Flow dot column — puts side */}
              <th className="px-1 py-2 text-center text-[9px] text-slate-600 font-medium">●</th>

              {/* Puts side */}
              {!compact && (
                <HeaderCell col="bid" label="Bid" align="left" active={activeCol === 'bid'} onClick={toggleCol} />
              )}
              <HeaderCell col="ask" label="Ask" align="left" active={activeCol === 'ask'} onClick={toggleCol} />
              <HeaderCell col="delta" label="Δ" align="left" active={activeCol === 'delta'} onClick={toggleCol} />
              <HeaderCell
                col="iv"
                label="IV"
                align="left"
                active={activeCol === 'iv'}
                onClick={toggleCol}
                className="text-red-400"
              />
              <HeaderCell
                col="vol"
                label="VOL"
                align="left"
                active={activeCol === 'vol'}
                onClick={toggleCol}
                className="text-red-400"
              />
              {!compact && (
                <HeaderCell col="oi" label="OI" align="left" active={activeCol === 'oi'} onClick={toggleCol} />
              )}
            </tr>
          </thead>
          <tbody>
            {filteredStrikes.map(strike => {
              const call = callMap.get(strike);
              const put = putMap.get(strike);
              const isAtm = strike === atmStrike;

              return (
                <tr
                  key={strike}
                  className={`border-b border-slate-800/60 hover:bg-slate-700/20 transition-colors ${
                    isAtm ? 'bg-blue-500/8 border-blue-500/20' : ''
                  }`}
                >
                  {/* Calls left side */}
                  {!compact && (
                    <td
                      className={`px-2 py-1.5 text-right cursor-pointer ${call?.itm ? 'bg-emerald-500/5' : ''}`}
                      onClick={() => call && onSelectContract?.(call)}
                    >
                      <span className="text-slate-400">{call ? `$${call.bid.toFixed(2)}` : '—'}</span>
                    </td>
                  )}
                  <td
                    className={`px-2 py-1.5 text-right cursor-pointer ${call?.itm ? 'bg-emerald-500/5' : ''}`}
                    onClick={() => call && onSelectContract?.(call)}
                  >
                    <span className="text-white font-medium">{call ? `$${call.ask.toFixed(2)}` : '—'}</span>
                  </td>
                  <td className={`px-2 py-1.5 text-right ${call?.itm ? 'bg-emerald-500/5' : ''}`}>
                    <span className="text-slate-300">{call ? call.delta.toFixed(2) : '—'}</span>
                  </td>
                  <td className={`px-2 py-1.5 text-right ${call?.itm ? 'bg-emerald-500/5' : ''}`}>
                    <span className={call ? ivColor(call.iv) : 'text-slate-600'}>
                      {call ? `${(call.iv * 100).toFixed(0)}%` : '—'}
                    </span>
                  </td>
                  <td
                    className={`px-2 py-1.5 text-right ${call?.itm ? 'bg-emerald-500/5' : ''}`}
                    onClick={() => call && onSelectContract?.(call)}
                  >
                    <span className={`font-medium ${call?.isUnusual ? 'text-amber-400' : 'text-emerald-400'}`}>
                      {call ? fmtVol(call.volume) : '—'}
                      {call?.isUnusual && <span className="ml-1 text-amber-400">●</span>}
                    </span>
                  </td>
                  {!compact && (
                    <td className={`px-2 py-1.5 text-right ${call?.itm ? 'bg-emerald-500/5' : ''}`}>
                      <span className="text-slate-500">{call ? fmtVol(call.openInterest) : '—'}</span>
                    </td>
                  )}

                  {/* Call flow dot */}
                  <td className="px-1 py-1.5 text-center">
                    {call?.flowSide && (
                      <span
                        className={`text-[10px] ${
                          call.flowSide === 'ASK' ? 'text-emerald-400' :
                          call.flowSide === 'BID' ? 'text-red-400' :
                          'text-slate-600'
                        }`}
                        title={`Last traded ${call.flowSide}-side`}
                      >●</span>
                    )}
                  </td>

                  {/* Strike center */}
                  <td className={`px-3 py-1.5 text-center font-bold bg-slate-800/60 ${
                    isAtm ? 'text-blue-400' : strike < currentPrice ? 'text-emerald-500' : 'text-red-400'
                  }`}>
                    ${strike}
                    {isAtm && <span className="text-xs text-blue-400 ml-1">ATM</span>}
                  </td>

                  {/* Put flow dot */}
                  <td className="px-1 py-1.5 text-center">
                    {put?.flowSide && (
                      <span
                        className={`text-[10px] ${
                          put.flowSide === 'ASK' ? 'text-emerald-400' :
                          put.flowSide === 'BID' ? 'text-red-400' :
                          'text-slate-600'
                        }`}
                        title={`Last traded ${put.flowSide}-side`}
                      >●</span>
                    )}
                  </td>

                  {/* Puts right side */}
                  {!compact && (
                    <td
                      className={`px-2 py-1.5 text-left cursor-pointer ${put?.itm ? 'bg-red-500/5' : ''}`}
                      onClick={() => put && onSelectContract?.(put)}
                    >
                      <span className="text-slate-400">{put ? `$${put.bid.toFixed(2)}` : '—'}</span>
                    </td>
                  )}
                  <td
                    className={`px-2 py-1.5 text-left cursor-pointer ${put?.itm ? 'bg-red-500/5' : ''}`}
                    onClick={() => put && onSelectContract?.(put)}
                  >
                    <span className="text-white font-medium">{put ? `$${put.ask.toFixed(2)}` : '—'}</span>
                  </td>
                  <td className={`px-2 py-1.5 text-left ${put?.itm ? 'bg-red-500/5' : ''}`}>
                    <span className="text-slate-300">{put ? put.delta.toFixed(2) : '—'}</span>
                  </td>
                  <td className={`px-2 py-1.5 text-left ${put?.itm ? 'bg-red-500/5' : ''}`}>
                    <span className={put ? ivColor(put.iv) : 'text-slate-600'}>
                      {put ? `${(put.iv * 100).toFixed(0)}%` : '—'}
                    </span>
                  </td>
                  <td
                    className={`px-2 py-1.5 text-left ${put?.itm ? 'bg-red-500/5' : ''}`}
                    onClick={() => put && onSelectContract?.(put)}
                  >
                    <span className={`font-medium ${put?.isUnusual ? 'text-amber-400' : 'text-red-400'}`}>
                      {put ? fmtVol(put.volume) : '—'}
                      {put?.isUnusual && <span className="ml-1 text-amber-400">●</span>}
                    </span>
                  </td>
                  {!compact && (
                    <td className={`px-2 py-1.5 text-left ${put?.itm ? 'bg-red-500/5' : ''}`}>
                      <span className="text-slate-500">{put ? fmtVol(put.openInterest) : '—'}</span>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
        {filteredStrikes.length === 0 && (
          <p className="text-slate-500 text-center py-8 text-sm">No chain data for this expiration</p>
        )}
      </div>

      {/* ── Footer legend ── */}
      <div className="px-4 py-2 border-t border-slate-700/40 flex items-center gap-4 text-xs text-slate-500">
        <span><span className="text-amber-400">●</span> Unusual volume</span>
        <span><span className="text-emerald-500">Strike</span> = calls ITM</span>
        <span><span className="text-red-400">Strike</span> = puts ITM</span>
        <span><span className="text-blue-400">Strike</span> = ATM</span>
      </div>
    </div>
  );
}
