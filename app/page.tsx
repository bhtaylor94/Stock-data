'use client';
import React, { useState, useEffect, useRef } from 'react';

// Components
import { StockAnalysisWrapper } from './components/stock/StockAnalysisWrapper';
import { OptionsAnalysisWrapper } from './components/options/OptionsAnalysisWrapper';
import { EvidenceDrawer } from './components/core/EvidenceDrawer';
import { RealPortfolio } from './components/portfolio/RealPortfolio';
import { OrderModal } from './components/trading/OrderModal';
import { AlertManager } from './components/alerts/AlertManager';
import { BacktestRunner } from './components/backtest/BacktestRunner';
import { PortfolioGreeksDashboard } from './components/portfolio/PortfolioGreeksDashboard';
import { SuggestionFeed } from './components/ai-suggestions/SuggestionFeed';

// ============================================================
// TYPES
// ============================================================

type TabType = 'feed' | 'stock' | 'options' | 'tracker' | 'alerts' | 'backtest' | 'greeks';

interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
}

interface AlertNotification {
  id: string;
  symbol: string;
  condition: string;
  message: string;
  timestamp: number;
}

// ============================================================
// MODERN UI COMPONENTS
// ============================================================

function ModernToast({ toast, onDismiss }: { toast: ToastMessage; onDismiss: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 4000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  const bgColors = {
    success: 'from-emerald-500/90 to-green-600/90',
    error: 'from-rose-500/90 to-red-600/90',
    info: 'from-blue-500/90 to-indigo-600/90',
  };

  return (
    <div className="animate-slide-up">
      <div className={`px-5 py-4 rounded-2xl bg-gradient-to-r ${bgColors[toast.type]} backdrop-blur-xl border border-white/20 shadow-2xl`}>
        <div className="flex items-center gap-3">
          <span className="text-2xl">
            {toast.type === 'success' && '✓'}
            {toast.type === 'error' && '⚠️'}
            {toast.type === 'info' && 'ℹ️'}
          </span>
          <span className="font-semibold text-white">{toast.message}</span>
          <button 
            onClick={onDismiss}
            className="ml-auto p-1 hover:bg-white/20 rounded-lg transition"
          >
            <span className="text-white">✕</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function AlertBanner({ alert, onDismiss }: { alert: AlertNotification; onDismiss: () => void }) {
  return (
    <div className="animate-bounce-in">
      <div className="p-4 rounded-2xl bg-gradient-to-r from-orange-500/20 to-amber-500/20 backdrop-blur-xl border border-orange-400/30 shadow-2xl">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 text-3xl animate-pulse">🔔</div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-white text-lg">{alert.symbol} Alert!</p>
            <p className="text-sm text-slate-200 mt-1">{alert.message}</p>
            <p className="text-xs text-slate-400 mt-2">{alert.condition}</p>
          </div>
          <button
            onClick={onDismiss}
            className="flex-shrink-0 p-2 hover:bg-white/10 rounded-lg transition"
          >
            <span className="text-white">✕</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function FloatingSearchBar({ 
  value, 
  onChange, 
  onSearch 
}: { 
  value: string; 
  onChange: (v: string) => void; 
  onSearch: () => void;
}) {
  return (
    <div className="relative">
      <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-2xl blur-xl" />
      <div className="relative px-4 py-3 rounded-2xl bg-white/5 backdrop-blur-2xl border border-white/10 shadow-2xl">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🔍</span>
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === 'Enter' && onSearch()}
            placeholder="Search ticker..."
            className="flex-1 bg-transparent text-white placeholder-slate-400 outline-none text-lg font-medium"
            autoCapitalize="characters"
          />
          {value && (
            <>
              <button
                onClick={() => onChange('')}
                className="p-2 hover:bg-white/10 rounded-lg transition"
              >
                <span className="text-slate-400">✕</span>
              </button>
              <button
                onClick={onSearch}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-500 to-purple-500 text-white font-semibold hover:shadow-lg hover:shadow-blue-500/50 transition"
              >
                Go
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function BottomNavBar({ activeTab, onTabChange }: { activeTab: TabType; onTabChange: (tab: TabType) => void }) {
  const tabs = [
    { id: 'feed' as TabType, icon: '🎯', label: 'Feed', gradient: 'from-blue-500 to-cyan-500' },
    { id: 'stock' as TabType, icon: '📈', label: 'Stock', gradient: 'from-green-500 to-emerald-500' },
    { id: 'options' as TabType, icon: '⚡', label: 'Options', gradient: 'from-purple-500 to-pink-500' },
    { id: 'tracker' as TabType, icon: '📊', label: 'Track', gradient: 'from-orange-500 to-red-500' },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 pb-safe">
      {/* Blur background */}
      <div className="absolute inset-0 bg-slate-900/95 backdrop-blur-2xl border-t border-white/10" />
      
      {/* Nav items */}
      <div className="relative px-4 py-3">
        <div className="flex items-center justify-around max-w-2xl mx-auto">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className="flex flex-col items-center gap-1 transition-all duration-300 min-w-0 flex-1"
              >
                <div className={`
                  relative px-6 py-2.5 rounded-2xl transition-all duration-300
                  ${isActive 
                    ? 'bg-gradient-to-r ' + tab.gradient + ' shadow-lg' 
                    : 'bg-white/5 hover:bg-white/10'
                  }
                `}>
                  {isActive && (
                    <div className={`absolute inset-0 bg-gradient-to-r ${tab.gradient} rounded-2xl blur-xl opacity-50`} />
                  )}
                  <span className={`relative text-2xl ${isActive ? 'scale-110' : 'scale-100'} transition-transform`}>
                    {tab.icon}
                  </span>
                </div>
                <span className={`
                  text-xs font-semibold transition-all duration-300
                  ${isActive ? 'text-white' : 'text-slate-400'}
                `}>
                  {tab.label}
                </span>
              </button>
            );
          })}
          
          {/* More menu */}
          <div className="relative">
            <button
              onClick={() => onTabChange('alerts')}
              className="flex flex-col items-center gap-1"
            >
              <div className={`
                relative px-6 py-2.5 rounded-2xl transition-all duration-300
                ${['alerts', 'backtest', 'greeks'].includes(activeTab)
                  ? 'bg-gradient-to-r from-slate-600 to-slate-700 shadow-lg' 
                  : 'bg-white/5 hover:bg-white/10'
                }
              `}>
                <span className="text-2xl">⋯</span>
              </div>
              <span className="text-xs font-semibold text-slate-400">More</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function MoreMenu({ 
  activeTab, 
  onTabChange, 
  onClose 
}: { 
  activeTab: TabType; 
  onTabChange: (tab: TabType) => void;
  onClose: () => void;
}) {
  const moreItems = [
    { id: 'alerts' as TabType, icon: '🔔', label: 'Alerts', desc: 'Price & Greeks notifications' },
    { id: 'backtest' as TabType, icon: '⏮️', label: 'Backtest', desc: 'Strategy performance' },
    { id: 'greeks' as TabType, icon: '🎲', label: 'Greeks', desc: 'Portfolio risk metrics' },
  ];

  return (
    <div 
      className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div 
        className="fixed bottom-20 left-4 right-4 max-w-md mx-auto animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 rounded-3xl bg-slate-900/95 backdrop-blur-2xl border border-white/10 shadow-2xl">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold text-white">More Tools</h3>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/10 rounded-xl transition"
            >
              <span className="text-slate-400">✕</span>
            </button>
          </div>
          
          <div className="space-y-3">
            {moreItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    onTabChange(item.id);
                    onClose();
                  }}
                  className={`
                    w-full p-4 rounded-2xl transition-all text-left
                    ${isActive 
                      ? 'bg-gradient-to-r from-blue-500/20 to-purple-500/20 border border-blue-400/30' 
                      : 'bg-white/5 border border-white/10 hover:bg-white/10'
                    }
                  `}
                >
                  <div className="flex items-center gap-4">
                    <span className="text-3xl">{item.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-white">{item.label}</p>
                      <p className="text-sm text-slate-400">{item.desc}</p>
                    </div>
                    {isActive && (
                      <span className="text-blue-400">✓</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function PageHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-6">
      <h1 className="text-3xl font-bold text-white mb-2">{title}</h1>
      {subtitle && <p className="text-slate-400">{subtitle}</p>}
    </div>
  );
}

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="relative">
        <div className="w-12 h-12 rounded-full border-4 border-slate-700 border-t-blue-500 animate-spin" />
        <div className="absolute inset-0 w-12 h-12 rounded-full bg-blue-500/20 blur-xl animate-pulse" />
      </div>
    </div>
  );
}

// ============================================================
// TRACKER TAB
// ============================================================

function ModernTrackerTab({ 
  onViewEvidence,
  onSymbolSelect,
  onTrade
}: { 
  onViewEvidence?: (data: any) => void;
  onSymbolSelect?: (symbol: string) => void;
  onTrade?: (symbol: string, price: number, action: 'BUY' | 'SELL' | 'HOLD', quantity: number) => void;
}) {
  const [trackerData, setTrackerData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showRealPortfolio, setShowRealPortfolio] = useState(false);
  
  const fetchTrackerData = async () => {
    try {
      const res = await fetch('/api/tracker');
      const data = await res.json();
      setTrackerData(data);
    } catch (err) {
      console.error('Tracker fetch error:', err);
    }
    setLoading(false);
  };
  
  useEffect(() => {
    fetchTrackerData();
    const interval = setInterval(fetchTrackerData, 15000);
    return () => clearInterval(interval);
  }, []);
  
  if (loading) return <LoadingSpinner />;
  
  if (showRealPortfolio) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => setShowRealPortfolio(false)}
          className="w-full p-4 rounded-2xl bg-gradient-to-r from-blue-500/20 to-purple-500/20 border border-blue-400/30 text-white font-semibold hover:shadow-lg transition"
        >
          ← Back to Paper Trading
        </button>
        <RealPortfolio 
          onAnalyze={(symbol) => onSymbolSelect?.(symbol)}
          onTrade={(symbol, price, action, quantity) => onTrade?.(symbol, price, action, quantity)}
        />
      </div>
    );
  }

  const suggestions = trackerData?.suggestions || [];
  const stats = trackerData?.stats || {};

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Position Tracker"
        subtitle="Monitor your paper trading positions"
      />

      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-3">
        <div className="p-4 rounded-2xl bg-gradient-to-br from-green-500/10 to-emerald-500/10 border border-green-400/20">
          <p className="text-sm text-slate-400 mb-1">Win Rate</p>
          <p className="text-2xl font-bold text-white">{stats.winRate || 0}%</p>
        </div>
        <div className="p-4 rounded-2xl bg-gradient-to-br from-blue-500/10 to-purple-500/10 border border-blue-400/20">
          <p className="text-sm text-slate-400 mb-1">Total P&L</p>
          <p className={`text-2xl font-bold ${(stats.totalPnl || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            ${stats.totalPnl?.toFixed(2) || '0.00'}
          </p>
        </div>
      </div>

      {/* Toggle to Real Portfolio */}
      <button
        onClick={() => setShowRealPortfolio(true)}
        className="w-full p-4 rounded-2xl bg-gradient-to-r from-orange-500/20 to-red-500/20 border border-orange-400/30 text-white font-semibold hover:shadow-lg transition"
      >
        🔗 View Schwab Portfolio
      </button>

      {/* Positions */}
      <div className="space-y-3">
        {suggestions.map((pos: any) => (
          <div 
            key={pos.id}
            className="p-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition"
          >
            <div className="flex items-center justify-between mb-2">
              <div>
                <p className="font-bold text-white text-lg">{pos.ticker}</p>
                <p className="text-sm text-slate-400">{pos.type}</p>
              </div>
              <div className="text-right">
                <p className={`text-lg font-bold ${(pos.pnl || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {(pos.pnl || 0) >= 0 ? '+' : ''}{pos.pnl?.toFixed(2) || '0.00'}%
                </p>
                <p className="text-xs text-slate-400">${pos.entryPrice?.toFixed(2)}</p>
              </div>
            </div>
            
            {pos.reasoning && pos.reasoning.length > 0 && (
              <div className="mt-3 space-y-1">
                {pos.reasoning.slice(0, 2).map((reason: string, i: number) => (
                  <p key={i} className="text-xs text-slate-400">• {reason}</p>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// MAIN APP COMPONENT
// ============================================================

export default function ModernAIHedgeFund() {
  const [activeTab, setActiveTab] = useState<TabType>('feed');
  const [ticker, setTicker] = useState('');
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [alerts, setAlerts] = useState<AlertNotification[]>([]);
  const [showEvidence, setShowEvidence] = useState(false);
  const [evidenceData, setEvidenceData] = useState<any>(null);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [orderData, setOrderData] = useState<any>(null);

  // Alert polling (60 seconds)
  useEffect(() => {
    const checkAlerts = async () => {
      try {
        const res = await fetch('/api/alerts/check');
        const data = await res.json();
        
        if (data.alerts && data.alerts.length > 0) {
          const newAlerts = data.alerts.map((alert: any, idx: number) => ({
            id: `${Date.now()}-${idx}`,
            symbol: alert.symbol,
            condition: alert.condition,
            message: alert.message,
            timestamp: Date.now(),
          }));
          
          setAlerts(prev => [...prev, ...newAlerts]);
          
          // Browser notifications
          if ('Notification' in window && Notification.permission === 'granted') {
            data.alerts.forEach((alert: any) => {
              new Notification('🔔 Trade Alert!', {
                body: `${alert.symbol}: ${alert.condition}`,
                icon: '/favicon.ico',
              });
            });
          }
        }
      } catch (error) {
        console.error('Failed to check alerts:', error);
      }
    };

    // Request notification permission
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    checkAlerts();
    const interval = setInterval(checkAlerts, 60000);
    return () => clearInterval(interval);
  }, []);

  const addToast = (type: 'success' | 'error' | 'info', message: string) => {
    const id = Date.now().toString();
    setToasts(prev => [...prev, { id, type, message }]);
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  const removeAlert = (id: string) => {
    setAlerts(prev => prev.filter(a => a.id !== id));
  };

  const handleSearch = () => {
    if (ticker) {
      setActiveTab('stock');
    }
  };

  const handleTabChange = (tab: TabType) => {
    if (tab === 'alerts' && !['alerts', 'backtest', 'greeks'].includes(activeTab)) {
      setShowMoreMenu(true);
    } else {
      setActiveTab(tab);
      setShowMoreMenu(false);
    }
  };

  const handleViewEvidence = (data: any) => {
    setEvidenceData(data);
    setShowEvidence(true);
  };

  const handleTrade = (symbol: string, price: number, action: 'BUY' | 'SELL' | 'HOLD', quantity: number) => {
    setOrderData({ symbol, price, action, quantity });
    setShowOrderModal(true);
  };

  const handleOrderSuccess = (message: string) => {
    addToast('success', message);
    setShowOrderModal(false);
  };

  const handleOrderError = (message: string) => {
    addToast('error', message);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white relative overflow-hidden">
      {/* Animated background elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 -left-20 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-pulse delay-1000" />
      </div>

      {/* Main content */}
      <div className="relative z-10 px-4 pt-6 pb-32 max-w-2xl mx-auto">
        {/* Search bar (always visible) */}
        <div className="mb-6">
          <FloatingSearchBar 
            value={ticker}
            onChange={setTicker}
            onSearch={handleSearch}
          />
        </div>

        {/* Tab content */}
        <div className="space-y-6">
          {activeTab === 'feed' && (
            <div>
              <PageHeader 
                title="AI Feed"
                subtitle="Real-time market opportunities"
              />
              <SuggestionFeed 
                onSymbolSelect={(symbol) => {
                  setTicker(symbol);
                  setActiveTab('stock');
                }}
                onViewEvidence={handleViewEvidence}
                onTrack={(success, message) => {
                  addToast(success ? 'success' : 'error', message);
                }}
              />
            </div>
          )}

          {activeTab === 'stock' && (
            <div>
              <PageHeader 
                title="Stock Analysis"
                subtitle={ticker || 'Enter a ticker to begin'}
              />
              <StockAnalysisWrapper 
                ticker={ticker}
                onViewEvidence={handleViewEvidence}
              />
            </div>
          )}

          {activeTab === 'options' && (
            <div>
              <PageHeader 
                title="Options Analysis"
                subtitle={ticker || 'Enter a ticker to begin'}
              />
              <OptionsAnalysisWrapper 
                ticker={ticker}
                onViewEvidence={handleViewEvidence}
              />
            </div>
          )}

          {activeTab === 'tracker' && (
            <ModernTrackerTab 
              onViewEvidence={handleViewEvidence}
              onSymbolSelect={(symbol) => {
                setTicker(symbol);
                setActiveTab('stock');
              }}
              onTrade={handleTrade}
            />
          )}

          {activeTab === 'alerts' && (
            <div>
              <PageHeader 
                title="Alert Manager"
                subtitle="Set price and Greeks alerts"
              />
              <AlertManager />
            </div>
          )}

          {activeTab === 'backtest' && (
            <div>
              <PageHeader 
                title="Backtest"
                subtitle="Test strategies on historical data"
              />
              <BacktestRunner />
            </div>
          )}

          {activeTab === 'greeks' && (
            <div>
              <PageHeader 
                title="Portfolio Greeks"
                subtitle="Monitor your options risk"
              />
              <PortfolioGreeksDashboard />
            </div>
          )}
        </div>
      </div>

      {/* Bottom Navigation */}
      <BottomNavBar activeTab={activeTab} onTabChange={handleTabChange} />

      {/* More Menu */}
      {showMoreMenu && (
        <MoreMenu 
          activeTab={activeTab}
          onTabChange={handleTabChange}
          onClose={() => setShowMoreMenu(false)}
        />
      )}

      {/* Toasts */}
      <div className="fixed top-4 right-4 z-[70] space-y-3 max-w-sm">
        {toasts.map((toast) => (
          <ModernToast 
            key={toast.id}
            toast={toast}
            onDismiss={() => removeToast(toast.id)}
          />
        ))}
      </div>

      {/* Alert Banners */}
      <div className="fixed top-20 left-4 right-4 z-[70] space-y-3 max-w-md mx-auto">
        {alerts.map((alert) => (
          <AlertBanner 
            key={alert.id}
            alert={alert}
            onDismiss={() => removeAlert(alert.id)}
          />
        ))}
      </div>

      {/* Evidence Drawer */}
      {showEvidence && evidenceData && (
        <EvidenceDrawer 
          isOpen={showEvidence}
          onClose={() => setShowEvidence(false)}
          data={evidenceData}
        />
      )}

      {/* Order Modal */}
      {showOrderModal && orderData && (
        <OrderModal 
          isOpen={showOrderModal}
          onClose={() => setShowOrderModal(false)}
          symbol={orderData.symbol}
          action={orderData.action}
          initialPrice={orderData.price}
          onSuccess={handleOrderSuccess}
          onError={handleOrderError}
        />
      )}
    </div>
  );
}
