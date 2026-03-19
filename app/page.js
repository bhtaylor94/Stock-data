'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

// ── Status badge colors ──
const STATUS_CONFIG = {
  ACTIVE: { color: '#00d4ff', label: 'ACTIVE', icon: '●' },
  ACCUMULATING: { color: '#22c55e', label: 'ACCUMULATING', icon: '🟢' },
  HOLDING: { color: '#3b82f6', label: 'HOLDING', icon: '🔵' },
  PARTIAL_EXIT: { color: '#eab308', label: 'PARTIAL EXIT', icon: '🟡' },
  EXITING: { color: '#ef4444', label: 'EXITING', icon: '🔴' },
  EXPIRED: { color: '#6b7280', label: 'EXPIRED', icon: '⚪' },
};

function ConfidencePips({ level }) {
  return (
    <div className="flex gap-[3px] items-center">
      {[1, 2, 3, 4, 5].map(i => (
        <div key={i} className="w-[5px] rounded-sm transition-all" style={{
          height: i <= level ? '16px' : '7px',
          background: i <= level ? (level === 5 ? '#22c55e' : '#86efac') : 'rgba(255,255,255,0.08)',
        }} />
      ))}
    </div>
  );
}

function LayerRow({ icon, name, score, label }) {
  return (
    <div className={`flex items-start gap-2 py-1 ${score ? '' : 'opacity-40'}`}>
      <span className="text-[11px] w-4 text-center shrink-0 mt-0.5">{score ? '✓' : '✗'}</span>
      <div className="flex-1 min-w-0">
        <span className="text-[10px] font-bold text-white/30 tracking-wide font-mono">{icon} {name}</span>
        <p className="mt-0.5 text-xs leading-snug" style={{ color: score ? 'rgba(255,255,255,0.65)' : 'rgba(255,255,255,0.3)' }}>{label}</p>
      </div>
    </div>
  );
}

function PLBar({ maxRisk, maxReward, breakeven, pop }) {
  const isUnlimited = maxReward === 'unlimited';
  const ratio = isUnlimited ? 70 : (maxReward / (maxRisk + maxReward)) * 100;
  return (
    <div className="mt-2">
      <div className="flex justify-between text-[10px] text-white/30 font-mono mb-1">
        <span>Risk ${maxRisk}</span><span>BE ${breakeven}</span><span>Reward {isUnlimited ? '∞' : `$${maxReward}`}</span>
      </div>
      <div className="h-1 bg-white/5 rounded-sm overflow-hidden relative">
        <div className="absolute left-0 top-0 h-full" style={{ width: `${100 - ratio}%`, background: 'linear-gradient(90deg, #dc2626, #dc262650)' }} />
        <div className="absolute right-0 top-0 h-full" style={{ width: `${ratio}%`, background: 'linear-gradient(90deg, #16a34a50, #16a34a)' }} />
      </div>
      <div className="text-right text-[10px] text-white/25 font-mono mt-0.5">{pop}% probability of profit</div>
    </div>
  );
}

function OpportunityCard({ opp, index, onActivate, onDeepDive }) {
  const [expanded, setExpanded] = useState(false);
  const bull = opp.direction === 'BULLISH';
  const play = opp.suggestedPlay;
  const layers = opp.layers;
  const insider = opp.insiderActivity;

  // Determine if this card gets the fire treatment
  const isOnFire = opp.confidence === 5 || opp.emaProximity?.state === 'CONFIRMED';
  const isConfirmedBounce = opp.emaProximity?.state === 'CONFIRMED';
  const cardClass = isOnFire
    ? `animate-fade-up rounded-lg p-4 fire-card`
    : isConfirmedBounce
      ? `animate-fade-up rounded-lg p-4 confirmed-card`
      : `animate-fade-up rounded-lg p-4 transition-colors hover:bg-white/[0.03]`;

  const layerConfig = [
    { key: 'flow', icon: '⚡', name: 'FLOW INTENT', ...layers.flow },
    { key: 'gamma', icon: '🧲', name: 'DEALER POSITIONING', ...layers.gamma },
    { key: 'volatility', icon: '📊', name: 'VOLATILITY EDGE', ...layers.volatility },
    { key: 'catalyst', icon: '📅', name: 'CATALYST', ...layers.catalyst },
    { key: 'technical', icon: '📈', name: 'TECHNICAL', ...layers.technical },
  ];

  return (
    <div className={cardClass}
      style={isOnFire ? { animationDelay: `${index * 60}ms` } : { animationDelay: `${index * 60}ms`, background: 'rgba(255,255,255,0.015)', border: `1px solid ${bull ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)'}`, borderLeft: `3px solid ${bull ? '#22c55e' : '#ef4444'}` }}>

      {/* Rising ember particles for fire cards */}
      {isOnFire && (
        <div className="embers">
          <div className="ember" /><div className="ember" /><div className="ember" /><div className="ember" /><div className="ember" />
        </div>
      )}

      {/* 200 EMA Proximity Banner */}
      {opp.emaProximity?.message && (
        <div className="rounded p-2.5 mb-3 text-[11px] leading-snug font-mono" style={{
          background: `${opp.emaProximity.color}10`,
          borderLeft: `3px solid ${opp.emaProximity.color}`,
          color: opp.emaProximity.color,
        }}>
          <span className="font-bold text-[10px] tracking-wide">
            {opp.emaProximity.state === 'CONFIRMED' && '✅ BOUNCE CONFIRMED'}
            {opp.emaProximity.state === 'APPROACHING' && '⚠️ APPROACHING 200 EMA'}
            {opp.emaProximity.state === 'AT_SUPPORT' && '🔶 AT 200 EMA — WAIT'}
            {opp.emaProximity.state === 'BELOW_EMA' && '🔴 BELOW 200 EMA'}
            {opp.emaProximity.state === 'FAILED' && '🔴 BOUNCE FAILED'}
          </span>
          <span className="ml-2" style={{ color: `${opp.emaProximity.color}aa` }}>
            EMA: ${opp.emaProximity.ema200} ({opp.emaProximity.distance}%)
          </span>
        </div>
      )}

      <div className="flex justify-between items-center mb-2.5">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold tracking-widest font-mono" style={{ color: bull ? '#22c55e' : '#ef4444' }}>{bull ? '▲ BULLISH' : '▼ BEARISH'}</span>
          {isOnFire ? (
            <span className="text-[10px] font-semibold font-mono px-2 py-0.5 rounded fire-badge">🔥 {opp.confidence}/5</span>
          ) : (
            <span className="text-[10px] font-semibold font-mono px-1.5 py-px rounded" style={{ background: 'rgba(0,212,255,0.1)', color: '#00d4ff' }}>{opp.confidence}/5</span>
          )}
          {insider?.confirmed && <span className="text-[10px] font-semibold font-mono px-1.5 py-px rounded" style={{ background: 'rgba(245,158,11,0.1)', color: '#f59e0b' }}>🛡 INSIDER</span>}
          {isOnFire && <span className="text-[10px] font-bold tracking-wider font-mono" style={{ color: '#ff8c00', textShadow: '0 0 8px rgba(255,140,0,0.4)' }}>HIGH CONVICTION</span>}
        </div>
        <div className="flex items-center gap-2">
          <ConfidencePips level={opp.confidence} />
          <span className="text-[11px] text-white/20 font-mono">{new Date(opp.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
        </div>
      </div>

      <div className="flex items-baseline gap-2.5 mb-1.5">
        <span className="text-3xl font-extrabold text-white tracking-tight font-display">{opp.ticker}</span>
        <span className="text-base text-white/40 font-mono">${opp.stockPrice}</span>
        <span className="text-sm font-semibold font-mono" style={{ color: opp.change >= 0 ? '#22c55e' : '#ef4444' }}>{opp.change >= 0 ? '+' : ''}{opp.change}%</span>
      </div>

      <div className="flex gap-1.5 flex-wrap mb-3">
        {[
          { label: 'Vol/OI', value: `${layers.flow.volOiRatio}x` },
          { label: layers.flow.orderType, value: layers.flow.side },
          { label: 'Premium', value: layers.flow.premium >= 1000000 ? `$${(layers.flow.premium / 1000000).toFixed(1)}M` : `$${(layers.flow.premium / 1000).toFixed(0)}K` },
          { label: 'DTE', value: play.legs[0]?.dte || '—' },
        ].map(b => (
          <span key={b.label} className="text-[10px] font-mono px-2 py-0.5 rounded border" style={{ background: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.5)' }}>
            {b.label} <span className="text-white/80 font-semibold">{b.value}</span>
          </span>
        ))}
      </div>

      <div className="rounded-lg p-3 mb-3" style={{ background: 'rgba(255,255,255,0.02)', borderLeft: '2px solid rgba(255,255,255,0.06)' }}>
        <p className="text-[13px] leading-relaxed text-white/70">{opp.thesis}</p>
      </div>

      <div className="rounded-lg p-3" style={{ background: bull ? 'rgba(34,197,94,0.04)' : 'rgba(239,68,68,0.04)', border: `1px solid ${bull ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)'}` }}>
        <span className="text-xs font-bold font-mono" style={{ color: bull ? '#22c55e' : '#ef4444' }}>▸ {play.strategy.toUpperCase()}</span>
        <p className="text-[13px] text-white/60 font-mono mt-0.5">
          {play.legs.map((l, i) => <span key={i}>{i > 0 ? ' / ' : ''}{l.action} ${l.strike}{l.type === 'CALL' ? 'C' : 'P'}</span>)}
          {' · '}{play.legs[0]?.expiration} · {play.legs[0]?.dte} DTE
        </p>
        <p className="text-[11px] text-white/35 italic mt-0.5">{play.reasoning}</p>
        <PLBar {...play} />
      </div>

      <div className="flex gap-2 mt-2.5">
        <button onClick={() => onActivate(opp)}
          className="flex-1 py-2 text-[11px] font-bold font-mono rounded border transition-all hover:bg-green-500/10"
          style={{ color: '#22c55e', borderColor: 'rgba(34,197,94,0.2)' }}>
          I'm In This Trade →
        </button>
        <button onClick={() => onDeepDive(opp)}
          className="flex-1 py-2 text-[11px] font-bold font-mono rounded border transition-all hover:bg-cyan-500/10"
          style={{ color: '#00d4ff', borderColor: 'rgba(0,212,255,0.2)' }}>
          Deep Dive 🔬
        </button>
        <button onClick={() => setExpanded(!expanded)}
          className="px-4 py-2 text-[11px] font-mono text-white/25 border border-white/5 rounded hover:border-white/15 hover:text-white/40 transition-all">
          {expanded ? '▴' : '▾'}
        </button>
      </div>

      {expanded && (
        <div className="mt-2.5 pt-2.5 border-t border-white/5 animate-fade-up">
          <span className="text-[9px] font-bold tracking-[0.12em] text-white/20 font-mono">INSTITUTIONAL SCORECARD</span>
          <div className="mt-2">
            {layerConfig.map(l => <LayerRow key={l.key} icon={l.icon} name={l.name} score={l.score} label={l.description} />)}
            {insider?.entries?.length > 0 && (
              <LayerRow icon="🏛" name="INSIDER / CONGRESSIONAL" score={insider.confirmed ? 1 : 0} label={insider.description || 'No recent insider activity detected.'} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Tracked Trade Card ──
function TrackedTradeCard({ trade, onClose }) {
  const status = STATUS_CONFIG[trade.status] || STATUS_CONFIG.ACTIVE;
  const bull = trade.direction === 'BULLISH';
  const plPositive = trade.plPercent >= 0;

  return (
    <div className="rounded-lg p-3.5 transition-colors" style={{
      background: 'rgba(255,255,255,0.015)',
      border: `1px solid ${status.color}22`,
      borderLeft: `3px solid ${status.color}`,
    }}>
      <div className="flex justify-between items-center mb-2">
        <div className="flex items-center gap-2">
          <span className="text-xl font-bold text-white font-display">{trade.ticker}</span>
          <span className="text-[10px] font-bold font-mono px-1.5 py-px rounded" style={{ background: `${status.color}15`, color: status.color }}>
            {status.icon} {status.label}
          </span>
        </div>
        <span className="text-[10px] text-white/20 font-mono">Day {trade.daysSinceAlert}</span>
      </div>

      <div className="text-xs font-mono text-white/50 mb-2">
        {trade.strategy} · {trade.legs.map((l, i) => `${i > 0 ? ' / ' : ''}${l.action} $${l.strike}${l.type === 'CALL' ? 'C' : 'P'}`).join('')}
      </div>

      <div className="grid grid-cols-3 gap-3 mb-2">
        <div>
          <span className="block text-[9px] text-white/20 font-mono mb-0.5">P/L</span>
          <span className="text-sm font-bold font-mono" style={{ color: plPositive ? '#22c55e' : '#ef4444' }}>
            {plPositive ? '+' : ''}{trade.plPercent}%
          </span>
        </div>
        <div>
          <span className="block text-[9px] text-white/20 font-mono mb-0.5">OI CHANGE</span>
          <span className="text-sm font-bold font-mono" style={{ color: trade.oiChange >= 0 ? '#22c55e' : '#ef4444' }}>
            {trade.oiChange >= 0 ? '+' : ''}{trade.oiChange}%
          </span>
        </div>
        <div>
          <span className="block text-[9px] text-white/20 font-mono mb-0.5">OI</span>
          <span className="text-sm font-mono text-white/60">
            {trade.alertOI.toLocaleString()} → {trade.currentOI.toLocaleString()}
          </span>
        </div>
      </div>

      <p className="text-[11px] text-white/45 leading-snug">{trade.statusDescription}</p>

      <button onClick={() => onClose(trade.id)}
        className="mt-2 text-[10px] font-mono text-white/20 hover:text-white/40 transition-colors">
        Close Trade
      </button>
    </div>
  );
}

function FilterPill({ label, active, onClick }) {
  return (
    <button onClick={onClick} className="px-2.5 py-1 text-[11px] font-semibold font-mono rounded border transition-all"
      style={{ color: active ? '#08080a' : 'rgba(255,255,255,0.35)', background: active ? '#00d4ff' : 'transparent', borderColor: active ? '#00d4ff' : 'rgba(255,255,255,0.08)' }}>
      {label}
    </button>
  );
}

// ── Main ──
export default function Home() {
  const router = useRouter();
  const [opportunities, setOpportunities] = useState([]);
  const [trackedTrades, setTrackedTrades] = useState([]);
  const [marketFlow, setMarketFlow] = useState(null);
  const [marketQuotes, setMarketQuotes] = useState({});
  const [vixWarning, setVixWarning] = useState(null);
  const [vixLevel, setVixLevel] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastScan, setLastScan] = useState(null);
  const [error, setError] = useState(null);
  const [dirFilter, setDirFilter] = useState('ALL');
  const [minConf, setMinConf] = useState(4);
  const [showFilters, setShowFilters] = useState(false);
  const [activeTab, setActiveTab] = useState('feed');

  const scan = useCallback(async () => {
    try {
      const res = await fetch('/api/scan');
      if (!res.ok) throw new Error(`Scan failed: ${res.status}`);
      const data = await res.json();
      if (data.opportunities) setOpportunities(data.opportunities);
      if (data.trackedTrades) setTrackedTrades(data.trackedTrades);
      if (data.marketFlow) setMarketFlow(data.marketFlow);
      if (data.marketQuotes) setMarketQuotes(data.marketQuotes);
      if (data.vixWarning !== undefined) setVixWarning(data.vixWarning);
      if (data.vixLevel !== undefined) setVixLevel(data.vixLevel);
      setLastScan(data.scannedAt);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { scan(); const i = setInterval(scan, 60000); return () => clearInterval(i); }, [scan]);

  const activateTrade = async (card) => {
    try {
      const res = await fetch('/api/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'activate', card }),
      });
      if (res.ok) {
        const data = await res.json();
        setTrackedTrades(prev => [data.trade, ...prev]);
        setActiveTab('trades');
      }
    } catch { /* ignore */ }
  };

  const closeTrade = async (tradeId) => {
    try {
      await fetch('/api/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'deactivate', tradeId }),
      });
      setTrackedTrades(prev => prev.filter(t => t.id !== tradeId));
    } catch { /* ignore */ }
  };

  const deepDive = (card) => {
    // Store card data in sessionStorage and navigate to analyze page
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('deepDiveCard', JSON.stringify(card));
      router.push('/analyze?mode=deepdive');
    }
  };

  const filtered = opportunities.filter(o => {
    if (dirFilter !== 'ALL' && o.direction !== dirFilter) return false;
    if (o.confidence < minConf) return false;
    return true;
  });

  const spy = marketQuotes.SPY;
  const qqq = marketQuotes.QQQ;

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="sticky top-0 z-10 backdrop-blur-xl border-b border-white/5" style={{ background: 'rgba(8,8,10,0.94)' }}>
        <div className="max-w-[680px] mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="text-[17px] font-extrabold tracking-tight font-display">FLOWHUNTER</span>
            <div className="flex items-center gap-1">
              <div className="w-[5px] h-[5px] rounded-full bg-green-500 animate-pulse-dot" />
              <span className="text-[9px] text-green-500 font-bold tracking-[0.1em] font-mono">{loading ? 'SCANNING' : 'LIVE'}</span>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <span className="text-[10px] text-white/20 font-mono">
              {activeTab === 'feed' ? `${filtered.length} setups` : `${trackedTrades.length} trades`}
            </span>
            <Link href="/analyze"
              className="px-2.5 py-1 text-[10px] font-semibold font-mono border border-white/10 rounded text-white/40 hover:text-cyan-400 hover:border-cyan-500/30 transition-all"
              style={{ background: 'rgba(255,255,255,0.05)' }}>
              🔬 Analyze
            </Link>
            <Link href="/journal"
              className="px-2.5 py-1 text-[10px] font-semibold font-mono border border-white/10 rounded text-white/40 hover:text-green-400 hover:border-green-500/30 transition-all"
              style={{ background: 'rgba(255,255,255,0.05)' }}>
              📓 Journal
            </Link>
            {activeTab === 'feed' && (
              <button onClick={() => setShowFilters(!showFilters)}
                className="px-2.5 py-1 text-[10px] font-semibold font-mono border border-white/10 rounded"
                style={{ color: showFilters ? '#08080a' : 'rgba(255,255,255,0.4)', background: showFilters ? '#00d4ff' : 'rgba(255,255,255,0.05)' }}>
                ⚙ Filter
              </button>
            )}
          </div>
        </div>

        {/* Tab bar */}
        <div className="max-w-[680px] mx-auto px-4 flex gap-0 border-t border-white/5">
          {[
            { id: 'feed', label: 'Live Feed', count: filtered.length },
            { id: 'trades', label: 'My Trades', count: trackedTrades.length },
          ].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className="flex-1 py-2 text-center text-[11px] font-semibold font-mono transition-all border-b-2"
              style={{
                color: activeTab === tab.id ? '#00d4ff' : 'rgba(255,255,255,0.25)',
                borderColor: activeTab === tab.id ? '#00d4ff' : 'transparent',
              }}>
              {tab.label} {tab.count > 0 && <span className="ml-1 text-[9px] opacity-50">({tab.count})</span>}
            </button>
          ))}
        </div>

        {showFilters && activeTab === 'feed' && (
          <div className="max-w-[680px] mx-auto px-4 pb-3 flex gap-5 flex-wrap animate-fade-up border-t border-white/5 pt-2.5">
            <div>
              <span className="block text-[9px] font-bold text-white/20 tracking-[0.1em] font-mono mb-1.5">DIRECTION</span>
              <div className="flex gap-1">{['ALL', 'BULLISH', 'BEARISH'].map(d => <FilterPill key={d} label={d} active={dirFilter === d} onClick={() => setDirFilter(d)} />)}</div>
            </div>
            <div>
              <span className="block text-[9px] font-bold text-white/20 tracking-[0.1em] font-mono mb-1.5">MIN CONFIDENCE</span>
              <div className="flex gap-1">{[4, 5].map(c => <FilterPill key={c} label={`${c}/5+`} active={minConf === c} onClick={() => setMinConf(c)} />)}</div>
            </div>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="max-w-[680px] mx-auto px-3.5 pt-3.5 pb-20 flex flex-col gap-2.5">
        {activeTab === 'feed' && (
          <>
            {/* VIX Circuit Breaker Banner */}
            {vixWarning && (
              <div className="rounded-lg p-3 text-[12px] font-mono leading-snug animate-fade-up" style={{
                background: `${vixWarning.color}10`,
                border: `1px solid ${vixWarning.color}30`,
                borderLeft: `3px solid ${vixWarning.color}`,
                color: vixWarning.color,
              }}>
                <span className="font-bold text-[11px] tracking-wide block mb-1">
                  {vixWarning.level === 'HALT' && '🚨 VIX CIRCUIT BREAKER — BULLISH SUGGESTIONS PAUSED'}
                  {vixWarning.level === 'DANGER' && '🔴 VIX HIGH — ELEVATED RISK'}
                  {vixWarning.level === 'CAUTION' && '⚠️ VIX ELEVATED — PROCEED WITH CAUTION'}
                </span>
                <span style={{ color: `${vixWarning.color}bb` }}>{vixWarning.message}</span>
              </div>
            )}

            <div className="flex items-center justify-center gap-2 py-1.5 text-[10px] text-white/15 font-mono">
              <div className="flex gap-[2px]">{[0, 1, 2].map(i => <div key={i} className="w-[2px] h-2.5 rounded-sm animate-pulse-dot" style={{ background: 'rgba(0,212,255,0.35)', animationDelay: `${i * 150}ms` }} />)}</div>
              {loading ? 'Running initial scan of 25 tickers...' : lastScan ? `Last scan ${new Date(lastScan).toLocaleTimeString()} · 5-layer analysis active` : 'Waiting...'}
            </div>
            {error && <div className="text-center py-4 text-red-400/60 text-xs font-mono">{error}</div>}
            {!loading && filtered.length === 0 && !error && (
              <div className="text-center py-16 text-white/15 text-sm font-mono">
                No setups meeting 4/5 confidence right now.<br />
                <span className="text-white/10">High-conviction setups will appear when detected.</span>
              </div>
            )}
            {filtered.map((opp, i) => <OpportunityCard key={opp.id} opp={opp} index={i} onActivate={activateTrade} onDeepDive={deepDive} />)}
          </>
        )}

        {activeTab === 'trades' && (
          <>
            {trackedTrades.length === 0 ? (
              <div className="text-center py-16 text-white/15 text-sm font-mono">
                No active trades.<br />
                <span className="text-white/10">Tap "I'm In This Trade" on any card to start tracking.</span>
              </div>
            ) : (
              trackedTrades.map(trade => <TrackedTradeCard key={trade.id} trade={trade} onClose={closeTrade} />)
            )}
          </>
        )}
      </div>

      {/* Bottom bar */}
      <div className="fixed bottom-0 left-0 right-0 z-10 backdrop-blur-xl border-t border-white/[0.04] py-2 px-4" style={{ background: 'rgba(8,8,10,0.95)' }}>
        <div className="max-w-[680px] mx-auto flex justify-center gap-5">
          <div className="flex items-center gap-1 text-[10px] font-mono">
            <span className="text-white/20">SPY</span>
            <span className="font-semibold" style={{ color: (spy?.change || 0) >= 0 ? '#22c55e' : '#ef4444' }}>
              {spy ? `${spy.change >= 0 ? '+' : ''}${spy.change}%` : '—'}
            </span>
          </div>
          <div className="flex items-center gap-1 text-[10px] font-mono">
            <span className="text-white/20">QQQ</span>
            <span className="font-semibold" style={{ color: (qqq?.change || 0) >= 0 ? '#22c55e' : '#ef4444' }}>
              {qqq ? `${qqq.change >= 0 ? '+' : ''}${qqq.change}%` : '—'}
            </span>
          </div>
          <div className="flex items-center gap-1 text-[10px] font-mono">
            <span className="text-white/20">VIX</span>
            <span className="font-semibold" style={{
              color: vixLevel >= 28 ? '#ef4444' : vixLevel >= 22 ? '#eab308' : '#22c55e',
            }}>
              {vixLevel ? vixLevel.toFixed(1) : '—'}
            </span>
          </div>
          <div className="flex items-center gap-1 text-[10px] font-mono">
            <span className="text-white/20">MKT FLOW</span>
            <span className="font-semibold" style={{ color: marketFlow?.bullish ? '#22c55e' : '#ef4444' }}>
              {marketFlow?.netPremium || '—'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
