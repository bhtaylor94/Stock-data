'use client';

import React, { useState } from 'react';

export function InfoTooltip({ term, definition }: { term: string; definition: string }) {
  const [show, setShow] = useState(false);

  return (
    <span className="relative inline-block ml-1">
      <button
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        onClick={() => setShow(!show)}
        className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 transition-colors cursor-help"
        aria-label={`Information about ${term}`}
      >
        <span className="text-[10px] font-bold">i</span>
      </button>
      
      {show && (
        <div className="absolute z-50 bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-64 p-3 rounded-lg bg-slate-800 border border-slate-700 shadow-xl">
          <div className="text-xs">
            <p className="font-semibold text-white mb-1">{term}</p>
            <p className="text-slate-300 leading-relaxed">{definition}</p>
          </div>
          {/* Arrow */}
          <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-px">
            <div className="border-4 border-transparent border-t-slate-800"></div>
          </div>
        </div>
      )}
    </span>
  );
}

// Common term definitions
export const DEFINITIONS = {
  // Options Greeks
  delta: "Measures how much an option's price changes for every $1 move in the underlying stock. Values range from 0 to 1 for calls, -1 to 0 for puts.",
  gamma: "Measures the rate of change in delta. High gamma means delta changes quickly as the stock price moves.",
  theta: "Measures time decay - how much value an option loses each day. Always negative for long positions.",
  vega: "Measures sensitivity to volatility. High vega means the option price is very sensitive to changes in implied volatility.",
  
  // Technical Indicators
  rsi: "Relative Strength Index - Measures momentum on a scale of 0-100. Below 30 is oversold, above 70 is overbought.",
  macd: "Moving Average Convergence Divergence - Shows the relationship between two moving averages. Positive values suggest upward momentum.",
  ema: "Exponential Moving Average - A moving average that gives more weight to recent prices. Used to identify trends.",
  sma: "Simple Moving Average - The average price over a specific period. Used to smooth out price action and identify trends.",
  
  // Options Metrics
  dte: "Days To Expiration - How many calendar days until the option expires. Options lose value faster as DTE decreases.",
  iv: "Implied Volatility - The market's expectation of future price movement. Higher IV means options are more expensive.",
  oi: "Open Interest - The total number of outstanding option contracts. High OI suggests liquidity.",
  volume: "The number of contracts traded today. High volume relative to OI suggests unusual activity.",
  
  // Fundamentals
  pe: "Price-to-Earnings Ratio - Stock price divided by earnings per share. Lower values may indicate undervaluation.",
  roe: "Return on Equity - Measures profitability relative to shareholder equity. Higher is better.",
  eps: "Earnings Per Share - Company profit divided by number of shares. Higher values indicate more profit per share.",
  
  // Chart Patterns
  support: "A price level where buying pressure has historically prevented further decline.",
  resistance: "A price level where selling pressure has historically prevented further gains.",
  breakout: "When price moves above resistance (bullish) or below support (bearish) with strong volume.",
  
  // Market Regime
  atr: "Average True Range - Measures volatility. Higher ATR means bigger price swings.",
  regime: "Current market condition - TREND (directional), RANGE (sideways), or HIGH_VOL (choppy).",
  trendStrength: "Measures how strong the current trend is. Higher values indicate stronger trends.",
};
