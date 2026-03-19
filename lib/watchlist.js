// lib/watchlist.js
// The 25 most liquid stocks/ETFs FlowHunter monitors

export const WATCHLIST = [
  'SPY', 'QQQ', 'AAPL', 'MSFT', 'NVDA',
  'AMZN', 'TSLA', 'META', 'GOOGL', 'AMD',
  'NFLX', 'JPM', 'V', 'BA', 'DIS',
  'COIN', 'SOFI', 'PLTR', 'XOM', 'IWM',
  'GLD', 'TLT', 'SMCI', 'MU', 'CRM',
];

// Hard rules
export const MIN_DTE = 14;
export const MAX_DTE = 730; // 2 years
export const MIN_CONFIDENCE = 4; // out of 5 layers
export const MIN_OI = 100;
export const MAX_SPREAD_PCT = 0.15; // 15% bid/ask spread max
export const MIN_PREMIUM = 250000; // $250K min for flow detection
export const VOL_OI_THRESHOLD = 1.5; // Volume/OI ratio trigger
export const VOLUME_MULTIPLIER = 3; // 3x avg volume trigger

// VIX Circuit Breaker
export const VIX_CAUTION = 22;   // yellow warning on all bullish cards
export const VIX_DANGER = 28;    // red warning, flag all bullish as high risk
export const VIX_HALT = 35;      // pause all bullish suggestions entirely

// Macro event calendar (manually maintained, update monthly)
export const MACRO_EVENTS = [
  // Add FOMC, CPI, etc dates here
  // { type: 'FOMC', date: '2026-03-19', description: 'FOMC Rate Decision' },
  // { type: 'CPI', date: '2026-04-10', description: 'CPI Report' },
];
