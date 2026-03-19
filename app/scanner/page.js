'use client';
import { useState } from 'react';
import Link from 'next/link';

const QUICK_TICKERS = ['SPY', 'QQQ', 'AAPL', 'NVDA', 'TSLA', 'AMZN', 'META', 'AMD', 'GOOGL', 'MSFT'];
const SENT_COLORS = { STRONG_BULLISH: '#22c55e', BULLISH: '#86efac', NEUTRAL: '#94a3b8', BEARISH: '#fca5a5', STRONG_BEARISH: '#ef4444' };

function formatPremium(n) {
  if (n >= 1000000) return `$${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `$${(n / 1000).toFixed(0)}K`;
  return `$${n}`;
}

// ── Flow Row (Bullflow-style) ──
function FlowRow({ entry, maxVolume }) {
  const [expanded, setExpanded] = useState(false);
  const bull = (entry.putCall === 'CALL' && entry.side === 'ASK') || (entry.putCall === 'PUT' && entry.side === 'BID');
  const totalVol = entry.volume;
  // Estimate ask/bid split from side detection
  const askVol = entry.side === 'ASK' ? Math.round(totalVol * 0.92) : entry.side === 'BID' ? Math.round(totalVol * 0.08) : Math.round(totalVol * 0.5);
  const bidVol = totalVol - askVol;
  const midVol = 0;
  const volBarWidth = maxVolume > 0 ? (totalVol / maxVolume) * 100 : 50;

  return (
    <div className="rounded-lg mb-2 overflow-hidden" style={{
      background: 'rgba(255,255,255,0.015)',
      border: `1px solid ${entry.isUnusual ? (bull ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)') : 'rgba(255,255,255,0.04)'}`,
    }}>
      {/* Main row — Bullflow style header */}
      <div className="px-3 pt-3 pb-2 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-2">
            <span className="text-base font-bold font-mono" style={{ color: bull ? '#22c55e' : '#ef4444' }}>
              {entry.putCall === 'CALL' ? `${entry.strike} Call` : `${entry.strike} Put`}
            </span>
            {/* Expiration badge */}
            <span className="text-[9px] font-mono font-semibold px-1.5 py-0.5 rounded" style={{
              background: entry.dte <= 30 ? 'rgba(239,68,68,0.1)' : entry.dte <= 90 ? 'rgba(234,179,8,0.1)' : 'rgba(0,212,255,0.1)',
              color: entry.dte <= 30 ? '#ef4444' : entry.dte <= 90 ? '#eab308' : '#00d4ff',
              border: `1px solid ${entry.dte <= 30 ? 'rgba(239,68,68,0.15)' : entry.dte <= 90 ? 'rgba(234,179,8,0.15)' : 'rgba(0,212,255,0.15)'}`,
            }}>
              {entry.expiration} · {entry.dte}d
            </span>
            {entry.isUnusual && (
              <span className="text-[8px] font-bold px-1.5 py-px rounded" style={{
                background: 'rgba(255,160,0,0.15)', color: '#ffa500',
                boxShadow: '0 0 6px rgba(255,160,0,0.15)',
              }}>UOA</span>
            )}
          </div>
          <div className="text-right">
            <span className="text-base font-bold font-mono text-white">${entry.mid}</span>
          </div>
        </div>

        {/* Exp + meta row */}
        <div className="flex items-center justify-between text-[10px] font-mono text-white/40 mb-2.5">
          <span>{entry.moneyness} {entry.pctFromSpot > 0 ? '+' : ''}{entry.pctFromSpot}% from spot</span>
          <span className="text-white/25">{expanded ? '▴' : '▾'}</span>
        </div>

        {/* Ask / Bid / Mid breakdown — Bullflow style */}
        <div className="flex items-center gap-3 text-[10px] font-mono mb-2">
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400"></span>
            <span className="text-white/35">Ask:</span>
            <span className="text-green-400 font-bold">{askVol >= 1000 ? `${(askVol / 1000).toFixed(1)}K` : askVol}</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-red-400"></span>
            <span className="text-white/35">Bid:</span>
            <span className="text-red-400 font-bold">{bidVol >= 1000 ? `${(bidVol / 1000).toFixed(1)}K` : bidVol}</span>
          </span>
          <span className="text-white/25">|</span>
          <span className="text-white/40">Vol: <span className="text-white/60 font-semibold">{totalVol >= 1000 ? `${(totalVol / 1000).toFixed(1)}K` : totalVol}</span></span>
          <span className="text-white/40">OI: <span className="text-white/60 font-semibold">{entry.openInterest >= 1000 ? `${(entry.openInterest / 1000).toFixed(1)}K` : entry.openInterest}</span></span>
        </div>

        {/* Volume bar — visual like Bullflow */}
        <div className="relative h-8 rounded overflow-hidden mb-1.5" style={{ background: 'rgba(255,255,255,0.03)' }}>
          {/* Ask bar (green) */}
          <div className="absolute left-0 top-0 h-full rounded-l transition-all duration-500" style={{
            width: `${(askVol / Math.max(totalVol, 1)) * volBarWidth}%`,
            background: 'linear-gradient(90deg, rgba(34,197,94,0.5), rgba(34,197,94,0.3))',
            boxShadow: askVol > bidVol * 5 ? '0 0 12px rgba(34,197,94,0.2)' : 'none',
          }} />
          {/* Bid bar (red) */}
          <div className="absolute top-0 h-full rounded-r transition-all duration-500" style={{
            left: `${(askVol / Math.max(totalVol, 1)) * volBarWidth}%`,
            width: `${(bidVol / Math.max(totalVol, 1)) * volBarWidth}%`,
            background: 'linear-gradient(90deg, rgba(239,68,68,0.3), rgba(239,68,68,0.5))',
          }} />
          {/* Volume label inside bar */}
          <div className="absolute inset-0 flex items-center justify-between px-2">
            <span className="text-[10px] font-bold font-mono text-green-300/80">
              {askVol >= 1000 ? `${(askVol / 1000).toFixed(1)}K` : askVol}
            </span>
            <span className="text-[10px] font-bold font-mono text-red-300/80">
              {bidVol >= 1000 ? `${(bidVol / 1000).toFixed(1)}K` : bidVol}
            </span>
          </div>
        </div>

        {/* Premium + metrics row */}
        <div className="flex items-center gap-4 text-[10px] font-mono text-white/35">
          <span>Prem: <span className="text-white/70 font-semibold">{formatPremium(entry.premium)}</span></span>
          {entry.volOiRatio > 1.5 && <span>Vol/OI: <span className="text-amber-400 font-bold">{entry.volOiRatio}x</span></span>}
          {entry.delta && <span>Δ {entry.delta}</span>}
          {entry.iv && <span>IV {entry.iv}%</span>}
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="px-3 pb-3 pt-1 border-t border-white/[0.03] space-y-2.5 animate-fade-up">
          {/* Greeks detail */}
          <div className="flex gap-4 text-[10px] font-mono text-white/35">
            {entry.delta && <span>Delta: {entry.delta}</span>}
            {entry.gamma && <span>Gamma: {entry.gamma}</span>}
            {entry.theta && <span>Theta: {entry.theta}</span>}
            {entry.iv && <span>IV: {entry.iv}%</span>}
          </div>

          {/* Both sides — buyer and seller intent */}
          <div className="grid grid-cols-2 gap-2.5">
            <div className="rounded p-2.5" style={{ background: 'rgba(34,197,94,0.04)', border: '1px solid rgba(34,197,94,0.08)' }}>
              <span className="block text-[9px] font-bold text-green-400/60 font-mono mb-1">🟢 BUYER'S INTENT</span>
              <p className="text-[11px] text-white/55 leading-snug">{entry.buyerIntent}</p>
            </div>
            <div className="rounded p-2.5" style={{ background: 'rgba(239,68,68,0.04)', border: '1px solid rgba(239,68,68,0.08)' }}>
              <span className="block text-[9px] font-bold text-red-400/60 font-mono mb-1">🔴 SELLER'S INTENT</span>
              <p className="text-[11px] text-white/55 leading-snug">{entry.sellerIntent}</p>
            </div>
          </div>

          {/* OI Signal */}
          <div className="text-[10px] font-mono px-2 py-1.5 rounded" style={{ background: 'rgba(255,255,255,0.02)', color: entry.oiSignal.includes('NEW') ? '#ffa500' : 'rgba(255,255,255,0.35)' }}>
            {entry.oiSignal}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Spread Card ──
function SpreadCard({ spread }) {
  const bull = spread.direction === 'BULLISH';
  return (
    <div className="rounded-lg p-3 border" style={{
      background: 'rgba(255,255,255,0.015)',
      borderColor: bull ? 'rgba(34,197,94,0.12)' : spread.direction === 'BEARISH' ? 'rgba(239,68,68,0.12)' : 'rgba(255,255,255,0.06)',
      borderLeft: `3px solid ${bull ? '#22c55e' : spread.direction === 'BEARISH' ? '#ef4444' : '#94a3b8'}`,
    }}>
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold font-mono" style={{ color: bull ? '#22c55e' : '#ef4444' }}>{spread.type}</span>
          <span className="text-[9px] font-mono px-1.5 py-px rounded" style={{
            background: spread.confidence === 'HIGH' ? 'rgba(0,212,255,0.1)' : 'rgba(255,255,255,0.05)',
            color: spread.confidence === 'HIGH' ? '#00d4ff' : 'rgba(255,255,255,0.4)',
          }}>{spread.confidence} confidence</span>
        </div>
        <span className="text-[10px] font-mono text-white/40">{spread.expiration} · {spread.dte}d</span>
      </div>
      <p className="text-[12px] text-white/60 mb-1.5">{spread.description}</p>
      <div className="flex gap-3 text-[10px] font-mono text-white/35">
        <span>Vol: {spread.totalVolume.toLocaleString()}</span>
        <span>Premium: {formatPremium(spread.totalPremium)}</span>
        <span>Width: ${spread.width}</span>
      </div>
    </div>
  );
}

// ── Main Scanner Page ──
export default function ScannerPage() {
  const [ticker, setTicker] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState('calls'); // calls | puts | spreads

  const scan = async (t) => {
    const target = (t || ticker).toUpperCase();
    if (!target) return;
    setTicker(target);
    setLoading(true);
    setError(null);
    setData(null);
    try {
      const res = await fetch(`/api/scanner?ticker=${target}`);
      if (!res.ok) throw new Error((await res.json()).error || 'Scan failed');
      setData(await res.json());
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  const summary = data?.summary;

  return (
    <div className="min-h-screen" style={{ background: '#08080a' }}>
      {/* Header */}
      <div className="sticky top-0 z-10 backdrop-blur-xl border-b border-white/5" style={{ background: 'rgba(8,8,10,0.94)' }}>
        <div className="max-w-[720px] mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/" className="text-white/30 hover:text-white/60 text-sm font-mono transition-colors">← Feed</Link>
          <span className="text-[17px] font-extrabold tracking-tight font-display text-white">SCANNER</span>
        </div>
      </div>

      <div className="max-w-[720px] mx-auto px-4 py-5">
        {/* Search */}
        <div className="flex gap-2 mb-3">
          <input
            value={ticker}
            onChange={e => setTicker(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === 'Enter' && scan()}
            placeholder="Enter ticker..."
            className="flex-1 bg-white/[0.03] border border-white/10 rounded-lg px-3 py-2.5 text-lg font-bold font-mono text-white text-center uppercase focus:outline-none focus:border-cyan-500/30"
          />
          <button onClick={() => scan()} disabled={loading || !ticker}
            className="px-6 py-2.5 rounded-lg text-sm font-bold font-mono disabled:opacity-50"
            style={{ background: '#00d4ff', color: '#08080a' }}>
            {loading ? '...' : 'Scan'}
          </button>
        </div>

        {/* Quick tickers */}
        <div className="flex gap-1.5 flex-wrap mb-5">
          {QUICK_TICKERS.map(t => (
            <button key={t} onClick={() => scan(t)}
              className="px-2.5 py-1 text-[10px] font-mono font-semibold rounded border border-white/8 text-white/35 hover:text-white/60 hover:border-white/15 transition-all"
              style={{ background: 'rgba(255,255,255,0.02)' }}>
              {t}
            </button>
          ))}
        </div>

        {error && <div className="text-center py-4 text-red-400/60 text-xs font-mono">{error}</div>}

        {data && (
          <>
            {/* Summary bar */}
            <div className="rounded-lg p-4 mb-4" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-extrabold font-display text-white">{data.ticker}</span>
                  <span className="text-sm font-mono text-white/40">${data.stockPrice}</span>
                </div>
                <span className="text-sm font-bold font-mono px-2 py-1 rounded" style={{
                  background: `${SENT_COLORS[summary.sentiment]}15`,
                  color: SENT_COLORS[summary.sentiment],
                }}>{summary.sentiment.replace('_', ' ')}</span>
              </div>

              <div className="grid grid-cols-4 gap-3 text-center">
                <div>
                  <span className="block text-[9px] font-mono text-white/20">P/C RATIO</span>
                  <span className="text-sm font-bold font-mono" style={{ color: summary.putCallRatio < 0.7 ? '#22c55e' : summary.putCallRatio > 1.0 ? '#ef4444' : 'white' }}>
                    {summary.putCallRatio}
                  </span>
                </div>
                <div>
                  <span className="block text-[9px] font-mono text-white/20">CALL PREMIUM</span>
                  <span className="text-sm font-bold font-mono text-green-400">{formatPremium(summary.callPremium)}</span>
                </div>
                <div>
                  <span className="block text-[9px] font-mono text-white/20">PUT PREMIUM</span>
                  <span className="text-sm font-bold font-mono text-red-400">{formatPremium(summary.putPremium)}</span>
                </div>
                <div>
                  <span className="block text-[9px] font-mono text-white/20">NET PREMIUM</span>
                  <span className="text-sm font-bold font-mono" style={{ color: summary.netPremium >= 0 ? '#22c55e' : '#ef4444' }}>
                    {formatPremium(summary.netPremium)}
                  </span>
                </div>
              </div>

              {/* Bid/Ask breakdown */}
              <div className="grid grid-cols-2 gap-3 mt-3">
                <div className="rounded p-2" style={{ background: 'rgba(34,197,94,0.04)' }}>
                  <span className="block text-[9px] font-mono text-green-400/50 mb-1">CALLS — WHO'S BUYING/SELLING</span>
                  <div className="flex justify-between text-[10px] font-mono">
                    <span className="text-green-400">Bought at Ask: {summary.callAskPct}%</span>
                    <span className="text-red-400">Sold at Bid: {summary.callBidPct}%</span>
                  </div>
                  <div className="h-1.5 rounded bg-white/5 mt-1 overflow-hidden flex">
                    <div style={{ width: `${summary.callAskPct}%`, background: '#22c55e' }} />
                    <div style={{ width: `${summary.callBidPct}%`, background: '#ef4444' }} />
                  </div>
                </div>
                <div className="rounded p-2" style={{ background: 'rgba(239,68,68,0.04)' }}>
                  <span className="block text-[9px] font-mono text-red-400/50 mb-1">PUTS — WHO'S BUYING/SELLING</span>
                  <div className="flex justify-between text-[10px] font-mono">
                    <span className="text-red-400">Bought at Ask: {summary.putAskPct}%</span>
                    <span className="text-green-400">Sold at Bid: {summary.putBidPct}%</span>
                  </div>
                  <div className="h-1.5 rounded bg-white/5 mt-1 overflow-hidden flex">
                    <div style={{ width: `${summary.putAskPct}%`, background: '#ef4444' }} />
                    <div style={{ width: `${summary.putBidPct}%`, background: '#22c55e' }} />
                  </div>
                </div>
              </div>

              {data.earnings && (
                <div className="mt-3 text-[10px] font-mono text-amber-400/60">
                  ⚠ Earnings in {data.earnings.daysUntil} days ({data.earnings.date})
                </div>
              )}
            </div>

            {/* Tabs */}
            <div className="flex gap-0 border-b border-white/5 mb-3">
              {[
                { id: 'calls', label: `Calls (${data.calls.length})` },
                { id: 'puts', label: `Puts (${data.puts.length})` },
                { id: 'spreads', label: `Spreads (${data.spreads.length})` },
              ].map(t => (
                <button key={t.id} onClick={() => setTab(t.id)}
                  className="flex-1 py-2 text-center text-[11px] font-semibold font-mono border-b-2 transition-all"
                  style={{ color: tab === t.id ? '#00d4ff' : 'rgba(255,255,255,0.25)', borderColor: tab === t.id ? '#00d4ff' : 'transparent' }}>
                  {t.label}
                </button>
              ))}
            </div>

            {/* Flow table */}
            {(tab === 'calls' || tab === 'puts') && (
              <div>
                {(() => {
                  const entries = tab === 'calls' ? data.calls : data.puts;
                  if (entries.length === 0) return <p className="text-center py-8 text-white/15 text-xs font-mono">No significant activity</p>;

                  // Expiration heat map — show which dates have the most volume
                  const expVolume = {};
                  entries.forEach(e => {
                    if (!expVolume[e.expiration]) expVolume[e.expiration] = { vol: 0, premium: 0, count: 0, dte: e.dte };
                    expVolume[e.expiration].vol += e.volume;
                    expVolume[e.expiration].premium += e.premium;
                    expVolume[e.expiration].count++;
                  });
                  const sortedExps = Object.entries(expVolume).sort((a, b) => b[1].vol - a[1].vol);
                  const maxExpVol = sortedExps.length > 0 ? sortedExps[0][1].vol : 1;

                  const maxVol = Math.max(...entries.map(e => e.volume), 1);
                  return (
                    <>
                      {/* Expiration heat strip */}
                      {sortedExps.length > 1 && (
                        <div className="mb-3 p-2.5 rounded-lg" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
                          <span className="block text-[9px] font-bold text-white/20 font-mono tracking-wide mb-2">VOLUME BY EXPIRATION</span>
                          <div className="flex gap-1.5 flex-wrap">
                            {sortedExps.slice(0, 8).map(([exp, info]) => {
                              const heat = info.vol / maxExpVol;
                              return (
                                <div key={exp} className="rounded px-2 py-1.5 text-center" style={{
                                  background: heat > 0.7 ? 'rgba(34,197,94,0.12)' : heat > 0.3 ? 'rgba(234,179,8,0.08)' : 'rgba(255,255,255,0.03)',
                                  border: `1px solid ${heat > 0.7 ? 'rgba(34,197,94,0.2)' : heat > 0.3 ? 'rgba(234,179,8,0.12)' : 'rgba(255,255,255,0.06)'}`,
                                  minWidth: '72px',
                                }}>
                                  <span className="block text-[10px] font-mono font-semibold" style={{
                                    color: heat > 0.7 ? '#22c55e' : heat > 0.3 ? '#eab308' : 'rgba(255,255,255,0.4)',
                                  }}>{exp.slice(5)}</span>
                                  <span className="block text-[9px] font-mono text-white/25">{info.dte}d</span>
                                  <span className="block text-[9px] font-mono mt-0.5" style={{ color: heat > 0.7 ? '#22c55e' : 'rgba(255,255,255,0.35)' }}>
                                    {info.vol >= 1000 ? `${(info.vol / 1000).toFixed(1)}K` : info.vol} vol
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                      {entries.map((entry, i) => (
                        <FlowRow key={`${entry.strike}-${entry.expiration}-${i}`} entry={entry} maxVolume={maxVol} />
                      ))}
                    </>
                  );
                })()}
              </div>
            )}

            {tab === 'spreads' && (
              <div className="space-y-2">
                {data.spreads.length === 0 ? (
                  <p className="text-center py-8 text-white/15 text-xs font-mono">No spread activity detected</p>
                ) : (
                  data.spreads.map((s, i) => <SpreadCard key={i} spread={s} />)
                )}
              </div>
            )}
          </>
        )}

        {!data && !loading && !error && (
          <div className="text-center py-16 text-white/15 text-sm font-mono">
            Enter a ticker to scan for unusual options activity.<br />
            <span className="text-white/10">Shows both sides of every trade — who's buying, who's selling, and why.</span>
          </div>
        )}
      </div>
    </div>
  );
}
