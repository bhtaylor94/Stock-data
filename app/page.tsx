'use client';

import React, { useCallback, useMemo, useState } from 'react';

import { AppShell, ViewKey } from './components/shell/AppShell';
import { SignalPanel } from './components/shell/SignalPanel';

import { StockAnalysisWrapper } from './components/stock/StockAnalysisWrapper';
import { OptionsAnalysisWrapper } from './components/options/OptionsAnalysisWrapper';
import { RealPortfolio } from './components/portfolio/RealPortfolio';
import { AlertManager } from './components/alerts/AlertManager';
import { BacktestRunner } from './components/backtest/BacktestRunner';
import { PortfolioGreeksDashboard } from './components/portfolio/PortfolioGreeksDashboard';
import { SuggestionFeed } from './components/ai-suggestions/SuggestionFeed';
import { EvidenceDrawer } from './components/core/EvidenceDrawer';

// ============================================================
// UI: Accuracy-first workspace
// - Desktop: sidebar + command panel + right signal stack
// - Mobile: top command + simplified bottom nav
// ============================================================

const QUICK_TICKERS: string[] = ['SPY', 'QQQ', 'AAPL', 'MSFT', 'NVDA', 'AMZN', 'META', 'TSLA', 'GOOGL', 'AMD'];

export default function HomePage() {
  const [active, setActive] = useState<ViewKey>('feed');
  const [ticker, setTicker] = useState<string>('SPY');
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const [evidenceData, setEvidenceData] = useState<any>(null);

  const onTickerSubmit = useCallback(() => {
    const t = String(ticker || '').trim().toUpperCase();
    if (!t) return;
    setTicker(t);
    // When a ticker is manually loaded, keep the user in their current view.
  }, [ticker]);

  const onQuickPick = useCallback((t: string) => {
    setTicker(String(t).toUpperCase());
  }, []);

  const rightPanel = useMemo(() => {
    return <SignalPanel ticker={ticker} />;
  }, [ticker]);

  const openEvidence = useCallback((data: any) => {
    setEvidenceData(data);
    setEvidenceOpen(true);
  }, []);

  const content = useMemo(() => {
    if (active === 'feed') {
      return (
        <div className="space-y-4">
          <div className="rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur-2xl p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs text-slate-400">Accuracy-first</div>
                <div className="text-xl font-bold text-white mt-0.5">AI Suggestion Feed</div>
                <div className="text-sm text-slate-400 mt-1">
                  The feed only surfaces ideas that clear quality gates (freshness + signal agreement + completeness).
                </div>
              </div>
              <button
                onClick={() => setActive('stock')}
                className="shrink-0 px-4 py-2 rounded-2xl bg-white/10 hover:bg-white/15 border border-white/10 text-sm font-semibold"
              >
                Deep dive →
              </button>
            </div>
          </div>

          <SuggestionFeed
            onSymbolSelect={(sym) => {
              setTicker(String(sym).toUpperCase());
              setActive('stock');
            }}
            onViewEvidence={(data) => openEvidence(data)}
          />
        </div>
      );
    }

    if (active === 'stock') {
      return (
        <div className="space-y-4">
          <StockAnalysisWrapper
            ticker={ticker}
            onViewEvidence={(data: any) => openEvidence(data)}
          />
        </div>
      );
    }

    if (active === 'options') {
      return (
        <div className="space-y-4">
          <OptionsAnalysisWrapper
            ticker={ticker}
            onViewEvidence={(data: any) => openEvidence(data)}
          />
        </div>
      );
    }

    if (active === 'tracker') {
      return (
        <div className="space-y-4">
          <RealPortfolio onAnalyze={(sym) => setTicker(sym)} />
        </div>
      );
    }

    if (active === 'alerts') {
      return (
        <div className="space-y-4">
		  <AlertManager />
        </div>
      );
    }

    if (active === 'backtest') {
      return (
        <div className="space-y-4">
		  <BacktestRunner />
        </div>
      );
    }

    if (active === 'greeks') {
      return (
        <div className="space-y-4">
          <PortfolioGreeksDashboard />
        </div>
      );
    }

    return null;
  }, [active, ticker, openEvidence]);

  return (
    <>
      <AppShell
        active={active}
        onNavigate={setActive}
        ticker={ticker}
        onTickerChange={setTicker}
        onTickerSubmit={onTickerSubmit}
        quickTickers={QUICK_TICKERS}
        onQuickPick={onQuickPick}
        rightPanel={rightPanel}
      >
        {content}
      </AppShell>

      <EvidenceDrawer
        isOpen={evidenceOpen}
        onClose={() => setEvidenceOpen(false)}
        data={evidenceData}
      />
    </>
  );
}
