import React from 'react';

function isEvidencePacket(v: any): boolean {
  return Boolean(v && typeof v === 'object' && typeof v.hash === 'string' && Array.isArray(v.checks));
}

function shortHash(hash: string): string {
  if (!hash) return '';
  return hash.length <= 12 ? hash : `${hash.slice(0, 6)}…${hash.slice(-6)}`;
}

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

  const packet =
    (isEvidencePacket(data) ? data : null) ||
    (isEvidencePacket(data?.meta?.evidencePacket) ? data.meta.evidencePacket : null) ||
    (isEvidencePacket(data?.evidencePacket) ? data.evidencePacket : null) ||
    null;

  // Back-compat: some callers store the full API response under evidencePacket.
  const root = isEvidencePacket(data) ? null : (data?.raw || data?.payload || data);
  const evidence = root?.meta?.evidence || root?.evidence || {};

  const handleCopy = async () => {
    try {
      const payloadToCopy = packet || root || data;
      await navigator.clipboard.writeText(JSON.stringify(payloadToCopy, null, 2));
    } catch {
      // Ignore clipboard errors (e.g., permissions)
    }
  };
  
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
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition"
              title="Copy evidence JSON"
            >
              Copy
            </button>
            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white transition"
            >
              ✕ Close
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Packet Summary (if available) */}
          {packet && (
            <section>
              <h3 className="text-lg font-semibold text-white mb-3">Audit Summary</h3>
              <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/50 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-sm">
                    <span className="text-slate-400">Hash:</span>{' '}
                    <span className="font-mono text-slate-200">{shortHash(packet.hash)}</span>
                  </div>
                  <div className="text-sm">
                    <span className="text-slate-400">Version:</span>{' '}
                    <span className="text-white">{packet.version}</span>
                    <span className="text-slate-500"> · </span>
                    <span className="text-slate-400">Source:</span>{' '}
                    <span className="text-white">{packet.source}</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {packet.checks.map((c: any, idx: number) => (
                    <div
                      key={idx}
                      className={`p-3 rounded-lg border ${c.pass ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-red-500/30 bg-red-500/5'}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm text-white font-medium">{c.name}</p>
                        <span className={`text-xs px-2 py-0.5 rounded ${c.pass ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                          {c.pass ? 'PASS' : 'FAIL'}
                        </span>
                      </div>
                      {c.details !== undefined && (
                        <p className="mt-1 text-xs text-slate-400 font-mono break-all">
                          {typeof c.details === 'string' ? c.details : JSON.stringify(c.details)}
                        </p>
                      )}
                    </div>
                  ))}
                </div>

                {Array.isArray(packet.notes) && packet.notes.length > 0 && (
                  <div className="pt-2 border-t border-slate-700/50">
                    {packet.notes.map((n: string, idx: number) => (
                      <p key={idx} className="text-xs text-amber-200">• {n}</p>
                    ))}
                  </div>
                )}
              </div>
            </section>
          )}
          {/* Meta Information */}
          {root?.meta && (
            <section>
              <h3 className="text-lg font-semibold text-white mb-3">Decision Context</h3>
              <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/50 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Timestamp:</span>
                  <span className="text-white">{new Date(root.meta.asOf).toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Regime:</span>
                  <span className="text-white">{root.meta.regime}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">ATR%:</span>
                  <span className="text-white">{root.meta.atrPct}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Trend Strength:</span>
                  <span className="text-white">{root.meta.trendStrength}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Response Time:</span>
                  <span className="text-emerald-400">{root.meta.responseTimeMs}ms</span>
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
          {root?.technicals && (
            <section>
              <h3 className="text-lg font-semibold text-white mb-3">Technical Indicators</h3>
              <div className="grid grid-cols-2 gap-3">
                {Object.entries(root.technicals)
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
          {root?.fundamentals && (
            <section>
              <h3 className="text-lg font-semibold text-white mb-3">Fundamental Metrics</h3>
              <div className="grid grid-cols-2 gap-3">
                {Object.entries(root.fundamentals)
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
          {root?.chartPatterns && (
            <section>
              <h3 className="text-lg font-semibold text-white mb-3">Chart Patterns</h3>
              
              {/* Confirmed Patterns */}
              {root.chartPatterns.confirmed?.length > 0 && (
                <div className="mb-4">
                  <h4 className="text-sm font-medium text-emerald-400 mb-2">Confirmed Patterns</h4>
                  <div className="space-y-2">
                    {root.chartPatterns.confirmed.map((pattern: any, i: number) => (
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
              {root.chartPatterns.forming?.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-amber-400 mb-2">Forming Patterns</h4>
                  <div className="space-y-2">
                    {root.chartPatterns.forming.map((pattern: any, i: number) => (
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
          {root?.news?.headlines?.length > 0 && (
            <section>
              <h3 className="text-lg font-semibold text-white mb-3">Recent News</h3>
              <div className="space-y-2">
                {root.news.headlines.slice(0, 10).map((item: any, i: number) => (
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
          {root?.analysts && (
            <section>
              <h3 className="text-lg font-semibold text-white mb-3">Analyst Coverage</h3>
              <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/50 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Consensus:</span>
                  <span className={`font-bold ${
                    root.analysts.consensus === 'BUY' ? 'text-emerald-400' :
                    root.analysts.consensus === 'SELL' ? 'text-red-400' :
                    'text-slate-400'
                  }`}>{root.analysts.consensus}</span>
                </div>
                {root.analysts.targetPrice && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">Price Target:</span>
                    <span className="text-white">${root.analysts.targetPrice.toFixed(2)}</span>
                  </div>
                )}
                {root.analysts.count && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">Analysts Covering:</span>
                    <span className="text-white">{root.analysts.count}</span>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Insider Transactions */}
          {(Array.isArray(root?.insiders) ? root.insiders.length > 0 : (root?.insiders?.recentTransactions?.length > 0)) && (
            <section>
              <h3 className="text-lg font-semibold text-white mb-3">Insider Activity</h3>
              <div className="space-y-2">
                {(Array.isArray(root.insiders) ? root.insiders : (root.insiders.recentTransactions || [])).slice(0, 5).map((insider: any, i: number) => (
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
