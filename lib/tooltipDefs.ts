export type TooltipDef = { title: string; body: string };

// 50+ definitions (tech + options + fundamentals + context)
// Keys should be UPPERCASE.
export const TOOLTIP_DEFS: Record<string, TooltipDef> = {
  // Market context
  REGIME: { title: 'Regime', body: 'Market environment classification: TREND (directional), RANGE (choppy), HIGH_VOL (high volatility). Used to size risk and confidence.' },
  'TREND STRENGTH': { title: 'Trend Strength', body: 'How strongly the market is trending (typically based on SMA separation / momentum). Higher values imply a more reliable trend.' },
  'ATR%': { title: 'ATR%', body: 'Average True Range as a percent of price. A quick volatility gauge. Higher ATR% = wider daily ranges and higher risk.' },

  // Technical indicators
  RSI: { title: 'RSI', body: 'Relative Strength Index (0–100). Overbought often >70, oversold often <30 (context matters).' },
  MACD: { title: 'MACD', body: 'Moving Average Convergence Divergence. Measures momentum using EMA relationships.' },
  MACDSIGNAL: { title: 'MACD Signal', body: 'Signal line for MACD (often a 9‑period EMA of MACD). Crossovers can indicate momentum changes.' },
  MACDHISTOGRAM: { title: 'MACD Histogram', body: 'Difference between MACD and the signal line. Positive/negative shows momentum direction and strength.' },
  SMA20: { title: 'SMA20', body: '20‑day Simple Moving Average. Short-term trend baseline.' },
  SMA50: { title: 'SMA50', body: '50‑day Simple Moving Average. Medium-term trend baseline.' },
  SMA200: { title: 'SMA200', body: '200‑day Simple Moving Average. Long-term trend baseline.' },
  EMA12: { title: 'EMA12', body: '12‑day Exponential Moving Average. Reacts faster to price changes than SMA.' },
  EMA26: { title: 'EMA26', body: '26‑day Exponential Moving Average. Used with EMA12 for MACD.' },
  BOLLINGERUPPER: { title: 'Bollinger Bands', body: 'Volatility bands around a moving average (typically ±2 standard deviations). Wide bands = higher volatility.' },
  BOLLINGERMIDDLE: { title: 'Bollinger Bands', body: 'Middle band is typically the moving average baseline.' },
  BOLLINGERLOWER: { title: 'Bollinger Bands', body: 'Lower band can act as a mean-reversion zone in ranging markets.' },
  GOLDENCROSS: { title: 'Golden Cross', body: 'Bullish long-term signal when SMA50 crosses above SMA200.' },
  DEATHCROSS: { title: 'Death Cross', body: 'Bearish long-term signal when SMA50 crosses below SMA200.' },
  SUPPORT: { title: 'Support', body: 'A price zone where buying historically emerged (a “floor”). Breaks below can accelerate downside.' },
  RESISTANCE: { title: 'Resistance', body: 'A price zone where selling historically emerged (a “ceiling”). Breaks above can accelerate upside.' },
  BREAKOUT: { title: 'Breakout', body: 'A move above resistance (or below support) that can trigger trend continuation.' },
  ATR: { title: 'ATR', body: 'Average True Range. Measures absolute volatility (not direction). Higher ATR = larger typical daily moves.' },
  VOLUME: { title: 'Volume', body: 'Number of shares/contracts traded. Spikes can confirm breakouts or signal unusual interest.' },

  // Options
  DTE: { title: 'DTE', body: 'Days To Expiration. Less DTE generally means more time-decay risk (theta) and higher gamma.' },
  IV: { title: 'Implied Volatility', body: 'Market’s priced-in volatility for the option. Higher IV often means higher premiums (more expensive options).' },
  OI: { title: 'Open Interest', body: 'Number of open contracts. Higher OI often suggests better liquidity/interest.' },
  DELTA: { title: 'Delta', body: 'Option price sensitivity to the underlying. Roughly: expected $ change in option per $1 move in stock (calls positive, puts negative).' },
  GAMMA: { title: 'Gamma', body: 'Rate of change of delta. Higher gamma means delta changes faster—more sensitivity near expiration/ATM.' },
  THETA: { title: 'Theta', body: 'Time decay. Expected option value loss per day (all else equal). Often larger for short-dated options.' },
  VEGA: { title: 'Vega', body: 'Sensitivity to implied volatility. Higher vega means option price changes more when IV changes.' },

  // Fundamentals (valuation)
  PE: { title: 'P/E Ratio', body: 'Price-to-Earnings. Higher can mean higher growth expectations, but can also imply overvaluation.' },
  PB: { title: 'P/B Ratio', body: 'Price-to-Book. Useful for asset-heavy companies; lower may indicate cheaper valuation (context matters).' },
  PS: { title: 'P/S Ratio', body: 'Price-to-Sales. Common for early-stage or low-profit companies.' },
  PEG: { title: 'PEG Ratio', body: 'P/E adjusted for growth. Lower PEG can indicate “cheaper” growth.' },

  // Fundamentals (profitability)
  ROE: { title: 'ROE', body: 'Return on Equity. Profitability relative to shareholder equity. Higher is generally better.' },
  ROA: { title: 'ROA', body: 'Return on Assets. Profitability relative to total assets.' },
  EPS: { title: 'EPS', body: 'Earnings Per Share. Company profit divided by shares outstanding.' },
  GROSSMARGIN: { title: 'Gross Margin', body: 'Profitability after cost of goods sold. Higher margins often indicate stronger pricing power.' },
  PROFITMARGIN: { title: 'Profit Margin', body: 'Net income as a percent of revenue. Higher margin = more profit per dollar of sales.' },
  OPERATINGMARGIN: { title: 'Operating Margin', body: 'Operating income as a percent of revenue. Measures operating efficiency.' },

  // Fundamentals (growth)
  REVENUEGROWTH: { title: 'Revenue Growth', body: 'Year-over-year revenue change. Consistent growth can support higher valuations.' },
  EARNINGS_GROWTH: { title: 'Earnings Growth', body: 'Year-over-year earnings change. Growing earnings often drive long-term stock appreciation.' },
  'EARNINGS GROWTH': { title: 'Earnings Growth', body: 'Year-over-year earnings change. Growing earnings often drive long-term stock appreciation.' },
  EPSGROWTH: { title: 'EPS Growth', body: 'Year-over-year EPS change. Higher is generally better, but watch for one-time items.' },

  // Fundamentals (financial health)
  'DEBT-TO-EQUITY': { title: 'Debt-to-Equity', body: 'Leverage ratio. Higher means more debt relative to equity; can increase risk.' },
  DEBTEQUITY: { title: 'Debt-to-Equity', body: 'Leverage ratio. Higher means more debt relative to equity; can increase risk.' },
  CURRENTRATIO: { title: 'Current Ratio', body: 'Short-term liquidity: current assets / current liabilities. Higher suggests better ability to pay near-term bills.' },
  QUICKRATIO: { title: 'Quick Ratio', body: 'More conservative liquidity: (cash + receivables) / current liabilities. Excludes inventory.' },

  // Dividends
  DIVIDENDYIELD: { title: 'Dividend Yield', body: 'Annual dividend as a percent of price. Higher yield can support total return but may signal risk if unsustainable.' },
  PAYOUTRATIO: { title: 'Payout Ratio', body: 'Percent of earnings paid as dividends. Extremely high payouts can be harder to sustain.' },

  // Additional
  BETA: { title: 'Beta', body: 'Volatility versus the market (often S&P 500). Beta > 1 = more volatile; < 1 = less volatile.' },
  MARKETCAP: { title: 'Market Cap', body: 'Company size: share price × shares outstanding.' },
  FLOAT: { title: 'Float', body: 'Shares available to the public. Lower float can increase volatility.' },
  SHORTINTEREST: { title: 'Short Interest', body: 'Percent of shares sold short. High short interest can signal bearish bets or squeeze potential.' },

  // Options — institutional intel
  'PREM P/C': { title: 'Premium P/C Ratio', body: 'Dollar-weighted put/call ratio. Below 0.8 = more dollars flowing into calls (bullish). Above 1.2 = more dollars in puts (bearish). Stronger signal than volume P/C — large traders reveal conviction through size.' },
  '25D RISK REV': { title: '25Δ Risk Reversal', body: 'IV difference between 25-delta puts and 25-delta calls. Positive = puts cost more (fear/hedging demand). Negative = calls cost more (greed/upside speculation). Hedge funds watch this daily.' },
  'SKEW BIAS': { title: 'Skew Bias', body: 'Summary of which side of the options market is paying up. FEAR = expensive OTM puts (downside protection). GREED = expensive OTM calls (upside chasing). NEUTRAL = balanced pricing.' },
  'GEX REGIME': { title: 'GEX Regime', body: 'Gamma Exposure regime. POSITIVE = dealers net long gamma — they dampen moves by selling rallies and buying dips. NEGATIVE = dealers net short gamma — they amplify moves by chasing price in both directions.' },
  'EXPECTED MOVE': { title: 'Expected Move', body: '1-sigma implied move derived from the ATM straddle price (call ask + put ask). The market\'s consensus range for this expiration. Statistically, price stays within ±1σ ~68% of the time.' },
  'OI PROFILE': { title: 'OI Profile', body: 'Open interest distribution across strikes. Large call walls often act as upside price magnets or resistance. Large put walls act as support. Max pain = the strike where most contracts expire worthless — price gravitates here near expiration.' },
  'SMART MONEY FLOW': { title: 'Smart Money Flow', body: 'Unusual options activity filtered for institutional footprints: large premium ($100K+), high Vol/OI ratio (fresh positions), directional delta. These signals suggest informed positioning ahead of a move.' },
  '0DTE FLOW': { title: '0DTE Flow Alert', body: 'Options expiring today with institutional-size premium. Extreme gamma — small price moves create outsized gains/losses. Sophisticated traders use these for intraday directional bets. Very high risk, not suitable for beginners.' },
  'FLOW SETUPS': { title: 'Flow Setups', body: 'Named trading setups that combine technical signals with unusual options flow. A setup fires when multiple criteria align — e.g., breakout + large call sweep + favorable IV. Higher confluence score = more factors agree.' },
  'CONFLUENCE SCORE': { title: 'Confluence Score', body: '0–100 score combining UOA signal strength, technical setup quality, and IV environment. Think of it as "how many things agree." ≥80 = EXTREME conviction. ≥65 = VERY HIGH. ≥50 = HIGH. ≥35 = MEDIUM.' },
  'OVERNIGHT OI': { title: 'Overnight OI Changes', body: 'Difference in open interest vs the prior session snapshot. Large new positions (>25% OI increase) signal fresh institutional entries — not just rolling existing positions. Call vs put bias shows net directional intent.' },
  'NET DELTA': { title: 'Net Market Delta', body: 'Sum of all contract deltas weighted by open interest × 100 shares. Positive = overall bullish positioning. Negative = net bearish. Large absolute values indicate strong directional bias in the market.' },
  'TOTAL THETA': { title: 'Total Theta $/Day', body: 'Aggregate daily time decay across all open contracts for this expiration. Options sellers collect this each day. Options buyers pay it. Large negative values mean significant premium is eroding daily.' },
  'TOTAL VEGA': { title: 'Total Vega $/1% IV', body: 'Aggregate sensitivity to volatility for this expiration. A $5,000 total vega means the combined positions gain/lose $5,000 for every 1% change in IV. High before earnings, low after.' },
  'MAX PAIN': { title: 'Max Pain', body: 'The strike price where the total payout to all options holders is minimized. Stock often drifts toward max pain near expiration because market makers hedge their books in that direction.' },
  HV20: { title: 'HV20', body: '20-day Historical Volatility — how much the stock actually moved over the past 20 trading sessions, annualized. The "realized" vol benchmark. Compare to IV: if IV > HV20, options are pricing in more vol than recently realized.' },
  'IV VS HV': { title: 'IV vs HV20', body: 'Ratio of implied to historical volatility. Above 1.2× = options are expensive relative to recent moves — favor selling premium or using spreads. Below 0.85× = options are cheap — favor buying premium or long strategies.' },
  'ATM IV': { title: 'ATM IV', body: 'At-the-money implied volatility — the market\'s annualized volatility estimate embedded in nearest-to-spot options. The single most important options pricing input. Drives all premium levels across the chain.' },
  'P/C RATIO': { title: 'Put/Call Ratio', body: 'Volume of put options divided by call volume. Below 0.7 = heavy call activity (bullish signal). Above 1.2 = heavy put activity (bearish signal). Watch for extremes — contrarian when very high or very low.' },
  'IV RANK': { title: 'IV Rank', body: 'Implied volatility rank (0–100) showing where current IV sits relative to its 52-week range. Below 30 = historically cheap — favor buying premium or long strategies. Above 70 = historically expensive — favor selling premium or using spreads.' },
};

export function tooltipForKey(rawKey: string): TooltipDef | null {
  const k = (rawKey || '').trim();
  if (!k) return null;
  const upper = k.toUpperCase();
  // Try direct
  if (TOOLTIP_DEFS[upper]) return TOOLTIP_DEFS[upper];
  // Normalize common patterns
  const normalized = upper.replace(/\s+/g, '').replace(/[^A-Z0-9]/g, '');
  if (TOOLTIP_DEFS[normalized]) return TOOLTIP_DEFS[normalized];
  // Some keys are rendered as key.toUpperCase() from camelCase
  // Try mapping camelCase -> key names
  if (upper === 'PRICEVSSMA50') return { title: 'Price vs SMA50', body: 'Percent difference between current price and SMA50. Positive means price is above the SMA.' };
  if (upper === 'PRICEVSSMA200') return { title: 'Price vs SMA200', body: 'Percent difference between current price and SMA200. Positive means price is above the SMA.' };
  return null;
}
