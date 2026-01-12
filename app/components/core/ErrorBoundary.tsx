'use client';

import React, { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="space-y-4 animate-fade-in p-6">
          <div className="p-6 rounded-2xl border border-red-500/30 bg-red-500/5">
            <h3 className="text-lg font-semibold text-red-400 mb-3">⚠️ Unable to Load Content</h3>
            <p className="text-sm text-red-300 mb-3">
              An error occurred while loading this section. This could be due to:
            </p>
            <ul className="text-xs text-slate-400 space-y-1 mb-3">
              <li>• Market is currently closed</li>
              <li>• This ticker may not have options available</li>
              <li>• Temporary data format issue</li>
            </ul>
          </div>
          
          <div className="p-4 rounded-xl bg-blue-500/5 border border-blue-500/30">
            <p className="text-sm text-blue-300 mb-2">💡 What you can do:</p>
            <ul className="text-xs text-slate-400 space-y-1">
              <li>• Switch to the <strong className="text-white">Stock Analysis</strong> tab (works anytime)</li>
              <li>• Switch to the <strong className="text-white">Portfolio</strong> tab to view tracked positions</li>
              <li>• Try a different ticker: <strong className="text-white">AAPL, TSLA, NVDA, SPY</strong></li>
              <li>• Wait for market hours (9:30 AM - 4:00 PM ET) and refresh</li>
            </ul>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
