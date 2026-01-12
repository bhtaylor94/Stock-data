import React from 'react';
import { InfoTooltip, DEFINITIONS } from './InfoTooltip';

export function EvidenceDrawer({ 
  isOpen, 
  onClose, 
  data 
}: { 
  isOpen: boolean;
  onClose: () => void;
  data: any;
}) {
  if (!isOpen) return null;
  
  try {
    return (
      <>
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40" onClick={onClose} />
        <div className="fixed right-0 top-0 bottom-0 w-full max-w-2xl bg-slate-900 border-l border-slate-700 z-50 overflow-y-auto">
          <div className="sticky top-0 bg-slate-900 border-b border-slate-700 p-4 flex items-center justify-between">
            <h2 className="text-xl font-bold text-white">📊 Evidence Packet</h2>
            <button onClick={onClose} className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white transition">
              ✕ Close
            </button>
          </div>
          <div className="p-6 space-y-6">{renderAllSections(data)}</div>
        </div>
      </>
    );
  } catch (error) {
    console.error('Evidence Drawer Error:', error);
    return (
      <>
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40" onClick={onClose} />
        <div className="fixed right-0 top-0 bottom-0 w-full max-w-2xl bg-slate-900 border-l border-slate-700 z-50 overflow-y-auto">
          <div className="p-6">
            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30">
              <p className="text-red-400 font-semibold mb-2">Unable to Display Evidence</p>
              <p className="text-sm text-slate-400">Click X to close</p>
            </div>
          </div>
        </div>
      </>
    );
  }
}

function renderAllSections(data: any) {
  const sections: React.ReactNode[] = [];
  if (!data) return sections;
  
  // 1. AUDIT SUMMARY - COMPLETE
  try {
    if (data?.verification) {
      sections.push(
        <section key="audit">
          <h3 className="text-lg font-semibold text-white mb-3">Audit Summary</h3>
          <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/50 space-y-3">
            <div className="flex items-center justify-between pb-3 border-b border-slate-700">
              <div className="text-xs text-slate-400">
                <span>Version: 1.0</span>
                <span className="mx-2">•</span>
                <span>Source: {data.dataSource || data.meta?.source || 'stock'}</span>
              </div>
              <div className="text-xs text-emerald-400">✓ {new Date().toLocaleString()}</div>
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center justify-between p-2 rounded bg-slate-800/50">
                <div>
                  <p className="text-sm font-medium text-white">Data Freshness</p>
                  <p className="text-xs text-slate-400">{data.meta?.isStale ? 'Stale data detected' : 'Fresh, real-time data'}</p>
                </div>
                <span className={`px-2 py-1 rounded text-xs font-bold ${!data.meta?.isStale ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                  {!data.meta?.isStale ? 'PASS' : 'FAIL'}
                </span>
              </div>
              
              <div className="flex items-center justify-between p-2 rounded bg-slate-800/50">
                <div>
                  <p className="text-sm font-medium text-white">Completeness Score ≥ 70%</p>
                  <p className="text-xs text-slate-400">Score: {data.verification.completenessScore || 0}/100</p>
                </div>
                <span className={`px-2 py-1 rounded text-xs font-bold ${(data.verification.completenessScore || 0) >= 70 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                  {(data.verification.completenessScore || 0) >= 70 ? 'PASS' : 'FAIL'}
                </span>
              </div>
              
              <div className="flex items-center justify-between p-2 rounded bg-slate-800/50">
                <div>
                  <p className="text-sm font-medium text-white">Signal Agreement Ratio ≥ 0.45</p>
                  <p className="text-xs text-slate-400">
                    {data.verification.signalAlignment?.agreementCount || 0} of {data.verification.signalAlignment?.totalSignals || 6} signals agree
                    ({(((data.verification.signalAlignment?.agreementCount || 0) / (data.verification.signalAlignment?.totalSignals || 6)) * 100).toFixed(0)}%)
                  </p>
                </div>
                <span className={`px-2 py-1 rounded text-xs font-bold ${
                  (data.verification.signalAlignment?.agreementCount || 0) / (data.verification.signalAlignment?.totalSignals || 6) >= 0.45 
                    ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
                }`}>
                  {(data.verification.signalAlignment?.agreementCount || 0) / (data.verification.signalAlignment?.totalSignals || 6) >= 0.45 ? 'PASS' : 'FAIL'}
                </span>
              </div>
              
              <div className="flex items-center justify-between p-2 rounded bg-slate-800/50">
                <div>
                  <p className="text-sm font-medium text-white">At Least One Confirmed Chart Pattern</p>
                  <p className="text-xs text-slate-400">
                    {data.verification?.patternTrust?.hasConfirmedPatterns ? 
                      `${data.chartPatterns?.confirmed?.length || 0} confirmed patterns detected` :
                      'No confirmed patterns'
                    }
                  </p>
                </div>
                <span className={`px-2 py-1 rounded text-xs font-bold ${
                  data.verification?.patternTrust?.hasConfirmedPatterns 
                    ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'
                }`}>
                  {data.verification?.patternTrust?.hasConfirmedPatterns ? 'PASS' : 'N/A'}
                </span>
              </div>
            </div>
          </div>
        </section>
      );
    }
  } catch (e) { console.error('Audit error:', e); }
  
  // 2. CHART PATTERN VALIDATION
  try {
    if (data?.chartPatterns && (data.chartPatterns.confirmed?.length > 0 || data.chartPatterns.forming?.length > 0)) {
      sections.push(
        <section key="patterns">
          <h3 className="text-lg font-semibold text-white mb-3">📈 Chart Pattern Validation</h3>
          <div className="p-4 rounded-xl bg-blue-500/5 border border-blue-500/30 space-y-3">
            <div className="p-3 rounded-lg bg-slate-800/50">
              <p className="text-xs text-slate-400 mb-1">Pattern Detection Trust Level</p>
              <p className={`text-sm font-bold ${
                data.verification?.patternTrust?.trustLevel?.includes('HIGH') ? 'text-emerald-400' :
                data.verification?.patternTrust?.trustLevel?.includes('MEDIUM') ? 'text-amber-400' : 'text-red-400'
              }`}>
                {data.verification?.patternTrust?.trustLevel || 'Unknown'}
              </p>
            </div>
            
            {data.chartPatterns.confirmed?.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-emerald-400 mb-2">✓ Confirmed Patterns (Volume Validated)</h4>
                {data.chartPatterns.confirmed.map((p: any, i: number) => (
                  <div key={i} className="p-3 mb-2 rounded-lg bg-emerald-500/5 border border-emerald-500/30">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-bold text-white">{p?.name || 'Pattern'}</span>
                      <span className="text-xs px-2 py-1 rounded bg-emerald-500/20 text-emerald-400 font-bold">
                        {p?.result?.confidence || p?.confidence || 0}% confidence
                      </span>
                    </div>
                    {p?.result?.pricePoints && (
                      <div className="mt-2 p-2 rounded bg-slate-800/50 space-y-1">
                        <p className="text-xs font-semibold text-blue-300">Detection Details:</p>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          {Object.entries(p.result.pricePoints).map(([key, val]: [string, any]) => (
                            <div key={key}>
                              <span className="text-slate-400">{key}:</span>
                              <span className="text-white ml-1">${typeof val === 'number' ? val.toFixed(2) : val}</span>
                            </div>
                          ))}
                        </div>
                        {p.result.volumeValidation && (
                          <p className="text-xs text-emerald-400">✓ Volume spike: {p.result.volumeValidation}</p>
                        )}
                      </div>
                    )}
                    <p className="text-xs text-slate-300 mt-2">{p?.statusReason || 'Confirmed'}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      );
    }
  } catch (e) { console.error('Pattern error:', e); }
  
  // 3. DECISION CONTEXT - FULL
  try {
    if (data?.meta) {
      sections.push(
        <section key="meta">
          <h3 className="text-lg font-semibold text-white mb-3">Decision Context</h3>
          <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/50 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Timestamp:</span>
              <span className="text-white">{new Date(data.meta.asOf).toLocaleString()}</span>
            </div>
            {data.meta.regime && (
              <div className="flex justify-between text-sm items-center">
                <span className="text-slate-400 flex items-center">
                  Regime
                  <InfoTooltip term="Market Regime" definition={DEFINITIONS.regime} />
                </span>
                <span className="text-white">{data.meta.regime}</span>
              </div>
            )}
            {data.meta.atrPct !== undefined && (
              <div className="flex justify-between text-sm items-center">
                <span className="text-slate-400 flex items-center">
                  ATR%
                  <InfoTooltip term="ATR (Average True Range)" definition={DEFINITIONS.atr} />
                </span>
                <span className="text-white">{data.meta.atrPct}</span>
              </div>
            )}
            {data.meta.trendStrength !== undefined && (
              <div className="flex justify-between text-sm items-center">
                <span className="text-slate-400 flex items-center">
                  Trend Strength
                  <InfoTooltip term="Trend Strength" definition={DEFINITIONS.trendStrength} />
                </span>
                <span className="text-white">{data.meta.trendStrength}</span>
              </div>
            )}
            {data.meta.responseTimeMs && (
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Response Time:</span>
                <span className="text-emerald-400">{data.meta.responseTimeMs}ms</span>
              </div>
            )}
          </div>
        </section>
      );
    }
  } catch (e) { console.error('Meta error:', e); }
  
  // 4. TECHNICAL INDICATORS
  try {
    if (data?.technicals) {
      // Helper to get definition for a technical indicator
      const getTechDef = (key: string): string | undefined => {
        const keyLower = key.toLowerCase().replace(/[^a-z0-9]/g, '');
        
        // Exact matches
        if (keyLower === 'rsi') return DEFINITIONS.rsi;
        if (keyLower === 'macd') return DEFINITIONS.macd;
        if (keyLower === 'sma20') return DEFINITIONS.sma20;
        if (keyLower === 'sma50') return DEFINITIONS.sma50;
        if (keyLower === 'sma200') return DEFINITIONS.sma200;
        if (keyLower === 'ema12') return DEFINITIONS.ema12;
        if (keyLower === 'ema26') return DEFINITIONS.ema26;
        
        // Pattern matches
        if (keyLower.includes('bollinger')) return DEFINITIONS.bollinger;
        if (keyLower.includes('goldencross')) return DEFINITIONS.goldencross;
        if (keyLower.includes('deathcross')) return DEFINITIONS.deathcross;
        if (keyLower.includes('ema')) return DEFINITIONS.ema;
        if (keyLower.includes('sma')) return DEFINITIONS.sma;
        if (keyLower.includes('volume')) return DEFINITIONS.volume;
        if (keyLower.includes('support')) return DEFINITIONS.support;
        if (keyLower.includes('resistance')) return DEFINITIONS.resistance;
        if (keyLower.includes('atr')) return DEFINITIONS.atr;
        
        return undefined;
      };
      
      sections.push(
        <section key="technicals">
          <h3 className="text-lg font-semibold text-white mb-3">Technical Indicators</h3>
          <div className="grid grid-cols-2 gap-3">
            {Object.entries(data.technicals)
              .filter(([key]) => !['score', 'maxScore'].includes(key))
              .map(([key, value]) => {
                const def = getTechDef(key);
                return (
                  <div key={key} className="p-3 rounded-lg bg-slate-800/50 border border-slate-700/50">
                    <p className="text-xs text-slate-400 mb-1 flex items-center">
                      {key.toUpperCase()}
                      {def && <InfoTooltip term={key.toUpperCase()} definition={def} />}
                    </p>
                    <p className="text-sm font-bold text-white">
                      {typeof value === 'boolean' ? (value ? '✓' : '✗') : 
                       typeof value === 'number' ? value.toFixed(2) : String(value)}
                    </p>
                  </div>
                );
              })}
          </div>
        </section>
      );
    }
  } catch (e) { console.error('Technicals error:', e); }
  
  // 5. FUNDAMENTALS
  try {
    if (data?.fundamentals) {
      // Helper to get definition for a fundamental metric
      const getFundDef = (key: string): string | undefined => {
        const keyLower = key.toLowerCase().replace(/[^a-z0-9]/g, '');
        
        // Exact matches
        if (keyLower === 'pe' || keyLower === 'peratio') return DEFINITIONS.pe;
        if (keyLower === 'pb' || keyLower === 'pbratio') return DEFINITIONS.pb;
        if (keyLower === 'ps' || keyLower === 'psratio') return DEFINITIONS.ps;
        if (keyLower === 'peg' || keyLower === 'pegratio') return DEFINITIONS.peg;
        if (keyLower === 'roe') return DEFINITIONS.roe;
        if (keyLower === 'roa') return DEFINITIONS.roa;
        if (keyLower === 'eps') return DEFINITIONS.eps;
        if (keyLower === 'beta') return DEFINITIONS.beta;
        if (keyLower === 'marketcap') return DEFINITIONS.marketcap;
        
        // Pattern matches
        if (keyLower.includes('grossmargin')) return DEFINITIONS.grossmargin;
        if (keyLower.includes('profitmargin') || keyLower.includes('netmargin')) return DEFINITIONS.profitmargin;
        if (keyLower.includes('operatingmargin')) return DEFINITIONS.operatingmargin;
        if (keyLower.includes('revenuegrowth')) return DEFINITIONS.revenuegrowth;
        if (keyLower.includes('earningsgrowth')) return DEFINITIONS.earningsgrowth;
        if (keyLower.includes('debt') && keyLower.includes('equity')) return DEFINITIONS.debttoratio;
        if (keyLower.includes('currentratio')) return DEFINITIONS.currentratio;
        if (keyLower.includes('quickratio')) return DEFINITIONS.quickratio;
        if (keyLower.includes('dividend') && keyLower.includes('yield')) return DEFINITIONS.dividendyield;
        if (keyLower.includes('payout')) return DEFINITIONS.payoutratio;
        if (keyLower.includes('float')) return DEFINITIONS.float;
        if (keyLower.includes('short') && keyLower.includes('interest')) return DEFINITIONS.shortinterest;
        
        return undefined;
      };
      
      sections.push(
        <section key="fundamentals">
          <h3 className="text-lg font-semibold text-white mb-3">Fundamental Metrics</h3>
          <div className="grid grid-cols-2 gap-3">
            {Object.entries(data.fundamentals)
              .filter(([key]) => !['score', 'maxScore'].includes(key))
              .map(([key, value]) => {
                const def = getFundDef(key);
                return (
                  <div key={key} className="p-3 rounded-lg bg-slate-800/50 border border-slate-700/50">
                    <p className="text-xs text-slate-400 mb-1 flex items-center">
                      {key.toUpperCase()}
                      {def && <InfoTooltip term={key.toUpperCase()} definition={def} />}
                    </p>
                    <p className="text-sm font-bold text-white">
                      {typeof value === 'number' ? value.toFixed(2) : String(value || 'N/A')}
                    </p>
                  </div>
                );
              })}
          </div>
        </section>
      );
    }
  } catch (e) { console.error('Fundamentals error:', e); }
  
  // 6. NEWS HEADLINES - FIXED
  try {
    if (data?.news?.headlines?.length > 0) {
      sections.push(
        <section key="news">
          <h3 className="text-lg font-semibold text-white mb-3">Recent News</h3>
          <div className="space-y-2">
            {data.news.headlines.slice(0, 10).map((item: any, i: number) => (
              <div key={i} className="p-3 rounded-lg bg-slate-800/50 border border-slate-700/50">
                <p className="text-sm text-white mb-1">{item.headline || item.title || 'No headline'}</p>
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <span>{item.source || 'Unknown'}</span>
                  <span>•</span>
                  <span>{item.datetime ? new Date(item.datetime * 1000).toLocaleDateString() : 'N/A'}</span>
                  {item.sentiment && (
                    <>
                      <span>•</span>
                      <span className={
                        item.sentiment === 'POSITIVE' ? 'text-emerald-400' :
                        item.sentiment === 'NEGATIVE' ? 'text-red-400' : 'text-slate-400'
                      }>
                        {item.sentiment}
                      </span>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      );
    }
  } catch (e) { console.error('News error:', e); }
  
  // 7. ANALYST COVERAGE
  try {
    if (data?.analysts && data.analysts.totalAnalysts > 0 && data.analysts.consensus !== 'NO COVERAGE') {
      sections.push(
        <section key="analysts">
          <h3 className="text-lg font-semibold text-white mb-3">Analyst Coverage</h3>
          <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/50 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Total Analysts:</span>
              <span className="text-white font-bold">{data.analysts.totalAnalysts}</span>
            </div>
            {data.analysts.consensus && (
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Consensus:</span>
                <span className={`font-bold ${
                  data.analysts.consensus === 'STRONG BUY' || data.analysts.consensus === 'BUY' ? 'text-emerald-400' :
                  data.analysts.consensus === 'SELL' ? 'text-red-400' : 'text-slate-400'
                }`}>{data.analysts.consensus}</span>
              </div>
            )}
            {data.analysts.targetPrice > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Price Target:</span>
                <span className="text-white">${data.analysts.targetPrice.toFixed(2)}</span>
              </div>
            )}
            {data.analysts.buyPercent !== undefined && (
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Buy %:</span>
                <span className="text-white">{data.analysts.buyPercent}%</span>
              </div>
            )}
          </div>
        </section>
      );
    } else if (data?.analysts && (data.analysts.totalAnalysts === 0 || data.analysts.consensus === 'NO COVERAGE')) {
      // Show that there's no analyst coverage
      sections.push(
        <section key="analysts">
          <h3 className="text-lg font-semibold text-white mb-3">Analyst Coverage</h3>
          <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/50">
            <p className="text-sm text-slate-400 text-center py-2">
              ℹ️ No analyst coverage available for this ticker
            </p>
          </div>
        </section>
      );
    }
  } catch (e) { console.error('Analysts error:', e); }
  
  // 8. DATA SOURCES
  sections.push(
    <section key="sources">
      <h3 className="text-lg font-semibold text-white mb-3">Data Sources</h3>
      <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/50">
        <p className="text-sm text-slate-300 mb-2">This analysis is based on:</p>
        <ul className="text-xs text-slate-400 space-y-1">
          <li>• Schwab Market Data API (live quotes & options)</li>
          <li>• Finnhub (fundamentals, news, analyst ratings)</li>
          <li>• Technical indicator calculations (RSI, MACD, etc.)</li>
          <li>• Chart pattern recognition algorithms</li>
          <li>• News sentiment analysis</li>
        </ul>
      </div>
    </section>
  );
  
  // 9. LIMITATIONS
  sections.push(
    <section key="limitations">
      <h3 className="text-lg font-semibold text-white mb-3">⚠️ Limitations</h3>
      <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/30">
        <ul className="text-xs text-amber-200 space-y-1">
          <li>• Past performance does not guarantee future results</li>
          <li>• Market conditions can change rapidly</li>
          <li>• This is not financial advice - do your own research</li>
          <li>• Data accuracy depends on source reliability</li>
          <li>• Technical indicators can give false signals</li>
        </ul>
      </div>
    </section>
  );
  
  return sections;
}
