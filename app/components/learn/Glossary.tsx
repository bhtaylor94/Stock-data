'use client';
import React, { useState, useMemo } from 'react';
import { Search, ChevronDown, ChevronRight } from 'lucide-react';

interface Term {
  term: string;
  def: string;
  example?: string;
}

interface Category {
  name: string;
  emoji: string;
  terms: Term[];
}

const CATEGORIES: Category[] = [
  {
    name: 'Options Basics',
    emoji: '📋',
    terms: [
      { term: 'Call Option', def: 'A contract giving you the right to BUY 100 shares at the strike price before expiration. Profitable when the stock rises above strike + premium paid.', example: 'Buy AAPL $200 Call for $3 → you profit if AAPL exceeds $203 by expiry.' },
      { term: 'Put Option', def: 'A contract giving you the right to SELL 100 shares at the strike price before expiration. Profitable when the stock falls below strike − premium paid.', example: 'Buy TSLA $250 Put for $5 → you profit if TSLA falls below $245.' },
      { term: 'Strike Price', def: 'The price at which the option lets you buy (call) or sell (put) the stock. The central anchor of every option contract.' },
      { term: 'Expiration Date', def: 'The date the option contract expires worthless (if OTM) or must be exercised. Weekly options expire every Friday; monthly expire the 3rd Friday.' },
      { term: 'Premium', def: 'The price you pay to buy an option contract. One contract = 100 shares, so a $2.50 option costs $250 total. This is your maximum loss when buying.' },
      { term: 'ITM (In the Money)', def: 'A call is ITM when stock price > strike. A put is ITM when stock price < strike. ITM options have intrinsic value — they\'re worth something right now.' },
      { term: 'OTM (Out of the Money)', def: 'A call is OTM when stock price < strike. A put is OTM when stock price > strike. OTM options are cheaper but need a bigger move to profit.' },
      { term: 'ATM (At the Money)', def: 'Strike price is near or equal to the current stock price. ATM options have the highest time value and most sensitivity to price moves.' },
      { term: 'DTE (Days to Expiration)', def: 'How many days remain until the option expires. Shorter DTE = faster time decay (theta). Most directional traders use 14–60 DTE contracts.' },
      { term: 'Open Interest (OI)', def: 'Total number of outstanding contracts not yet closed. High OI at a strike means that level is significant to the market. Updates overnight.' },
      { term: 'Intrinsic Value', def: 'The real, tangible value of an option: how much it\'s worth if exercised right now. For a $200 call with stock at $210, intrinsic value = $10.' },
      { term: 'Extrinsic Value', def: 'Also called "time value" — the portion of premium above intrinsic value. Includes time remaining and implied volatility. Decays to zero at expiration.' },
    ],
  },
  {
    name: 'The Greeks',
    emoji: '🔢',
    terms: [
      { term: 'Delta (Δ)', def: 'How much the option\'s price moves per $1 move in the stock. Calls: 0 to +1. Puts: −1 to 0. Also a rough probability the option expires ITM.', example: 'Delta 0.50 call → gains $0.50 when stock gains $1. ~50% chance of expiring ITM.' },
      { term: 'Gamma (Γ)', def: 'How fast delta changes as the stock moves. High gamma = delta changes quickly (more risk/reward). Gamma is highest for ATM options near expiration.' },
      { term: 'Theta (Θ)', def: 'Daily time decay — how much value the option loses each day just from time passing. Buyers pay theta; sellers collect it. Accelerates as expiration nears.', example: 'Theta −0.05 means the option loses $5 per day (100 shares × $0.05).' },
      { term: 'Vega (V)', def: 'How much the option\'s price changes per 1% move in implied volatility. Long options benefit from rising IV; short options benefit from falling IV.' },
      { term: 'Rho (ρ)', def: 'How much the option\'s price changes per 1% change in interest rates. Generally a minor factor except for very long-dated options (LEAPS).' },
    ],
  },
  {
    name: 'Volatility',
    emoji: '📈',
    terms: [
      { term: 'Implied Volatility (IV)', def: 'The market\'s expectation of future stock movement, extracted from option prices. High IV = expensive options. Low IV = cheap options. Expressed as an annualized %.' },
      { term: 'Historical Volatility (HV)', def: 'How much the stock actually moved over a past period (typically 20 days). Compare HV to IV: if IV >> HV, options may be overpriced and better to sell.' },
      { term: 'IV Rank', def: 'Where current IV sits relative to its 52-week range (0–100%). IV Rank 80 means IV is higher than 80% of readings over the past year. High IV Rank favors selling premium.' },
      { term: 'IV Crush', def: 'The sharp drop in implied volatility after a catalyst event (earnings, FDA decision). Options buyers often lose money post-earnings even if the stock moves the right direction.' },
      { term: 'Volatility Skew', def: 'OTM puts typically have higher IV than OTM calls (the "volatility smirk") because investors pay more for downside protection. Steep skew = bearish sentiment.' },
      { term: 'Volatility Smile', def: 'When both OTM puts AND OTM calls have higher IV than ATM — shaped like a smile. More common in commodity and currency options.' },
    ],
  },
  {
    name: 'Flow & Volume',
    emoji: '💰',
    terms: [
      { term: 'Sweep Order', def: 'A large options order that fills across multiple exchanges simultaneously, indicating urgency. Sweeps suggest the buyer doesn\'t want to wait — they believe a move is imminent.' },
      { term: 'Golden Sweep', def: 'A sweep order that is also unusually large (high premium) and has high Vol/OI ratio. Considered the strongest institutional signal in options flow analysis.' },
      { term: 'Block Trade', def: 'A single very large options order (typically $500K+ in premium) negotiated privately. Indicates a major institution taking a significant position.' },
      { term: 'Vol/OI Ratio', def: 'Today\'s volume divided by open interest. A ratio above 2× means new positions are being opened (not closing). A ratio above 5–10× is a strong unusual signal.', example: 'Vol 5,000 / OI 400 = 12.5× ratio — extremely unusual activity.' },
      { term: 'Unusual Options Activity (UOA)', def: 'When options volume significantly exceeds normal levels, especially with high Vol/OI ratios. Platforms like Unusual Whales and FlowAlgo specialize in detecting this.' },
      { term: 'Repeat Flow', def: 'When the same strike and expiration sees continued buying over multiple consecutive days. Suggests accumulation — an institution building a position gradually.' },
      { term: 'Put/Call Ratio', def: 'Total put volume divided by total call volume. Above 1.0 = more puts than calls (bearish sentiment). Below 0.7 = more calls (bullish). Used as a contrarian indicator.' },
      { term: 'Max Pain', def: 'The strike price where the most options would expire worthless — causing the maximum loss for options buyers. Stock prices often gravitate toward max pain near expiration.' },
    ],
  },
  {
    name: 'Options Strategies',
    emoji: '🎯',
    terms: [
      { term: 'Long Call', def: 'Buying a call option to profit from a stock rising. Max loss = premium paid. Max gain = unlimited. Best used when you expect a strong upward move.' },
      { term: 'Long Put', def: 'Buying a put option to profit from a stock falling. Max loss = premium paid. Max gain = stock going to zero. Useful as portfolio protection or bearish speculation.' },
      { term: 'Covered Call', def: 'Owning 100 shares AND selling a call against them. Generates income in flat/slightly up markets but caps upside. The most popular options strategy among investors.' },
      { term: 'Cash-Secured Put', def: 'Selling a put while holding enough cash to buy the shares. Generates income and can result in buying shares at a discount. Popular for acquiring stocks you want to own.' },
      { term: 'Bull Call Spread', def: 'Buy a lower strike call, sell a higher strike call. Reduces cost vs a long call but caps max gain. Defined risk/reward — ideal for moderate bullish moves.' },
      { term: 'Bear Put Spread', def: 'Buy a higher strike put, sell a lower strike put. Reduces cost vs a long put but caps max gain. Defined risk/reward for moderate bearish moves.' },
      { term: 'Straddle', def: 'Buy both an ATM call AND an ATM put with the same strike and expiration. Profits from a large move in either direction. Often used before earnings.' },
      { term: 'Iron Condor', def: 'Sell an OTM call spread + sell an OTM put spread simultaneously. Profits when the stock stays within a range. Maximum profit if stock stays between the short strikes.' },
      { term: 'LEAPS', def: 'Long-term options with expirations 1–3 years out. Used as stock substitutes (high delta LEAPS) or long-term hedges. Less time decay but higher absolute premium.' },
      { term: 'Vertical Spread', def: 'Any options strategy using two options of the same type and expiration but different strikes. Includes bull call spreads and bear put spreads. Defines both max risk and reward.' },
    ],
  },
  {
    name: 'Stock Fundamentals',
    emoji: '📊',
    terms: [
      { term: 'P/E Ratio', def: 'Price divided by earnings per share. Shows how much investors pay per dollar of earnings. High P/E = growth expectations. Low P/E = value or declining outlook.', example: 'Stock at $100 with EPS of $5 → P/E of 20×. S&P 500 historical avg ≈ 16×.' },
      { term: 'EPS (Earnings Per Share)', def: 'Net profit divided by shares outstanding. Shows profitability per share. Analysts track EPS growth to assess whether a company is scaling profitably.' },
      { term: 'Revenue Growth', def: 'Year-over-year increase in total sales. Healthy growth companies typically show 15–30%+ revenue growth. Essential for evaluating pre-profit tech companies.' },
      { term: 'Free Cash Flow (FCF)', def: 'Cash generated after capital expenditures. Considered the purest measure of profitability — it\'s cash that can be returned to shareholders or reinvested.' },
      { term: 'EV/EBITDA', def: 'Enterprise Value divided by earnings before interest, taxes, depreciation, and amortization. A capital-structure-neutral valuation metric used to compare companies.' },
      { term: 'PEG Ratio', def: 'P/E ratio divided by earnings growth rate. A PEG below 1.0 suggests the stock may be undervalued relative to its growth. Balances valuation with growth.' },
      { term: 'Market Cap', def: 'Total market value of all shares (price × shares outstanding). Large cap = $10B+, Mid cap = $2–10B, Small cap = $300M–2B. Smaller caps = higher risk/reward.' },
      { term: 'Short Interest', def: 'Percentage of float sold short. High short interest (>15%) can lead to "short squeezes" when positive news forces short sellers to buy shares rapidly.' },
      { term: 'Float', def: 'Shares available for public trading (total shares minus locked-up insider shares). Low float stocks can move dramatically on moderate volume.' },
      { term: 'Beta', def: 'Measures stock\'s volatility relative to the market. Beta > 1 = more volatile than market. Beta < 1 = less volatile. Negative beta = moves opposite to market.' },
    ],
  },
  {
    name: 'Technical Analysis',
    emoji: '📉',
    terms: [
      { term: 'RSI (Relative Strength Index)', def: '0–100 oscillator measuring momentum. Above 70 = overbought (potential pullback). Below 30 = oversold (potential bounce). Best used alongside price action.' },
      { term: 'MACD', def: 'Moving Average Convergence Divergence — shows momentum via the relationship between two EMAs. Signal line crossovers indicate potential trend changes.' },
      { term: 'Moving Average (SMA/EMA)', def: 'Average price over N periods. 50-day and 200-day MAs are key support/resistance levels watched by institutions. Stock above 200 SMA = long-term uptrend.' },
      { term: 'Volume Profile', def: 'Shows where the most trading volume has occurred at each price level. High-volume nodes are strong support/resistance. Low-volume zones = price moves quickly.' },
      { term: 'Support', def: 'A price level where buying interest has historically been strong enough to stop a decline. Broken support becomes resistance.' },
      { term: 'Resistance', def: 'A price level where selling pressure has historically capped rallies. Broken resistance becomes support. Watch for volume confirmation on breakouts.' },
      { term: 'ADX (Average Directional Index)', def: '0–100 trend strength indicator. Above 25 = strong trend. Below 20 = choppy/ranging market. ADX doesn\'t show direction — use with +DI/-DI for that.' },
      { term: 'Bollinger Bands', def: 'Volatility bands plotted 2 standard deviations above/below a 20-day MA. Price touching upper band = extended. Price near lower band = potentially oversold.' },
      { term: 'Fibonacci Retracements', def: 'Key levels (23.6%, 38.2%, 50%, 61.8%) derived from Fibonacci ratios. Widely watched as potential support/resistance after a significant move.' },
      { term: 'On-Balance Volume (OBV)', def: 'Cumulative volume indicator. Rising OBV with falling price = bullish divergence (accumulation). Falling OBV with rising price = bearish divergence (distribution).' },
    ],
  },
  {
    name: 'Market Concepts',
    emoji: '🌐',
    terms: [
      { term: 'Market Maker', def: 'A firm that provides liquidity by continuously quoting bid/ask prices. Market makers delta-hedge their options positions — their hedging activity can amplify stock moves (gamma squeeze).' },
      { term: 'Gamma Squeeze', def: 'When heavy call buying forces market makers to buy the underlying stock to hedge, which drives the price up, triggering more call buying in a feedback loop. GameStop 2021 is the famous example.' },
      { term: 'Options Expiration (OPEX)', def: 'The date options expire — typically the 3rd Friday of each month. Markets can be volatile as institutions close/roll positions. Stock often pins near max pain.' },
      { term: 'Dark Pool', def: 'Private exchanges where large institutional trades occur away from public markets. Dark pool activity appears in tape data as unusual block transactions.' },
      { term: 'Sector Rotation', def: 'Institutional money moving from one sector to another based on economic cycle or rate environment. E.g., from growth/tech to value/energy when rates rise.' },
      { term: 'VIX (Fear Index)', def: 'CBOE Volatility Index — measures 30-day implied volatility of S&P 500 options. Above 30 = high fear/volatility. Below 15 = complacency. Spikes during selloffs.' },
      { term: 'Contango / Backwardation', def: 'Terms for the IV term structure shape. Contango = near-term IV < long-term IV (normal). Backwardation = near-term IV > long-term IV (fear/crisis, or earnings approaching).' },
    ],
  },
];

export function Glossary() {
  const [search, setSearch] = useState('');
  const [openCats, setOpenCats] = useState<Set<string>>(new Set([CATEGORIES[0].name]));

  function toggleCat(name: string) {
    setOpenCats(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  const q = search.toLowerCase().trim();

  const filtered = useMemo(() => {
    if (!q) return CATEGORIES;
    return CATEGORIES
      .map(cat => ({
        ...cat,
        terms: cat.terms.filter(
          t =>
            t.term.toLowerCase().includes(q) ||
            t.def.toLowerCase().includes(q) ||
            (t.example?.toLowerCase().includes(q) ?? false),
        ),
      }))
      .filter(cat => cat.terms.length > 0);
  }, [q]);

  const totalTerms = CATEGORIES.reduce((s, c) => s + c.terms.length, 0);

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header */}
      <div>
        <h2 className="text-lg font-bold text-white">Trading Glossary</h2>
        <p className="text-xs text-slate-500 mt-0.5">
          {totalTerms} terms across {CATEGORIES.length} categories · tap any term to expand
        </p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
        <input
          type="text"
          placeholder="Search terms..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-slate-800/60 border border-slate-700/50 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/50"
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
          >
            ✕
          </button>
        )}
      </div>

      {/* No results */}
      {filtered.length === 0 && (
        <p className="text-sm text-slate-500 text-center py-8">No terms match "{search}"</p>
      )}

      {/* Categories */}
      {filtered.map(cat => {
        const isOpen = q !== '' || openCats.has(cat.name);
        return (
          <div key={cat.name} className="rounded-2xl border border-slate-700/50 bg-slate-800/20 overflow-hidden">
            {/* Category header */}
            <button
              onClick={() => toggleCat(cat.name)}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-800/40 transition-colors"
            >
              <div className="flex items-center gap-2">
                <span className="text-base">{cat.emoji}</span>
                <span className="text-sm font-semibold text-white">{cat.name}</span>
                <span className="text-xs text-slate-500">({cat.terms.length})</span>
              </div>
              {isOpen ? (
                <ChevronDown size={14} className="text-slate-500" />
              ) : (
                <ChevronRight size={14} className="text-slate-500" />
              )}
            </button>

            {/* Terms list */}
            {isOpen && (
              <div className="divide-y divide-slate-800/50">
                {cat.terms.map(t => (
                  <details key={t.term} className="group px-4">
                    <summary className="py-2.5 cursor-pointer list-none flex items-center justify-between hover:text-white transition-colors">
                      <span className="text-sm font-medium text-slate-200 group-open:text-white">
                        {t.term}
                      </span>
                      <ChevronRight
                        size={12}
                        className="text-slate-600 flex-shrink-0 group-open:rotate-90 transition-transform"
                      />
                    </summary>
                    <div className="pb-3 space-y-2">
                      <p className="text-xs text-slate-300 leading-relaxed">{t.def}</p>
                      {t.example && (
                        <div className="px-3 py-2 rounded-lg bg-slate-900/60 border border-slate-700/40">
                          <p className="text-[11px] text-slate-400">
                            <span className="text-amber-400 font-semibold">Example: </span>
                            {t.example}
                          </p>
                        </div>
                      )}
                    </div>
                  </details>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
