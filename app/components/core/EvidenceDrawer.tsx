import React from 'react';

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

  const evidence = data?.evidencePacket || data?.evidence || {};
  
  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
        onClick={onClose}
      />
      
      {/* Drawer */}
      <div className="fixed right-0 top-0 bottom-0 w-full max-w-2xl bg-slate-900 border-l border-slate-700 z-50 overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-slate-900 border-b border-slate-700 p-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-white">📊 Evidence Packet</h2>
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white transition"
          >
            ✕ Close
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Audit Summary - Professional Format */}
          {data?.verification && (
            <section>
              <h3 className="text-lg font-semibold text-white mb-3">Audit Summary</h3>
              <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/50 space-y-3">
                {/* Header Info */}
                <div className="flex items-center justify-between pb-3 border-b border-slate-700">
                  <div className="text-xs text-slate-400">
                    <span>Version: 1.0</span>
                    <span className="mx-2">•</span>
                    <span>Source: {data.dataSource || 'stock'}</span>
                  </div>
                  <div className="text-xs text-emerald-400">
                    ✓ {new Date().toLocaleString()}
                  </div>
                </div>
                
                {/* Quality Checks */}
                <div className="space-y-2">
                  {/* Data Freshness */}
                  <div className="flex items-center justify-between p-2 rounded bg-slate-800/50">
                    <div>
                      <p className="text-sm font-medium text-white">Data Freshness</p>
                      <p className="text-xs text-slate-400">
                        {data.meta?.isStale ? 'Stale data detected' : 'Fresh, real-time data'}
                      </p>
                    </div>
                    <span className={`px-2 py-1 rounded text-xs font-bold ${
                      !data.meta?.isStale ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
                    }`}>
                      {!data.meta?.isStale ? 'PASS' : 'FAIL'}
                    </span>
                  </div>
                  
                  {/* Completeness Score */}
                  <div className="flex items-center justify-between p-2 rounded bg-slate-800/50">
                    <div>
                      <p className="text-sm font-medium text-white">Completeness Score ≥ 70%</p>
                      <p className="text-xs text-slate-400">
                        Score: {data.verification.completenessScore || 0}/100
                      </p>
                    </div>
                    <span className={`px-2 py-1 rounded text-xs font-bold ${
                      (data.verification.completenessScore || 0) >= 70 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
                    }`}>
                      {(data.verification.completenessScore || 0) >= 70 ? 'PASS' : 'FAIL'}
                    </span>
                  </div>
                  
                  {/* Signal Agreement */}
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
                        ? 'bg-emerald-500/20 text-emerald-400' 
                        : 'bg-red-500/20 text-red-400'
                    }`}>
                      {(data.verification.signalAlignment?.agreementCount || 0) / (data.verification.signalAlignment?.totalSignals || 6) >= 0.45 ? 'PASS' : 'FAIL'}
                    </span>
                  </div>
                  
                  {/* Chart Patterns Confirmed */}
                  <div className="flex items-center justify-between p-2 rounded bg-slate-800/50">
                    <div>
                      <p className="text-sm font-medium text-white">At Least One Confirmed Chart Pattern</p>
                      <p className="text-xs text-slate-400">
                        {data.verification.patternTrust?.hasConfirmedPatterns ? 
                          `${data.chartPatterns?.confirmed?.length || 0} confirmed patterns detected` :
                          'No confirmed patterns'
                        }
                      </p>
                    </div>
                    <span className={`px-2 py-1 rounded text-xs font-bold ${
                      data.verification.patternTrust?.hasConfirmedPatterns 
                        ? 'bg-emerald-500/20 text-emerald-400' 
                        : 'bg-amber-500/20 text-amber-400'
                    }`}>
                      {data.verification.patternTrust?.hasConfirmedPatterns ? 'PASS' : 'N/A'}
                    </span>
                  </div>
                </div>
              </div>
            </section>
          )}
          
          {/* Chart Pattern Validation - SHOW PROOF */}
          {data?.chartPatterns && (data.chartPatterns.confirmed?.length > 0 || data.chartPatterns.forming?.length > 0) && (
            <section>
              <h3 className="text-lg font-semibold text-white mb-3">📈 Chart Pattern Validation</h3>
              <div className="p-4 rounded-xl bg-blue-500/5 border border-blue-500/30 space-y-3">
                {/* Trust Level */}
                <div className="p-3 rounded-lg bg-slate-800/50">
                  <p className="text-xs text-slate-400 mb-1">Pattern Detection Trust Level</p>
                  <p className={`text-sm font-bold ${
                    data.verification?.patternTrust?.trustLevel?.includes('HIGH') ? 'text-emerald-400' :
                    data.verification?.patternTrust?.trustLevel?.includes('MEDIUM') ? 'text-amber-400' :
                    'text-red-400'
                  }`}>
                    {data.verification?.patternTrust?.trustLevel || 'Unknown'}
                  </p>
                </div>
                
                {/* Confirmed Patterns with Validation */}
                {data.chartPatterns.confirmed?.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold text-emerald-400 mb-2">✓ Confirmed Patterns (Volume Validated)</h4>
                    {data.chartPatterns.confirmed.map((pattern: any, i: number) => (
                      <div key={i} className="p-3 mb-2 rounded-lg bg-emerald-500/5 border border-emerald-500/30">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-bold text-white">{pattern.name}</span>
                          <span className="text-xs px-2 py-1 rounded bg-emerald-500/20 text-emerald-400 font-bold">
                            {pattern.result.confidence}% confidence
                          </span>
                        </div>
                        
                        {/* Validation Details - PROOF */}
                        <div className="mt-2 p-2 rounded bg-slate-800/50 space-y-1">
                          <p className="text-xs font-semibold text-blue-300">Detection Details:</p>
                          {pattern.result.pricePoints && (
                            <div className="grid grid-cols-2 gap-2 text-xs">
                              {Object.entries(pattern.result.pricePoints).map(([key, value]: [string, any]) => (
                                <div key={key}>
                                  <span className="text-slate-400">{key}:</span>
                                  <span className="text-white ml-1">${typeof value === 'number' ? value.toFixed(2) : value}</span>
                                </div>
                              ))}
                            </div>
                          )}
                          {pattern.result.volumeValidation && (
                            <p className="text-xs text-emerald-400">
                              ✓ Volume spike confirmed: {pattern.result.volumeValidation}
                            </p>
                          )}
                          {pattern.result.detectionMethod && (
                            <p className="text-xs text-slate-400">
                              Method: {pattern.result.detectionMethod}
                            </p>
                          )}
                        </div>
                        
                        <p className="text-xs text-slate-300 mt-2">{pattern.statusReason}</p>
                      </div>
                    ))}
                  </div>
                )}
                
                {/* Forming Patterns */}
                {data.chartPatterns.forming?.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold text-amber-400 mb-2">⏳ Forming Patterns (Not Yet Confirmed)</h4>
                    {data.chartPatterns.forming.slice(0, 3).map((pattern: any, i: number) => (
                      <div key={i} className="p-3 mb-2 rounded-lg bg-amber-500/5 border border-amber-500/30">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-white">{pattern.name}</span>
                          <span className="text-xs px-2 py-1 rounded bg-amber-500/20 text-amber-400">
                            {pattern.result.confidence}% confidence
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-1">{pattern.statusReason}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>
          )}
          
          {/* Meta Information */}
          {data?.meta && (
            <section>
              <h3 className="text-lg font-semibold text-white mb-3">Decision Context</h3>
              <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/50 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Timestamp:</span>
                  <span className="text-white">{new Date(data.meta.asOf).toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Regime:</span>
                  <span className="text-white">{data.meta.regime}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">ATR%:</span>
                  <span className="text-white">{data.meta.atrPct}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Trend Strength:</span>
                  <span className="text-white">{data.meta.trendStrength}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Response Time:</span>
                  <span className="text-emerald-400">{data.meta.responseTimeMs}ms</span>
                </div>
              </div>
            </section>
          )}

          {/* Setup Details */}
          {evidence.setup && (
            <section>
              <h3 className="text-lg font-semibold text-white mb-3">Setup</h3>
              <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/50">
                <p className="text-sm text-slate-300">{evidence.setup}</p>
              </div>
            </section>
          )}

          {/* Playbook */}
          {evidence.playbook && (
            <section>
              <h3 className="text-lg font-semibold text-white mb-3">Playbook</h3>
              <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/50">
                <p className="text-sm text-slate-300">{evidence.playbook}</p>
              </div>
            </section>
          )}

          {/* Technical Indicators */}
          {data?.technicals && (
            <section>
              <h3 className="text-lg font-semibold text-white mb-3">Technical Indicators</h3>
              <div className="grid grid-cols-2 gap-3">
                {Object.entries(data.technicals)
                  .filter(([key]) => !['score', 'maxScore'].includes(key))
                  .map(([key, value]) => (
                    <div key={key} className="p-3 rounded-lg bg-slate-800/50 border border-slate-700/50">
                      <p className="text-xs text-slate-400 mb-1">{key.toUpperCase()}</p>
                      <p className="text-sm font-bold text-white">
                        {typeof value === 'boolean' ? (value ? '✓' : '✗') : String(value)}
                      </p>
                    </div>
                  ))}
              </div>
            </section>
          )}

          {/* Fundamentals */}
          {data?.fundamentals && (
            <section>
              <h3 className="text-lg font-semibold text-white mb-3">Fundamental Metrics</h3>
              <div className="grid grid-cols-2 gap-3">
                {Object.entries(data.fundamentals)
                  .filter(([key]) => !['score', 'maxScore'].includes(key))
                  .map(([key, value]) => (
                    <div key={key} className="p-3 rounded-lg bg-slate-800/50 border border-slate-700/50">
                      <p className="text-xs text-slate-400 mb-1">{key.toUpperCase()}</p>
                      <p className="text-sm font-bold text-white">
                        {typeof value === 'number' ? value.toFixed(2) : String(value)}
                      </p>
                    </div>
                  ))}
              </div>
            </section>
          )}

          {/* Chart Patterns (All) */}
          {data?.chartPatterns && (
            <section>
              <h3 className="text-lg font-semibold text-white mb-3">Chart Patterns</h3>
              
              {/* Confirmed Patterns */}
              {data.chartPatterns.confirmed?.length > 0 && (
                <div className="mb-4">
                  <h4 className="text-sm font-medium text-emerald-400 mb-2">Confirmed Patterns</h4>
                  <div className="space-y-2">
                    {data.chartPatterns.confirmed.map((pattern: any, i: number) => (
                      <div key={i} className="p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/30">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-bold text-white">{pattern.name}</span>
                          <span className="text-xs px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400">
                            {pattern.confidence}%
                          </span>
                        </div>
                        <p className="text-xs text-emerald-300">{pattern.statusReason}</p>
                        {pattern.target && (
                          <div className="mt-2 flex gap-2 text-xs">
                            <span className="text-slate-400">Target: <span className="text-white">{pattern.target}</span></span>
                            {pattern.stopLoss && (
                              <span className="text-slate-400">Stop: <span className="text-white">{pattern.stopLoss}</span></span>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Forming Patterns */}
              {data.chartPatterns.forming?.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-amber-400 mb-2">Forming Patterns</h4>
                  <div className="space-y-2">
                    {data.chartPatterns.forming.map((pattern: any, i: number) => (
                      <div key={i} className="p-3 rounded-lg bg-amber-500/5 border border-amber-500/30">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-bold text-white">{pattern.name}</span>
                          <span className="text-xs px-2 py-0.5 rounded bg-amber-500/20 text-amber-400">
                            {pattern.confidence}%
                          </span>
                        </div>
                        <p className="text-xs text-amber-300">{pattern.statusReason}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>
          )}

          {/* News Headlines */}
          {data?.news?.headlines?.length > 0 && (
            <section>
              <h3 className="text-lg font-semibold text-white mb-3">Recent News</h3>
              <div className="space-y-2">
                {data.news.headlines.slice(0, 10).map((item: any, i: number) => (
                  <div key={i} className="p-3 rounded-lg bg-slate-800/50 border border-slate-700/50">
                    <p className="text-sm text-white mb-1">{item.headline}</p>
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      <span>{item.source}</span>
                      <span>•</span>
                      <span>{new Date(item.datetime).toLocaleDateString()}</span>
                      {item.sentiment && (
                        <>
                          <span>•</span>
                          <span className={
                            item.sentiment === 'POSITIVE' ? 'text-emerald-400' :
                            item.sentiment === 'NEGATIVE' ? 'text-red-400' :
                            'text-slate-400'
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
          )}

          {/* Analyst Ratings */}
          {data?.analysts && (
            <section>
              <h3 className="text-lg font-semibold text-white mb-3">Analyst Coverage</h3>
              <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/50 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Consensus:</span>
                  <span className={`font-bold ${
                    data.analysts.consensus === 'BUY' ? 'text-emerald-400' :
                    data.analysts.consensus === 'SELL' ? 'text-red-400' :
                    'text-slate-400'
                  }`}>{data.analysts.consensus}</span>
                </div>
                {data.analysts.targetPrice && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">Price Target:</span>
                    <span className="text-white">${data.analysts.targetPrice.toFixed(2)}</span>
                  </div>
                )}
                {data.analysts.count && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">Analysts Covering:</span>
                    <span className="text-white">{data.analysts.count}</span>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Insider Transactions */}
          {data?.insiders?.length > 0 && (
            <section>
              <h3 className="text-lg font-semibold text-white mb-3">Insider Activity</h3>
              <div className="space-y-2">
                {data.insiders.slice(0, 5).map((insider: any, i: number) => (
                  <div key={i} className="p-3 rounded-lg bg-slate-800/50 border border-slate-700/50">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-white">{insider.name}</span>
                      <span className={`text-xs px-2 py-0.5 rounded ${
                        insider.transactionType === 'BUY' ? 'bg-emerald-500/20 text-emerald-400' :
                        'bg-red-500/20 text-red-400'
                      }`}>
                        {insider.transactionType}
                      </span>
                    </div>
                    <div className="flex gap-4 text-xs text-slate-400">
                      <span>{insider.shares?.toLocaleString()} shares</span>
                      <span>${insider.value?.toLocaleString()}</span>
                      <span>{new Date(insider.date).toLocaleDateString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Data Sources */}
          <section>
            <h3 className="text-lg font-semibold text-white mb-3">Data Sources</h3>
            <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/50">
              <p className="text-sm text-slate-300 mb-2">This analysis is based on:</p>
              <ul className="text-xs text-slate-400 space-y-1">
                <li>• Schwab Market Data API (live quotes & options chains)</li>
                <li>• Technical indicator calculations (RSI, MACD, Moving Averages)</li>
                <li>• Chart pattern recognition algorithms</li>
                <li>• News sentiment analysis</li>
                <li>• Analyst consensus data</li>
                <li>• Insider transaction filings</li>
              </ul>
            </div>
          </section>

          {/* Limitations */}
          <section>
            <h3 className="text-lg font-semibold text-white mb-3">⚠️ Limitations</h3>
            <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/30">
              <ul className="text-xs text-amber-200 space-y-1">
                <li>• Past performance does not guarantee future results</li>
                <li>• Market conditions can change rapidly</li>
                <li>• Options carry significant risk and may expire worthless</li>
                <li>• This is not financial advice - do your own research</li>
                <li>• Data accuracy depends on source reliability</li>
                <li>• Technical indicators can give false signals</li>
              </ul>
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
