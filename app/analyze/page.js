'use client';
import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

// Grade colors
const GRADE_COLORS = {
  A: '#22c55e', B: '#86efac', C: '#eab308', D: '#f97316', F: '#ef4444',
};

function AnalysisResult({ text }) {
  if (!text) return null;

  // Simple markdown-ish rendering
  const lines = text.split('\n');
  return (
    <div className="space-y-1">
      {lines.map((line, i) => {
        // Headers
        if (line.startsWith('**SETUP GRADE:')) {
          const grade = line.match(/[A-F]/)?.[0] || 'C';
          return (
            <div key={i} className="text-lg font-bold font-mono py-2 px-3 rounded-lg my-3" style={{
              background: `${GRADE_COLORS[grade]}15`,
              color: GRADE_COLORS[grade],
              borderLeft: `3px solid ${GRADE_COLORS[grade]}`,
            }}>
              {line.replace(/\*\*/g, '')}
            </div>
          );
        }
        if (line.startsWith('**') && line.endsWith('**')) {
          return <h3 key={i} className="text-sm font-bold text-white/80 mt-4 mb-1">{line.replace(/\*\*/g, '')}</h3>;
        }
        if (line.startsWith('**')) {
          return <p key={i} className="text-sm text-white/70 mt-3 mb-1 font-semibold">{line.replace(/\*\*/g, '')}</p>;
        }
        // Bullet points
        if (line.startsWith('- ')) {
          return <p key={i} className="text-[13px] text-white/60 pl-3 leading-relaxed">• {line.slice(2)}</p>;
        }
        // Dividers
        if (line.startsWith('---')) {
          return <hr key={i} className="border-white/5 my-3" />;
        }
        // Empty lines
        if (line.trim() === '') return <div key={i} className="h-2" />;
        // Regular text
        return <p key={i} className="text-[13px] text-white/55 leading-relaxed">{line}</p>;
      })}
    </div>
  );
}

// Default export wraps in Suspense to satisfy Next.js requirement for useSearchParams
export default function AnalyzePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#08080a' }}>
        <span className="text-white/20 text-sm font-mono">Loading analyzer...</span>
      </div>
    }>
      <AnalyzePageInner />
    </Suspense>
  );
}

function AnalyzePageInner() {
  const searchParams = useSearchParams();
  const [mode, setMode] = useState('contract'); // 'contract' | 'leap' | 'freeform'
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [error, setError] = useState(null);
  const [deepDiveCard, setDeepDiveCard] = useState(null);

  // Contract form state
  const [contract, setContract] = useState({
    ticker: '', strike: '', type: 'call', expiration: '',
    bid: '', ask: '', iv: '', volume: '', open_interest: '',
    current_price: '', chance_of_profit: '',
    delta: '', gamma: '', theta: '', vega: '', rho: '',
  });

  // LEAP scanner state
  const [leapConfig, setLeapConfig] = useState({
    tickers: 'NVDA, AAPL, MSFT, GOOGL, AMZN',
    bias: 'bullish',
    max_premium: '5000',
    portfolio_size: '50000',
  });

  // Freeform state
  const [freeformText, setFreeformText] = useState('');

  // Auto-load deep dive card from sessionStorage
  useEffect(() => {
    if (searchParams.get('mode') === 'deepdive' && typeof window !== 'undefined') {
      const stored = sessionStorage.getItem('deepDiveCard');
      if (stored) {
        try {
          const card = JSON.parse(stored);
          setDeepDiveCard(card);
          sessionStorage.removeItem('deepDiveCard');
          // Auto-run the analysis
          runDeepDive(card);
        } catch { /* ignore parse errors */ }
      }
    }
  }, [searchParams]);

  const runDeepDive = async (card) => {
    setLoading(true);
    setError(null);
    setAnalysis(null);
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'card_deepdive', cardData: card }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || err.error || 'Analysis failed');
      }
      const data = await res.json();
      setAnalysis(data.analysis);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const updateContract = (field, value) => setContract(prev => ({ ...prev, [field]: value }));

  const runAnalysis = async () => {
    setLoading(true);
    setError(null);
    setAnalysis(null);

    try {
      let body = {};

      if (mode === 'contract') {
        body = {
          contractData: {
            ticker: contract.ticker.toUpperCase(),
            strike: parseFloat(contract.strike),
            type: contract.type,
            expiration: contract.expiration,
            bid: parseFloat(contract.bid) || 0,
            ask: parseFloat(contract.ask) || 0,
            mark: contract.bid && contract.ask ? ((parseFloat(contract.bid) + parseFloat(contract.ask)) / 2) : 0,
            current_price: parseFloat(contract.current_price) || null,
            iv: contract.iv ? parseFloat(contract.iv) / 100 : null,
            volume: parseInt(contract.volume) || 0,
            open_interest: parseInt(contract.open_interest) || 0,
            chance_of_profit: contract.chance_of_profit ? parseFloat(contract.chance_of_profit) / 100 : null,
            greeks: {
              delta: parseFloat(contract.delta) || null,
              gamma: parseFloat(contract.gamma) || null,
              theta: parseFloat(contract.theta) || null,
              vega: parseFloat(contract.vega) || null,
              rho: parseFloat(contract.rho) || null,
            },
          },
        };
      } else if (mode === 'leap') {
        body = {
          mode: 'leap_scanner',
          tickers: leapConfig.tickers.split(',').map(t => t.trim().toUpperCase()),
          bias: leapConfig.bias,
          max_premium: parseInt(leapConfig.max_premium),
          portfolio_size: parseInt(leapConfig.portfolio_size),
          min_dte: 180,
          max_dte: 540,
          preferred_delta_range: [0.55, 0.70],
        };
      } else {
        body = { userMessage: freeformText };
      }

      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || err.error || 'Analysis failed');
      }

      const data = await res.json();
      setAnalysis(data.analysis);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const inputClass = "w-full bg-white/[0.03] border border-white/10 rounded px-3 py-2 text-sm text-white font-mono placeholder-white/20 focus:outline-none focus:border-cyan-500/30";
  const labelClass = "block text-[10px] font-bold text-white/30 tracking-wide font-mono mb-1";

  return (
    <div className="min-h-screen" style={{ background: '#08080a' }}>
      {/* Header */}
      <div className="sticky top-0 z-10 backdrop-blur-xl border-b border-white/5" style={{ background: 'rgba(8,8,10,0.94)' }}>
        <div className="max-w-[720px] mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-white/30 hover:text-white/60 text-sm font-mono transition-colors">← Feed</Link>
            <span className="text-[17px] font-extrabold tracking-tight font-display text-white">ANALYZE</span>
          </div>
        </div>

        {/* Mode tabs */}
        <div className="max-w-[720px] mx-auto px-4 flex gap-0 border-t border-white/5">
          {[
            { id: 'contract', label: 'Contract Analysis' },
            { id: 'leap', label: 'LEAP Scanner' },
            { id: 'freeform', label: 'Ask Anything' },
          ].map(tab => (
            <button key={tab.id} onClick={() => { setMode(tab.id); setAnalysis(null); setError(null); }}
              className="flex-1 py-2 text-center text-[11px] font-semibold font-mono transition-all border-b-2"
              style={{ color: mode === tab.id ? '#00d4ff' : 'rgba(255,255,255,0.25)', borderColor: mode === tab.id ? '#00d4ff' : 'transparent' }}>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-[720px] mx-auto px-4 py-6">

        {/* Deep dive card summary */}
        {deepDiveCard && (
          <div className="mb-6 p-4 rounded-lg border border-cyan-500/20 bg-cyan-500/5">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg font-bold font-display text-white">{deepDiveCard.ticker}</span>
              <span className="text-[10px] font-bold font-mono px-1.5 py-px rounded"
                style={{ background: deepDiveCard.direction === 'BULLISH' ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                  color: deepDiveCard.direction === 'BULLISH' ? '#22c55e' : '#ef4444' }}>
                {deepDiveCard.direction}
              </span>
              <span className="text-[10px] font-mono text-cyan-400">{deepDiveCard.confidence}/5 confidence</span>
            </div>
            <p className="text-xs text-white/50 font-mono">
              {deepDiveCard.suggestedPlay?.strategy} · {deepDiveCard.suggestedPlay?.legs?.map(l =>
                `${l.action} $${l.strike}${l.type === 'CALL' ? 'C' : 'P'}`
              ).join(' / ')} · {deepDiveCard.suggestedPlay?.legs?.[0]?.dte} DTE
            </p>
            <p className="text-[10px] text-cyan-400/50 mt-2 font-mono">Running institutional deep dive analysis...</p>
          </div>
        )}

        {/* ── Contract Analysis Form ── */}
        {!deepDiveCard && mode === 'contract' && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className={labelClass}>TICKER</label>
                <input className={inputClass} placeholder="NVDA" value={contract.ticker} onChange={e => updateContract('ticker', e.target.value)} />
              </div>
              <div>
                <label className={labelClass}>STRIKE</label>
                <input className={inputClass} placeholder="185" type="number" value={contract.strike} onChange={e => updateContract('strike', e.target.value)} />
              </div>
              <div>
                <label className={labelClass}>TYPE</label>
                <select className={inputClass} value={contract.type} onChange={e => updateContract('type', e.target.value)}>
                  <option value="call">Call</option>
                  <option value="put">Put</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className={labelClass}>EXPIRATION</label>
                <input className={inputClass} type="date" value={contract.expiration} onChange={e => updateContract('expiration', e.target.value)} />
              </div>
              <div>
                <label className={labelClass}>STOCK PRICE</label>
                <input className={inputClass} placeholder="192.50" type="number" step="0.01" value={contract.current_price} onChange={e => updateContract('current_price', e.target.value)} />
              </div>
              <div>
                <label className={labelClass}>IV %</label>
                <input className={inputClass} placeholder="44.25" type="number" step="0.01" value={contract.iv} onChange={e => updateContract('iv', e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-4 gap-3">
              <div>
                <label className={labelClass}>BID</label>
                <input className={inputClass} placeholder="29.85" type="number" step="0.01" value={contract.bid} onChange={e => updateContract('bid', e.target.value)} />
              </div>
              <div>
                <label className={labelClass}>ASK</label>
                <input className={inputClass} placeholder="30.45" type="number" step="0.01" value={contract.ask} onChange={e => updateContract('ask', e.target.value)} />
              </div>
              <div>
                <label className={labelClass}>VOLUME</label>
                <input className={inputClass} placeholder="198" type="number" value={contract.volume} onChange={e => updateContract('volume', e.target.value)} />
              </div>
              <div>
                <label className={labelClass}>OPEN INTEREST</label>
                <input className={inputClass} placeholder="3068" type="number" value={contract.open_interest} onChange={e => updateContract('open_interest', e.target.value)} />
              </div>
            </div>

            <div>
              <span className="block text-[10px] font-bold text-white/20 tracking-wide font-mono mb-2 mt-2">GREEKS (optional but improves analysis)</span>
              <div className="grid grid-cols-5 gap-3">
                {['delta', 'gamma', 'theta', 'vega', 'rho'].map(greek => (
                  <div key={greek}>
                    <label className={labelClass}>{greek.toUpperCase()}</label>
                    <input className={inputClass} placeholder={greek === 'delta' ? '0.55' : greek === 'theta' ? '-0.05' : '0.00'}
                      type="number" step="0.0001" value={contract[greek]} onChange={e => updateContract(greek, e.target.value)} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── LEAP Scanner Form ── */}
        {!deepDiveCard && mode === 'leap' && (
          <div className="space-y-4">
            <div>
              <label className={labelClass}>TICKERS (comma separated)</label>
              <input className={inputClass} placeholder="NVDA, AAPL, MSFT, GOOGL, AMZN"
                value={leapConfig.tickers} onChange={e => setLeapConfig(prev => ({ ...prev, tickers: e.target.value }))} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className={labelClass}>BIAS</label>
                <select className={inputClass} value={leapConfig.bias} onChange={e => setLeapConfig(prev => ({ ...prev, bias: e.target.value }))}>
                  <option value="bullish">Bullish</option>
                  <option value="bearish">Bearish</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>MAX PREMIUM ($)</label>
                <input className={inputClass} placeholder="5000" type="number"
                  value={leapConfig.max_premium} onChange={e => setLeapConfig(prev => ({ ...prev, max_premium: e.target.value }))} />
              </div>
              <div>
                <label className={labelClass}>PORTFOLIO SIZE ($)</label>
                <input className={inputClass} placeholder="50000" type="number"
                  value={leapConfig.portfolio_size} onChange={e => setLeapConfig(prev => ({ ...prev, portfolio_size: e.target.value }))} />
              </div>
            </div>
          </div>
        )}

        {/* ── Freeform ── */}
        {!deepDiveCard && mode === 'freeform' && (
          <div>
            <label className={labelClass}>ASK ANYTHING ABOUT OPTIONS</label>
            <textarea className={`${inputClass} h-32 resize-none`}
              placeholder="e.g. I'm looking at TSLA $250 calls expiring in June. IV is at 55%. Is this a good entry or should I wait? Also considering a bull call spread..."
              value={freeformText} onChange={e => setFreeformText(e.target.value)} />
          </div>
        )}

        {/* Run button — hidden during deep dive (auto-runs) */}
        {!deepDiveCard && (
        <button onClick={runAnalysis} disabled={loading}
          className="w-full mt-6 py-3 rounded-lg text-sm font-bold font-mono transition-all disabled:opacity-50"
          style={{ background: loading ? 'rgba(0,212,255,0.1)' : '#00d4ff', color: loading ? '#00d4ff' : '#08080a' }}>
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <span className="animate-pulse-dot">●</span> Analyzing...
            </span>
          ) : (
            mode === 'leap' ? 'Run LEAP Scanner' : mode === 'freeform' ? 'Ask the Analyst' : 'Run Full Analysis'
          )}
        </button>
        )}

        {/* Error */}
        {error && (
          <div className="mt-4 p-3 rounded-lg border border-red-500/20 bg-red-500/5 text-sm text-red-400 font-mono">
            {error}
          </div>
        )}

        {/* Analysis result */}
        {analysis && (
          <div className="mt-6 p-4 rounded-lg border border-white/5 bg-white/[0.02]">
            <AnalysisResult text={analysis} />
          </div>
        )}
      </div>
    </div>
  );
}
