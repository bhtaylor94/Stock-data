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
      { term: 'IV Expansion Play', def: 'Buying options (calls or puts) BEFORE a catalyst event specifically to profit from rising implied volatility — not just price movement. As the event approaches, IV inflates and options become more expensive. You can profit even before the stock moves.', example: 'Buy a SPY straddle 5 days before FOMC. If IV rises from 15% to 22% as the event nears, your options gain value from IV expansion alone — before the Fed even speaks.' },
      { term: 'IV Contraction Play', def: 'Selling options (iron condors, strangles, credit spreads) when IV is elevated, betting that it will decline back to normal. Common strategy after earnings or major events when IV spikes then crashes.', example: 'Sell a QQQ iron condor the morning AFTER earnings when IV is still elevated. As IV returns to baseline over the next week, the premium you sold deflates and you profit.' },
      { term: 'Term Structure', def: 'How implied volatility changes across different expiration dates. Normally near-term IV < far-term IV (contango). When near-term IV exceeds far-term (backwardation), it signals fear or an imminent catalyst.' },
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
      { term: 'VWAP (Volume Weighted Average Price)', def: 'The average price a stock has traded at throughout the day, weighted by volume. Institutions use VWAP as their benchmark — they try to buy below it. Price above VWAP = bullish intraday bias. Price below VWAP = bearish. A common swing entry: buy when price reclaims VWAP after a pullback.', example: 'NVDA opens at $875, dips to $865 (below VWAP at $870), then reclaims $871 on volume. That reclaim of VWAP is an institutional buy signal.' },
      { term: 'ATR (Average True Range)', def: 'Measures the average daily price range (high minus low) over a set period (typically 14 days). Use it for: (1) Setting stop losses — "stop 1.5× ATR below entry." (2) Sizing positions — smaller positions on high-ATR stocks. (3) Setting price targets — "target 2× ATR from entry."', example: 'TSLA has a 14-day ATR of $15. That means TSLA typically moves $15/day. A 1× ATR stop below a $250 entry = stop at $235.' },
      { term: 'Breakout', def: 'When price moves ABOVE a key resistance level, often with increased volume. Breakouts signal that buyers have overwhelmed sellers at that price level. A valid breakout should have volume at least 1.5–2× the 20-day average — low-volume breakouts often fail and reverse ("false breakout").', example: 'AAPL has resistance at $195 for 3 weeks. It finally pushes through $195 on 3× average volume. That\'s a breakout — the next resistance becomes the price target.' },
      { term: 'Breakdown', def: 'When price moves BELOW a key support level. The bearish version of a breakout. Broken support often becomes new resistance. High volume on breakdown = strong signal.' },
      { term: 'Pullback', def: 'A temporary price decline within a larger uptrend. Healthy pullbacks typically retrace 30–50% of the prior move and occur on declining volume. Pullbacks to key levels (moving averages, prior resistance-turned-support, Fibonacci levels) are entry opportunities in trending stocks.', example: 'SPY rallies from $460 to $490. A pullback to $475 (50% retracement, near the 50-day MA) on low volume is a normal, healthy pullback — a potential buy.' },
      { term: 'Bull Flag', def: 'A continuation chart pattern: a sharp, strong price move upward (the "pole"), followed by a tight, slightly downward consolidation on lower volume (the "flag"). When price breaks above the upper trendline of the flag, the uptrend typically resumes. Target = pole height added to breakout.', example: 'META surges 8% in 3 days (the pole), then drifts sideways-down for a week on light volume (the flag). When it breaks the upper edge of the flag on volume, it\'s a buy signal targeting another 8% move.' },
      { term: 'Bear Flag', def: 'The bearish version of a bull flag. A sharp drop (the pole) followed by a weak bounce in a tight, slightly upward channel (the flag). When price breaks below the flag\'s lower edge on volume, the downtrend resumes. Target = pole height downward from breakdown.' },
      { term: 'Cup and Handle', def: 'A bullish base pattern taking weeks to form: stock declines in a gentle U-shape (the cup), recovers to the prior high, then consolidates briefly in a small downward drift (the handle). A breakout above the handle\'s upper edge (the "pivot point") is the buy signal. One of the most reliable and widely followed chart patterns.', example: 'GOOGL drops from $190 to $172 over 6 weeks, recovers to $190, then pulls back gently to $185 for 10 days. When it breaks above $190 on volume, it\'s a classic cup and handle breakout.' },
      { term: 'Golden Cross / Death Cross', def: 'Golden Cross: the 50-day MA crosses ABOVE the 200-day MA — a bullish long-term signal that often marks the start of a sustained uptrend. Death Cross: the 50-day MA crosses BELOW the 200-day MA — bearish, often precedes extended downtrends. Both are widely watched by institutional algorithms.', example: 'NVDA formed a Golden Cross in January 2023 — the 50-day crossed above the 200-day. It subsequently rallied over 200% in the following year.' },
      { term: 'Gap Up / Gap Down', def: 'When a stock opens significantly above (gap up) or below (gap down) the prior day\'s close, creating a "gap" on the chart. Catalyst gaps (on strong earnings or news) on high volume often continue in the gap direction. Low-volume gaps often "fill" (price returns to close the gap) within days.', example: 'NVDA reports earnings after close. The next morning it opens $50 higher (gap up). On 3× average volume, this is a "continuation gap" — buy the first pullback, not the open.' },
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
  {
    name: 'Risk Management',
    emoji: '🛡️',
    terms: [
      { term: 'Risk/Reward Ratio', def: 'How much you stand to gain vs. how much you risk. A 1:3 ratio means you risk $100 to potentially make $300. Never enter a trade where the reward is less than 2× the risk. Most professional traders require at least 1:2 before entering.', example: 'Entry: $100. Stop loss: $95 (risk: $5). Target: $115 (reward: $15). Risk/reward = 1:3. This is a good trade to take.' },
      { term: 'Position Sizing', def: 'How much of your capital to allocate to a single trade. The most important risk management skill. A common rule: risk no more than 1–2% of your total account on any single trade. If your account is $10,000 and you risk 1%, your max loss per trade = $100.', example: 'Account: $10,000. Risk per trade: 1% = $100. Entry at $50, stop at $48 (risk = $2/share). Position size = $100 ÷ $2 = 50 shares.' },
      { term: 'Stop Loss', def: 'A predefined price level where you automatically exit a losing trade. Set your stop BEFORE you enter — not after you\'re already down. Common stop types: (1) Fixed % below entry. (2) Below a key technical level (support, prior low). (3) ATR-based (1–2× ATR below entry). The stop defines your maximum loss on the trade.' },
      { term: 'Trailing Stop', def: 'A stop that moves UP with the price as a trade becomes profitable, locking in gains. If a stock rises from $100 to $120 with a 5% trailing stop, your stop moves from $95 to $114. Lets you capture big trends while protecting profits.', example: 'Buy NVDA at $900. Set a 7% trailing stop ($837). NVDA rises to $1,000 → stop moves to $930. If NVDA reverses, you\'re stopped out at $930 — locking in a $30 profit instead of letting it turn negative.' },
      { term: 'The 1% Rule', def: 'Never risk more than 1% of your total trading account on a single trade. This means even 10 consecutive losing trades only destroys 10% of your account, preserving capital for the inevitable recovery. Most traders blow up accounts by sizing too large, not by having a bad strategy.' },
      { term: 'Max Drawdown', def: 'The largest peak-to-trough decline in a portfolio over a period. A critical risk metric: a 50% drawdown requires a 100% gain just to recover. Professional traders obsess over limiting drawdown.' },
      { term: 'Expectancy', def: 'The average amount you expect to win per trade, accounting for both win rate and average win/loss size. Expectancy = (Win Rate × Avg Win) − (Loss Rate × Avg Loss). A positive expectancy means your strategy is profitable long-term even with less than 50% win rate.', example: 'Win rate 40%, avg win $300, avg loss $100. Expectancy = (0.4 × $300) − (0.6 × $100) = $120 − $60 = $60 per trade. Positive expectancy — this strategy makes money long-term.' },
      { term: 'Scaling In / Scaling Out', def: 'Scaling in: entering a position in multiple smaller buys rather than all at once, reducing average cost if the stock moves against you briefly. Scaling out: selling a position in pieces (e.g., sell 1/3 at first target, 1/3 at second target, hold 1/3 for a bigger move). Protects profits while staying in winning trades.' },
    ],
  },
  {
    name: 'Stock Trading Concepts',
    emoji: '📊',
    terms: [
      { term: 'Catalyst', def: 'Any news event that causes a significant price move in a stock. Examples: earnings beat/miss, FDA drug approval/rejection, analyst upgrade/downgrade, product launch, partnership announcement, executive change, M&A activity. The strength of a catalyst determines the size of the resulting move. Options flow traders try to identify catalysts before they become public.' },
      { term: 'Relative Strength', def: 'A stock showing relative strength rises more than the market on up days and falls LESS on down days. This is a sign of institutional accumulation. When SPY is down 1% and a stock is flat or up, that stock has relative strength — a bullish signal.', example: 'SPY drops 2% on a bad CPI print. NVDA drops only 0.5%. NVDA is showing relative strength — institutions are holding or buying it even as the market sells off.' },
      { term: 'Days to Cover (Short Ratio)', def: 'Short interest divided by average daily volume. Shows how many days it would take all short sellers to exit their positions. High days-to-cover (> 5 days) means shorts are trapped — any positive catalyst can trigger a violent short squeeze as they all try to buy back simultaneously.' },
      { term: 'Float Rotation', def: 'When a stock\'s entire float (tradeable shares) changes hands in a single day. Common in low-float stocks with a catalyst. Creates explosive price moves because the limited supply is overwhelmed by demand.', example: 'A small company with 2M shares in float gets an FDA approval. Volume hits 15M in one day — that\'s 7.5× the float changing hands. Price can move 50–200%+ in a single session.' },
      { term: 'Earnings Season', def: 'The 4–6 week period after each quarter ends (January, April, July, October) when most S&P 500 companies report quarterly results. Options premiums are significantly elevated during earnings season. Stock moves of 5–15% overnight are common. Both the highest opportunity and highest risk period for options traders.' },
      { term: 'Gap Fill', def: 'When a stock that opened with a price gap eventually trades back to "fill" the gap — returning to the price where it closed the prior session. Low-volume gaps tend to fill quickly. High-volume catalyst gaps often resist filling for weeks or months.', example: 'TSLA closes at $200 Monday. Gaps DOWN to $185 Tuesday on weak guidance. A "gap fill" would mean TSLA eventually trades back up to $200 to close that gap.' },
      { term: 'Momentum', def: 'The tendency for stocks that have been rising to continue rising (and falling stocks to continue falling) over the short to medium term. Academic research confirms momentum is one of the most persistent market anomalies. Momentum traders buy strength, not weakness.' },
      { term: 'Mean Reversion', def: 'The tendency for extreme price moves to eventually reverse back toward the average. The opposite of momentum trading. Mean reversion traders sell stocks that have moved too far too fast, expecting a pullback. Bollinger Bands and RSI extremes are key mean reversion tools.' },
      { term: 'Pre-Market / After-Hours Trading', def: 'Stock trading that occurs before the 9:30 AM ET open (pre-market) or after the 4:00 PM ET close (after-hours). Most earnings are released in after-hours. Liquidity is much lower, spreads are wider, and moves can be extreme and misleading. Experienced traders wait for the regular session to confirm direction before sizing into a position.' },
      { term: 'Accumulation / Distribution', def: 'Accumulation: institutions quietly buying large amounts of a stock over weeks without driving the price up much (sneaking in). Distribution: institutions quietly selling a large position. Signs of accumulation: rising OBV, stock holding gains on low volume. Signs of distribution: falling OBV, stock struggling to hold gains.' },
      { term: 'Short Squeeze', def: 'When a heavily shorted stock rises sharply, forcing short sellers (who bet on it falling) to buy shares to cover their positions and cut losses. This forced buying adds fuel to the rally, creating a self-reinforcing loop. The higher it goes, the more shorts are forced to buy. Can create explosive 30–200%+ moves in days.', example: 'GME in January 2021: 140% short interest, retail traders identified the squeeze opportunity. Stock went from $18 to $483 in 2 weeks as shorts were forced to cover at ever-higher prices.' },
      { term: 'Window Dressing', def: 'At the end of each quarter, mutual funds and ETFs buy their top-performing holdings to make their portfolios look good on quarterly statements. This creates an artificial short-term buying pressure in the final days of March, June, September, and December. A real and exploitable pattern that contributes to Q4 and quarter-end rallies.' },
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
