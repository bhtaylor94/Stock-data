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
  
  // Error boundary - catch any rendering errors
  try {
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
            {/* Safe rendering with try-catch for each section */}
            {renderSafeContent(data, onClose)}
          </div>
        </div>
      </>
    );
  } catch (error) {
    console.error('Evidence Drawer Critical Error:', error);
    return (
      <>
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40" onClick={onClose} />
        <div className="fixed right-0 top-0 bottom-0 w-full max-w-2xl bg-slate-900 border-l border-slate-700 z-50 overflow-y-auto">
          <div className="p-6">
            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30">
              <p className="text-red-400 font-semibold mb-2">Unable to Display Evidence</p>
              <p className="text-sm text-slate-400">Click the X to close and try refreshing the page.</p>
            </div>
          </div>
        </div>
      </>
    );
  }
}

function renderSafeContent(data: any, onClose: () => void) {
  const sections: React.ReactNode[] = [];
  
  // Only show basic info if no data
  if (!data) {
    sections.push(
      <div key="no-data" className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/50">
        <p className="text-slate-400">No evidence data available</p>
      </div>
    );
    return sections;
  }
  
  // Audit Summary
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
                <span>Source: {data.dataSource || 'stock'}</span>
              </div>
              <div className="text-xs text-emerald-400">✓ {new Date().toLocaleString()}</div>
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center justify-between p-2 rounded bg-slate-800/50">
                <div>
                  <p className="text-sm font-medium text-white">Data Freshness</p>
                  <p className="text-xs text-slate-400">{data.meta?.isStale ? 'Stale' : 'Fresh'}</p>
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
            </div>
          </div>
        </section>
      );
    }
  } catch (e) {
    console.error('Audit render error', e);
  }
  
  // Chart Patterns Validation
  try {
    if (data?.chartPatterns && (data.chartPatterns.confirmed?.length > 0 || data.chartPatterns.forming?.length > 0)) {
      sections.push(
        <section key="patterns">
          <h3 className="text-lg font-semibold text-white mb-3">📈 Chart Pattern Validation</h3>
          <div className="p-4 rounded-xl bg-blue-500/5 border border-blue-500/30 space-y-3">
            <div className="p-3 rounded-lg bg-slate-800/50">
              <p className="text-xs text-slate-400 mb-1">Pattern Detection Trust Level</p>
              <p className="text-sm font-bold text-emerald-400">
                {data.verification?.patternTrust?.trustLevel || 'Unknown'}
              </p>
            </div>
            
            {data.chartPatterns.confirmed && data.chartPatterns.confirmed.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-emerald-400 mb-2">✓ Confirmed Patterns</h4>
                {data.chartPatterns.confirmed.map((pattern: any, i: number) => (
                  <div key={i} className="p-3 mb-2 rounded-lg bg-emerald-500/5 border border-emerald-500/30">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white">{pattern?.name || 'Pattern'}</span>
                      <span className="text-xs px-2 py-1 rounded bg-emerald-500/20 text-emerald-400 font-bold">
                        {pattern?.result?.confidence || pattern?.confidence || 0}%
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 mt-2">{pattern?.statusReason || 'Confirmed pattern'}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      );
    }
  } catch (e) {
    console.error('Pattern render error', e);
  }
  
  // Meta Information
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
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Regime:</span>
                <span className="text-white">{data.meta.regime}</span>
              </div>
            )}
          </div>
        </section>
      );
    }
  } catch (e) {
    console.error('Meta render error', e);
  }
  
  // News Headlines
  try {
    if (data?.news?.headlines?.length > 0) {
      sections.push(
        <section key="news">
          <h3 className="text-lg font-semibold text-white mb-3">Recent News</h3>
          <div className="space-y-2">
            {data.news.headlines.slice(0, 10).map((item: any, i: number) => (
              <div key={i} className="p-3 rounded-lg bg-slate-800/50 border border-slate-700/50">
                <p className="text-sm text-white mb-1">{item.headline}</p>
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <span>{item.source}</span>
                  <span>•</span>
                  <span>{new Date(item.datetime).toLocaleDateString()}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      );
    }
  } catch (e) {
    console.error('News render error', e);
  }
  
  // Limitations
  sections.push(
    <section key="limitations">
      <h3 className="text-lg font-semibold text-white mb-3">⚠️ Limitations</h3>
      <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/30">
        <ul className="text-xs text-amber-200 space-y-1">
          <li>• Past performance does not guarantee future results</li>
          <li>• This is not financial advice - do your own research</li>
          <li>• Data accuracy depends on source reliability</li>
        </ul>
      </div>
    </section>
  );
  
  return sections;
}
