'use client';
import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

const GRADE_COLORS = { A: '#22c55e', B: '#86efac', C: '#eab308', D: '#f97316', F: '#ef4444' };

// ── Markdown-ish renderer for Claude responses ──
function AnalysisResult({ text }) {
  if (!text) return null;
  return (
    <div className="space-y-1">
      {text.split('\n').map((line, i) => {
        if (line.startsWith('**SETUP GRADE:')) {
          const grade = line.match(/[A-F]/)?.[0] || 'C';
          return <div key={i} className="text-lg font-bold font-mono py-2 px-3 rounded-lg my-3" style={{ background: `${GRADE_COLORS[grade]}15`, color: GRADE_COLORS[grade], borderLeft: `3px solid ${GRADE_COLORS[grade]}` }}>{line.replace(/\*\*/g, '')}</div>;
        }
        if (line.startsWith('**') && line.endsWith('**')) return <h3 key={i} className="text-sm font-bold text-white/80 mt-4 mb-1">{line.replace(/\*\*/g, '')}</h3>;
        if (line.startsWith('**')) return <p key={i} className="text-sm text-white/70 mt-3 mb-1 font-semibold">{line.replace(/\*\*/g, '')}</p>;
        if (line.startsWith('- ')) return <p key={i} className="text-[13px] text-white/60 pl-3 leading-relaxed">• {line.slice(2)}</p>;
        if (line.startsWith('---')) return <hr key={i} className="border-white/5 my-3" />;
        if (line.trim() === '') return <div key={i} className="h-2" />;
        return <p key={i} className="text-[13px] text-white/55 leading-relaxed">{line}</p>;
      })}
    </div>
  );
}

// ── LEAP result card ──
function LeapCard({ setup }) {
  const [aiLoading, setAiLoading] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState(null);

  if (setup.noSetup) {
    return (
      <div className="rounded-lg p-4 border border-white/5 bg-white/[0.01] opacity-50">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-lg font-bold font-display text-white/40">{setup.ticker}</span>
          <span className="text-xs font-mono" style={{ color: GRADE_COLORS.F }}>🔴 F</span>
        </div>
        <p className="text-xs text-white/30 font-mono">{setup.thesis}</p>
      </div>
    );
  }

  const bull = setup.type === 'CALL';
  const spread = setup.spreadAlternative;

  const runAIDeepDive = async () => {
    setAiLoading(true);
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contractData: {
            ticker: setup.ticker, strike: setup.strike, type: setup.type.toLowerCase(),
            expiration: setup.expiration, bid: 0, ask: 0, mark: setup.premium,
            current_price: setup.stockPrice, iv: setup.iv / 100,
            volume: 0, open_interest: setup.oi,
            greeks: { delta: setup.delta, gamma: setup.gamma, theta: setup.theta, vega: setup.vega },
          },
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setAiAnalysis(data.analysis);
      } else {
        const err = await res.json();
        setAiAnalysis(`Error: ${err.error || 'Analysis failed'}. Make sure ANTHROPIC_API_KEY is set in your Vercel environment variables.`);
      }
    } catch (err) {
      setAiAnalysis(`Error: ${err.message}`);
    } finally {
      setAiLoading(false);
    }
  };

  const isOnFire = setup.grade === 'A' || setup.emaProximity?.state === 'CONFIRMED';

  return (
    <div className={`rounded-lg p-4 border animate-fade-up ${isOnFire ? 'fire-card' : ''}`} style={isOnFire ? {} : {
      background: 'rgba(255,255,255,0.015)',
      borderColor: `${GRADE_COLORS[setup.grade]}25`,
      borderLeft: `3px solid ${GRADE_COLORS[setup.grade]}`,
    }}>
      {/* Rising ember particles for fire cards */}
      {isOnFire && (
        <div className="embers">
          <div className="ember" /><div className="ember" /><div className="ember" /><div className="ember" /><div className="ember" />
        </div>
      )}

      {/* 200 EMA Proximity Banner */}
      {setup.emaProximity?.message && (
        <div className="rounded-lg p-3 mb-3 text-[12px] leading-snug font-mono relative z-10" style={{
          background: `${setup.emaProximity.color}10`,
          borderLeft: `3px solid ${setup.emaProximity.color}`,
          color: setup.emaProximity.color,
        }}>
          <div className="font-bold text-[11px] mb-1 tracking-wide">
            {setup.emaProximity.state === 'CONFIRMED' && '✅ BOUNCE CONFIRMED — ENTRY CONDITIONS MET'}
            {setup.emaProximity.state === 'APPROACHING' && '⚠️ APPROACHING 200 EMA SUPPORT'}
            {setup.emaProximity.state === 'AT_SUPPORT' && '🔶 AT 200 EMA SUPPORT — WAIT FOR CONFIRMATION'}
            {setup.emaProximity.state === 'BELOW_EMA' && '🔴 BELOW 200 EMA — BROKEN SUPPORT'}
            {setup.emaProximity.state === 'FAILED' && '🔴 BOUNCE FAILED — AVOID ENTRY'}
          </div>
          <div style={{ color: `${setup.emaProximity.color}cc` }}>
            200 EMA: ${setup.emaProximity.ema200} | Current: ${setup.emaProximity.currentPrice} ({setup.emaProximity.distance}%)
          </div>
          <div className="mt-1" style={{ color: `${setup.emaProximity.color}aa` }}>
            {setup.emaProximity.message}
          </div>
          {setup.originalGrade && (
            <div className="mt-1 text-[10px]" style={{ color: `${setup.emaProximity.color}88` }}>
              Grade adjusted: {setup.originalGrade} → {setup.grade} based on EMA position
            </div>
          )}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-3 relative z-10">
        <div className="flex items-center gap-2">
          <span className="text-2xl font-extrabold font-display text-white">{setup.ticker}</span>
          {isOnFire ? (
            <span className="text-sm font-bold font-mono px-2 py-0.5 rounded fire-badge">
              🔥 Grade {setup.grade}
            </span>
          ) : (
            <span className="text-sm font-bold font-mono" style={{ color: GRADE_COLORS[setup.grade] }}>
              {setup.gradeEmoji} Grade {setup.grade}
            </span>
          )}
          {isOnFire && <span className="text-[10px] font-bold tracking-wider font-mono" style={{ color: '#ff8c00', textShadow: '0 0 8px rgba(255,140,0,0.4)' }}>HIGH CONVICTION</span>}
        </div>
        <span className="text-xs text-white/30 font-mono">${setup.stockPrice}</span>
      </div>

      {/* Contract */}
      <div className="text-xs font-mono text-white/50 mb-3">
        {bull ? 'CALL' : 'PUT'} ${setup.strike} exp {setup.expiration} · {setup.dte} DTE · Premium ${setup.premium} (${setup.premiumTotal}/contract)
      </div>

      {/* Key metrics */}
      <div className="grid grid-cols-4 gap-2 mb-3">
        {[
          { label: 'Delta', value: setup.delta },
          { label: 'IV', value: `${setup.iv}%` },
          { label: 'Theta/wk', value: `-$${setup.thetaWeekly}` },
          { label: 'OI', value: setup.oi.toLocaleString() },
          { label: 'Breakeven', value: `$${setup.breakeven}` },
          { label: 'Move Req', value: `${setup.moveRequired}%` },
          { label: 'Bid/Ask', value: `${setup.bidAskSpread}%` },
          { label: 'RSI', value: setup.rsi ? Math.round(setup.rsi) : '—' },
        ].map(m => (
          <div key={m.label}>
            <span className="block text-[9px] text-white/20 font-mono">{m.label}</span>
            <span className="text-xs font-semibold font-mono text-white/60">{m.value}</span>
          </div>
        ))}
      </div>

      {/* Thesis */}
      <div className="rounded p-3 mb-3" style={{ background: 'rgba(255,255,255,0.02)', borderLeft: '2px solid rgba(255,255,255,0.06)' }}>
        <p className="text-[13px] leading-relaxed text-white/65">{setup.thesis}</p>
      </div>

      {/* Risk */}
      <p className="text-[11px] text-red-400/60 mb-3 font-mono">⚠ Primary risk: {setup.primaryRisk}</p>

      {/* Exit rules */}
      <div className="grid grid-cols-3 gap-2 mb-3 text-[10px] font-mono text-white/40">
        <div>
          <span className="block text-white/20">Profit Target (50%)</span>
          Sell at ${setup.exits.profitTarget} (+${setup.exits.profitTargetDollar})
        </div>
        <div>
          <span className="block text-white/20">Stop Loss (21%)</span>
          Sell at ${setup.exits.stopLoss} (-${setup.exits.stopLossDollar})
        </div>
        <div>
          <span className="block text-white/20">Time Exit</span>
          {setup.exits.timeExit}
        </div>
      </div>

      {/* Position sizing */}
      <div className="flex gap-3 mb-3 text-[10px] font-mono text-white/35">
        <span>$25K: {setup.sizing.portfolio25k} contracts</span>
        <span>$50K: {setup.sizing.portfolio50k}</span>
        <span>$100K: {setup.sizing.portfolio100k}</span>
        {setup.sizing.portfolioSize !== 50000 && <span className="text-cyan-400/50">Yours: {setup.sizing.portfolioUser}</span>}
      </div>

      {/* Spread alternative */}
      {spread && (
        <div className="rounded p-3 mb-3 border border-white/5 bg-white/[0.02]">
          <span className="text-[10px] font-bold text-cyan-400/70 font-mono block mb-1">
            🔄 SPREAD ALTERNATIVE: Saves {spread.savings}%
          </span>
          <div className="text-[11px] font-mono text-white/50">
            <p>Buy ${setup.strike}{bull ? 'C' : 'P'} / Sell ${spread.sellStrike}{bull ? 'C' : 'P'}</p>
            <p>Net debit: ${spread.netDebit} (${spread.netDebitTotal}/contract) · Max profit: ${spread.maxProfit} · Risk: ${spread.maxLoss} · R:R {spread.rewardRisk}:1</p>
          </div>
        </div>
      )}

      {/* Scorecard */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {Object.entries(setup.factors).map(([key, val]) => (
          <span key={key} className="text-[9px] font-mono px-1.5 py-0.5 rounded" style={{
            background: val ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)',
            color: val ? '#22c55e' : '#ef4444',
            border: `1px solid ${val ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)'}`,
          }}>
            {val ? '✓' : '✗'} {key.replace(/([A-Z])/g, ' $1').trim()}
          </span>
        ))}
      </div>

      {/* AI Deep Dive button (optional — requires Anthropic key) */}
      <button onClick={runAIDeepDive} disabled={aiLoading}
        className="w-full py-2 text-[11px] font-mono rounded border transition-all hover:bg-cyan-500/10 disabled:opacity-50"
        style={{ color: '#00d4ff', borderColor: 'rgba(0,212,255,0.2)' }}>
        {aiLoading ? '● Asking Claude...' : '🔬 AI Deep Dive (optional — requires API key)'}
      </button>

      {aiAnalysis && (
        <div className="mt-3 p-3 rounded border border-white/5 bg-white/[0.02]">
          <AnalysisResult text={aiAnalysis} />
        </div>
      )}
    </div>
  );
}

// ── Suspense wrapper ──
export default function AnalyzePage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center" style={{ background: '#08080a' }}><span className="text-white/20 text-sm font-mono">Loading...</span></div>}>
      <AnalyzePageInner />
    </Suspense>
  );
}

function AnalyzePageInner() {
  const searchParams = useSearchParams();
  const [mode, setMode] = useState('leap');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // LEAP results
  const [leapResults, setLeapResults] = useState(null);

  // LEAP form
  const [leapConfig, setLeapConfig] = useState({
    tickers: 'NVDA, AAPL, MSFT, GOOGL, AMZN',
    bias: 'bullish',
    max_premium: '5000',
    portfolio_size: '50000',
  });

  // Contract form
  const [contract, setContract] = useState({
    ticker: '', strike: '', type: 'call', expiration: '',
    bid: '', ask: '', iv: '', volume: '', open_interest: '',
    current_price: '', delta: '', gamma: '', theta: '', vega: '', rho: '',
  });
  const [contractAnalysis, setContractAnalysis] = useState(null);

  // Freeform
  const [freeformText, setFreeformText] = useState('');
  const [freeformAnalysis, setFreeformAnalysis] = useState(null);

  // Deep dive from card
  const [deepDiveCard, setDeepDiveCard] = useState(null);
  const [deepDiveAnalysis, setDeepDiveAnalysis] = useState(null);

  useEffect(() => {
    if (searchParams.get('mode') === 'deepdive' && typeof window !== 'undefined') {
      const stored = sessionStorage.getItem('deepDiveCard');
      if (stored) {
        try {
          const card = JSON.parse(stored);
          setDeepDiveCard(card);
          setMode('deepdive');
          sessionStorage.removeItem('deepDiveCard');
          runDeepDive(card);
        } catch { }
      }
    }
  }, [searchParams]);

  const runDeepDive = async (card) => {
    setLoading(true); setError(null); setDeepDiveAnalysis(null);
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'card_deepdive', cardData: card }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Failed');
      setDeepDiveAnalysis((await res.json()).analysis);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  const runLeapScan = async () => {
    setLoading(true); setError(null); setLeapResults(null);
    try {
      const res = await fetch('/api/leaps', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tickers: leapConfig.tickers.split(',').map(t => t.trim().toUpperCase()),
          bias: leapConfig.bias,
          max_premium: parseInt(leapConfig.max_premium) || 5000,
          portfolio_size: parseInt(leapConfig.portfolio_size) || 50000,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Scan failed');
      const data = await res.json();
      setLeapResults(data.results);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  const runContractAnalysis = async () => {
    setLoading(true); setError(null); setContractAnalysis(null);
    try {
      const c = contract;
      const res = await fetch('/api/analyze', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contractData: {
            ticker: c.ticker.toUpperCase(), strike: parseFloat(c.strike), type: c.type,
            expiration: c.expiration, bid: parseFloat(c.bid) || 0, ask: parseFloat(c.ask) || 0,
            mark: c.bid && c.ask ? (parseFloat(c.bid) + parseFloat(c.ask)) / 2 : 0,
            current_price: parseFloat(c.current_price) || null,
            iv: c.iv ? parseFloat(c.iv) / 100 : null,
            volume: parseInt(c.volume) || 0, open_interest: parseInt(c.open_interest) || 0,
            greeks: { delta: parseFloat(c.delta) || null, gamma: parseFloat(c.gamma) || null, theta: parseFloat(c.theta) || null, vega: parseFloat(c.vega) || null, rho: parseFloat(c.rho) || null },
          },
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Failed');
      setContractAnalysis((await res.json()).analysis);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  const runFreeform = async () => {
    setLoading(true); setError(null); setFreeformAnalysis(null);
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userMessage: freeformText }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Failed');
      setFreeformAnalysis((await res.json()).analysis);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  const inp = "w-full bg-white/[0.03] border border-white/10 rounded px-3 py-2 text-sm text-white font-mono placeholder-white/20 focus:outline-none focus:border-cyan-500/30";
  const lbl = "block text-[10px] font-bold text-white/30 tracking-wide font-mono mb-1";
  const updateC = (f, v) => setContract(p => ({ ...p, [f]: v }));

  const tabs = [
    { id: 'leap', label: 'LEAP Scanner' },
    { id: 'contract', label: 'Contract Analysis' },
    { id: 'freeform', label: 'Ask Anything' },
  ];
  if (deepDiveCard) tabs.unshift({ id: 'deepdive', label: 'Deep Dive' });

  return (
    <div className="min-h-screen" style={{ background: '#08080a' }}>
      <div className="sticky top-0 z-10 backdrop-blur-xl border-b border-white/5" style={{ background: 'rgba(8,8,10,0.94)' }}>
        <div className="max-w-[720px] mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/" className="text-white/30 hover:text-white/60 text-sm font-mono transition-colors">← Feed</Link>
          <span className="text-[17px] font-extrabold tracking-tight font-display text-white">ANALYZE</span>
        </div>
        <div className="max-w-[720px] mx-auto px-4 flex gap-0 border-t border-white/5">
          {tabs.map(tab => (
            <button key={tab.id} onClick={() => setMode(tab.id)}
              className="flex-1 py-2 text-center text-[11px] font-semibold font-mono border-b-2 transition-all"
              style={{ color: mode === tab.id ? '#00d4ff' : 'rgba(255,255,255,0.25)', borderColor: mode === tab.id ? '#00d4ff' : 'transparent' }}>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-[720px] mx-auto px-4 py-6">

        {/* ── Deep Dive (from card) ── */}
        {mode === 'deepdive' && deepDiveCard && (
          <div>
            <div className="mb-4 p-4 rounded-lg border border-cyan-500/20 bg-cyan-500/5">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg font-bold font-display text-white">{deepDiveCard.ticker}</span>
                <span className="text-[10px] font-bold font-mono px-1.5 py-px rounded" style={{
                  background: deepDiveCard.direction === 'BULLISH' ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                  color: deepDiveCard.direction === 'BULLISH' ? '#22c55e' : '#ef4444',
                }}>{deepDiveCard.direction}</span>
                <span className="text-[10px] font-mono text-cyan-400">{deepDiveCard.confidence}/5</span>
              </div>
              <p className="text-xs text-white/50 font-mono">
                {deepDiveCard.suggestedPlay?.strategy} · {deepDiveCard.suggestedPlay?.legs?.map(l => `${l.action} $${l.strike}${l.type === 'CALL' ? 'C' : 'P'}`).join(' / ')}
              </p>
            </div>
            {loading && <p className="text-center text-cyan-400/50 text-sm font-mono animate-pulse-dot">Running institutional deep dive...</p>}
            {deepDiveAnalysis && <div className="p-4 rounded-lg border border-white/5 bg-white/[0.02]"><AnalysisResult text={deepDiveAnalysis} /></div>}
          </div>
        )}

        {/* ── LEAP Scanner ── */}
        {mode === 'leap' && (
          <div>
            <div className="space-y-4 mb-6">
              <div>
                <label className={lbl}>TICKERS (comma separated)</label>
                <input className={inp} placeholder="NVDA, AAPL, MSFT, GOOGL, AMZN"
                  value={leapConfig.tickers} onChange={e => setLeapConfig(p => ({ ...p, tickers: e.target.value }))} />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className={lbl}>BIAS</label>
                  <select className={inp} value={leapConfig.bias} onChange={e => setLeapConfig(p => ({ ...p, bias: e.target.value }))}>
                    <option value="bullish">Bullish</option>
                    <option value="bearish">Bearish</option>
                  </select>
                </div>
                <div>
                  <label className={lbl}>MAX PREMIUM ($)</label>
                  <input className={inp} placeholder="5000" type="number" value={leapConfig.max_premium} onChange={e => setLeapConfig(p => ({ ...p, max_premium: e.target.value }))} />
                </div>
                <div>
                  <label className={lbl}>PORTFOLIO SIZE ($)</label>
                  <input className={inp} placeholder="50000" type="number" value={leapConfig.portfolio_size} onChange={e => setLeapConfig(p => ({ ...p, portfolio_size: e.target.value }))} />
                </div>
              </div>
              <button onClick={runLeapScan} disabled={loading}
                className="w-full py-3 rounded-lg text-sm font-bold font-mono transition-all disabled:opacity-50"
                style={{ background: loading ? 'rgba(0,212,255,0.1)' : '#00d4ff', color: loading ? '#00d4ff' : '#08080a' }}>
                {loading ? '● Scanning Schwab chains...' : 'Run LEAP Scanner'}
              </button>
            </div>
            {leapResults && (
              <div className="space-y-3">
                {leapResults.map((setup, i) => <LeapCard key={setup.ticker + i} setup={setup} />)}
              </div>
            )}
          </div>
        )}

        {/* ── Contract Analysis (Claude-powered) ── */}
        {mode === 'contract' && (
          <div>
            <p className="text-[10px] text-white/20 font-mono mb-4">Powered by Claude AI — requires ANTHROPIC_API_KEY in Vercel env vars</p>
            <div className="space-y-4 mb-6">
              <div className="grid grid-cols-3 gap-3">
                <div><label className={lbl}>TICKER</label><input className={inp} placeholder="NVDA" value={contract.ticker} onChange={e => updateC('ticker', e.target.value)} /></div>
                <div><label className={lbl}>STRIKE</label><input className={inp} placeholder="185" type="number" value={contract.strike} onChange={e => updateC('strike', e.target.value)} /></div>
                <div><label className={lbl}>TYPE</label><select className={inp} value={contract.type} onChange={e => updateC('type', e.target.value)}><option value="call">Call</option><option value="put">Put</option></select></div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div><label className={lbl}>EXPIRATION</label><input className={inp} type="date" value={contract.expiration} onChange={e => updateC('expiration', e.target.value)} /></div>
                <div><label className={lbl}>STOCK PRICE</label><input className={inp} placeholder="192.50" type="number" step="0.01" value={contract.current_price} onChange={e => updateC('current_price', e.target.value)} /></div>
                <div><label className={lbl}>IV %</label><input className={inp} placeholder="44.25" type="number" step="0.01" value={contract.iv} onChange={e => updateC('iv', e.target.value)} /></div>
              </div>
              <div className="grid grid-cols-4 gap-3">
                <div><label className={lbl}>BID</label><input className={inp} placeholder="29.85" type="number" step="0.01" value={contract.bid} onChange={e => updateC('bid', e.target.value)} /></div>
                <div><label className={lbl}>ASK</label><input className={inp} placeholder="30.45" type="number" step="0.01" value={contract.ask} onChange={e => updateC('ask', e.target.value)} /></div>
                <div><label className={lbl}>VOLUME</label><input className={inp} placeholder="198" type="number" value={contract.volume} onChange={e => updateC('volume', e.target.value)} /></div>
                <div><label className={lbl}>OPEN INTEREST</label><input className={inp} placeholder="3068" type="number" value={contract.open_interest} onChange={e => updateC('open_interest', e.target.value)} /></div>
              </div>
              <div>
                <span className="block text-[10px] font-bold text-white/20 tracking-wide font-mono mb-2">GREEKS</span>
                <div className="grid grid-cols-5 gap-3">
                  {['delta', 'gamma', 'theta', 'vega', 'rho'].map(g => (
                    <div key={g}><label className={lbl}>{g.toUpperCase()}</label><input className={inp} placeholder="0.00" type="number" step="0.0001" value={contract[g]} onChange={e => updateC(g, e.target.value)} /></div>
                  ))}
                </div>
              </div>
              <button onClick={runContractAnalysis} disabled={loading}
                className="w-full py-3 rounded-lg text-sm font-bold font-mono transition-all disabled:opacity-50"
                style={{ background: loading ? 'rgba(0,212,255,0.1)' : '#00d4ff', color: loading ? '#00d4ff' : '#08080a' }}>
                {loading ? '● Analyzing with Claude...' : '🔬 Run Full Analysis'}
              </button>
            </div>
            {contractAnalysis && <div className="p-4 rounded-lg border border-white/5 bg-white/[0.02]"><AnalysisResult text={contractAnalysis} /></div>}
          </div>
        )}

        {/* ── Freeform (Claude-powered) ── */}
        {mode === 'freeform' && (
          <div>
            <p className="text-[10px] text-white/20 font-mono mb-4">Powered by Claude AI — requires ANTHROPIC_API_KEY in Vercel env vars</p>
            <textarea className={`${inp} h-32 resize-none mb-4`}
              placeholder="e.g. I'm looking at TSLA $250 calls expiring in June. IV is at 55%. Should I wait?"
              value={freeformText} onChange={e => setFreeformText(e.target.value)} />
            <button onClick={runFreeform} disabled={loading || !freeformText.trim()}
              className="w-full py-3 rounded-lg text-sm font-bold font-mono transition-all disabled:opacity-50"
              style={{ background: loading ? 'rgba(0,212,255,0.1)' : '#00d4ff', color: loading ? '#00d4ff' : '#08080a' }}>
              {loading ? '● Thinking...' : 'Ask the Analyst'}
            </button>
            {freeformAnalysis && <div className="mt-4 p-4 rounded-lg border border-white/5 bg-white/[0.02]"><AnalysisResult text={freeformAnalysis} /></div>}
          </div>
        )}

        {error && <div className="mt-4 p-3 rounded-lg border border-red-500/20 bg-red-500/5 text-sm text-red-400 font-mono">{error}</div>}
      </div>
    </div>
  );
}
