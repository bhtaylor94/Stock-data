'use client';

import React, { useState } from 'react';

export function InfoTooltip({ term, definition }: { term: string; definition: string }) {
  const [show, setShow] = useState(false);
  const [position, setPosition] = useState<'top' | 'left' | 'right'>('top');
  const buttonRef = React.useRef<HTMLButtonElement>(null);

  const updatePosition = () => {
    if (!buttonRef.current) return;
    
    const rect = buttonRef.current.getBoundingClientRect();
    const tooltipWidth = 256; // w-64 = 256px
    const tooltipHeight = 100; // approximate
    
    // Check if tooltip would go off right edge
    if (rect.right + tooltipWidth/2 > window.innerWidth) {
      setPosition('left');
    }
    // Check if tooltip would go off left edge
    else if (rect.left - tooltipWidth/2 < 0) {
      setPosition('right');
    }
    // Check if not enough space on top
    else if (rect.top < tooltipHeight) {
      setPosition('top'); // Will show below
    }
    else {
      setPosition('top');
    }
  };

  const handleShow = () => {
    updatePosition();
    setShow(true);
  };

  // Position classes based on calculated position
  const getPositionClasses = () => {
    switch(position) {
      case 'left':
        return 'bottom-0 right-full mr-2 transform translate-y-1/2';
      case 'right':
        return 'bottom-0 left-full ml-2 transform translate-y-1/2';
      default:
        return 'bottom-full left-1/2 transform -translate-x-1/2 mb-2';
    }
  };

  const getArrowClasses = () => {
    switch(position) {
      case 'left':
        return 'absolute left-full top-1/2 transform -translate-y-1/2 -ml-px';
      case 'right':
        return 'absolute right-full top-1/2 transform -translate-y-1/2 -mr-px';
      default:
        return 'absolute top-full left-1/2 transform -translate-x-1/2 -mt-px';
    }
  };

  const getArrowBorder = () => {
    switch(position) {
      case 'left':
        return 'border-4 border-transparent border-l-slate-800';
      case 'right':
        return 'border-4 border-transparent border-r-slate-800';
      default:
        return 'border-4 border-transparent border-t-slate-800';
    }
  };

  return (
    <span className="relative inline-block ml-1">
      <button
        ref={buttonRef}
        onMouseEnter={handleShow}
        onMouseLeave={() => setShow(false)}
        onClick={() => {
          if (show) {
            setShow(false);
          } else {
            handleShow();
          }
        }}
        className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 transition-colors cursor-help"
        aria-label={`Information about ${term}`}
      >
        <span className="text-[10px] font-bold">i</span>
      </button>
      
      {show && (
        <div className={`absolute z-50 w-64 p-3 rounded-lg bg-slate-800 border border-slate-700 shadow-xl ${getPositionClasses()}`}>
          <div className="text-xs">
            <p className="font-semibold text-white mb-1">{term}</p>
            <p className="text-slate-300 leading-relaxed">{definition}</p>
          </div>
          {/* Arrow */}
          <div className={getArrowClasses()}>
            <div className={getArrowBorder()}></div>
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
  
  // Technical Indicators - Moving Averages
  rsi: "Relative Strength Index - Measures momentum on a scale of 0-100. Below 30 is oversold, above 70 is overbought.",
  macd: "Moving Average Convergence Divergence - Shows the relationship between two moving averages. Positive values suggest upward momentum.",
  ema: "Exponential Moving Average - A moving average that gives more weight to recent prices. Used to identify trends.",
  sma: "Simple Moving Average - The average price over a specific period. Used to smooth out price action and identify trends.",
  ema12: "12-period Exponential Moving Average - Short-term trend indicator. Price above EMA12 suggests short-term uptrend.",
  ema26: "26-period Exponential Moving Average - Medium-term trend indicator. Used with EMA12 to calculate MACD.",
  sma20: "20-period Simple Moving Average - Common short-term trend indicator. Often used as dynamic support/resistance.",
  sma50: "50-period Simple Moving Average - Medium-term trend indicator. Key level watched by traders.",
  sma200: "200-period Simple Moving Average - Long-term trend indicator. Price above SMA200 is considered bullish.",
  
  // Technical Indicators - Advanced
  bollinger: "Bollinger Bands - Volatility bands placed above and below a moving average. Price at upper band suggests overbought, at lower band suggests oversold.",
  bollingerbands: "Bollinger Bands - Volatility bands placed above and below a moving average. Price at upper band suggests overbought, at lower band suggests oversold.",
  goldencross: "Golden Cross - Bullish signal when a short-term moving average (like 50-day) crosses above a long-term moving average (like 200-day).",
  deathcross: "Death Cross - Bearish signal when a short-term moving average crosses below a long-term moving average.",
  
  // Options Metrics
  dte: "Days To Expiration - How many calendar days until the option expires. Options lose value faster as DTE decreases.",
  iv: "Implied Volatility - The market's expectation of future price movement. Higher IV means options are more expensive.",
  oi: "Open Interest - The total number of outstanding option contracts. High OI suggests liquidity.",
  volume: "The number of contracts/shares traded today. High volume relative to OI suggests unusual activity.",
  
  // Fundamentals - Valuation
  pe: "Price-to-Earnings Ratio - Stock price divided by earnings per share. Lower values may indicate undervaluation relative to earnings.",
  pb: "Price-to-Book Ratio - Stock price divided by book value per share. Lower values may indicate undervaluation relative to assets.",
  ps: "Price-to-Sales Ratio - Market cap divided by total revenue. Lower values may indicate undervaluation relative to sales.",
  peg: "PEG Ratio - P/E ratio divided by earnings growth rate. Values under 1 may indicate undervaluation considering growth.",
  
  // Fundamentals - Profitability
  roe: "Return on Equity - Measures profitability relative to shareholder equity. Higher is better. Good companies typically have ROE > 15%.",
  roa: "Return on Assets - Measures how efficiently a company uses its assets to generate profit. Higher is better.",
  eps: "Earnings Per Share - Company profit divided by number of shares. Higher values indicate more profit per share.",
  grossmargin: "Gross Margin - Revenue minus cost of goods sold, as a percentage. Higher margins suggest pricing power.",
  profitmargin: "Profit Margin - Net income as a percentage of revenue. Shows what percentage of sales become profit.",
  operatingmargin: "Operating Margin - Operating income as a percentage of revenue. Measures operational efficiency.",
  
  // Fundamentals - Growth
  revenuegrowth: "Revenue Growth - Year-over-year percentage increase in revenue. Positive growth is favorable.",
  earningsgrowth: "Earnings Growth - Year-over-year percentage increase in earnings. Consistent growth is a positive sign.",
  
  // Fundamentals - Financial Health
  debttoratio: "Debt-to-Equity Ratio - Total debt divided by shareholder equity. Lower values indicate less financial leverage.",
  currentratio: "Current Ratio - Current assets divided by current liabilities. Values above 1 suggest company can cover short-term obligations.",
  quickratio: "Quick Ratio - (Current assets - inventory) / current liabilities. More conservative measure of liquidity than current ratio.",
  
  // Fundamentals - Dividends
  dividendyield: "Dividend Yield - Annual dividend per share divided by stock price. Higher yields provide more income.",
  payoutratio: "Payout Ratio - Percentage of earnings paid as dividends. Lower ratios suggest more room for dividend growth.",
  
  // Chart Patterns
  support: "A price level where buying pressure has historically prevented further decline. Like a floor for the stock price.",
  resistance: "A price level where selling pressure has historically prevented further gains. Like a ceiling for the stock price.",
  breakout: "When price moves above resistance (bullish) or below support (bearish) with strong volume.",
  
  // Market Regime
  atr: "Average True Range - Measures volatility. Higher ATR means bigger daily price swings. Useful for setting stop losses.",
  regime: "Current market condition - TREND (directional), RANGE (sideways), or HIGH_VOL (choppy/volatile).",
  trendStrength: "Measures how strong the current trend is. Higher values indicate stronger, more reliable trends.",
  
  // Additional Terms
  beta: "Beta - Measures volatility relative to the overall market. Beta > 1 means more volatile than market, < 1 means less volatile.",
  marketcap: "Market Capitalization - Total value of all company shares. Calculated as share price × total shares outstanding.",
  float: "Float - Number of shares available for public trading. Smaller float can lead to bigger price moves.",
  shortinterest: "Short Interest - Percentage of float that's been sold short. High short interest can lead to short squeezes.",
};
