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
      { term: 'Implied Volatility (IV)', def: 'The market\'s expectation of future stock movement, extracted from option prices. High IV = expensive options. Low IV = cheap options. Expressed as an annualized %. If a stock has 30% IV, the market expects roughly a 30% annual price swing — or about 1.9% per day.', example: 'SPY at 15% IV = calm market. SPY at 35% IV = fearful market. Option premiums are roughly 2× more expensive.' },
      { term: 'Historical Volatility (HV / Realized Vol)', def: 'How much the stock actually moved over a past period, calculated from daily log returns. HV20 = last 20 trading days. Compare HV to IV: if IV significantly exceeds HV, options are priced expensively relative to recent behavior. If IV is below HV, options are cheap. The single most useful data point for deciding whether to buy or sell premium.', example: 'NVDA has HV20 of 45% but IV is 65% — options are priced 1.4× above recent moves. Sellers have a statistical edge.' },
      { term: 'IV Rich', def: 'When implied volatility (IV) is significantly higher than historical/realized volatility — specifically IV/HV ratio ≥ 1.4×. Options are overpriced relative to how much the stock has actually been moving. This is the signal to SELL premium: write covered calls, sell credit spreads, or run iron condors. The market is paying you too much for insurance.', example: 'TSLA HV20 = 40%, ATM IV = 65%. IV/HV = 1.6×. TSLA options are IV Rich — selling a strangle or iron condor has a statistical edge because the market overestimates future movement.' },
      { term: 'IV Cheap', def: 'When implied volatility is well below historical volatility — IV/HV ratio ≤ 0.65×. Options are priced cheaply relative to how violently the stock has been moving. This favors BUYING premium: buy calls, puts, or straddles before expected catalysts. Your cost of insurance is low relative to the actual risk.', example: 'SPY HV20 = 18% but IV is only 11%. IV/HV = 0.61×. SPY options are IV Cheap — a great time to buy protective puts or straddles before a Fed meeting.' },
      { term: 'IV Rank', def: 'Where current IV sits within its own 52-week historical range, expressed as 0–100%. IV Rank 80 means today\'s IV is higher than 80% of all readings over the past year. This is a per-stock, self-referencing metric — it correctly accounts for the fact that high-vol stocks like TSLA naturally have higher IV than low-vol stocks like KO.', example: 'TSLA IV Rank 85 = elevated even by TSLA\'s own standards → sell premium. TSLA IV Rank 20 = unusually calm for TSLA → buy premium or look for a catalyst trade.' },
      { term: 'IV Percentile', def: 'What percentage of past trading days had lower IV than today. Different from IV Rank: Rank compares today\'s IV to the min/max range; Percentile counts how many days were cheaper. IV Percentile 75 = 75% of past days had lower IV. More statistically robust than IV Rank because it\'s not distorted by a single spike high or low.', example: 'If a stock spiked to 200% IV once during a crisis, that spike sets the Rank max. IV Rank could be 30 even though today\'s IV is above average. IV Percentile would correctly show it\'s above average.' },
      { term: 'IV Crush', def: 'The sharp, violent drop in implied volatility immediately after a major catalyst event — especially earnings. Options lose value dramatically as the uncertainty resolves, even if the stock moves in your favor. This is why buying options into earnings is dangerous: the stock might move 5% your way but your option loses money because IV drops from 80% to 30% overnight.', example: 'Buy AMZN calls before earnings. Stock pops 4%. IV crashes from 75% to 28%. Your call option actually lost money because vega hurt more than delta helped.' },
      { term: 'Vol Cone', def: 'A chart showing two things on the same axes: (1) current implied volatility across each expiration (the blue line / IV term structure), and (2) the historical range of realized volatility across equivalent time horizons (the grey shaded cone). When the IV line sits above the cone, options are expensive. When it sits inside or below the cone, options are cheap. Gives a visual, Bloomberg-style read on fair value for options premium at each term.', example: 'IV term structure shows 45% at 30 DTE but the HV cone spans 20–35% at that horizon. The IV line is above the cone — sell premium at the front month.' },
      { term: 'IV Term Structure', def: 'How implied volatility varies across different expiration dates. Normally the curve is upward-sloping (contango) as more time = more uncertainty. When front-month IV exceeds back-month IV (backwardation), it signals near-term fear — an event, earnings, or crisis is driving short-term demand for options. The shape (contango/backwardation/flat/humped) tells you where the market sees the risk.' },
      { term: 'IV Expansion Play', def: 'Buying options (calls or puts) BEFORE a catalyst event specifically to profit from rising implied volatility — not just price movement. As the event approaches, IV inflates and options become more expensive. You can profit even before the stock moves.', example: 'Buy a SPY straddle 5 days before FOMC. If IV rises from 15% to 22% as the event nears, your options gain value from IV expansion alone — before the Fed even speaks.' },
      { term: 'IV Contraction Play', def: 'Selling options (iron condors, strangles, credit spreads) when IV is elevated, betting that it will decline back to normal. Common strategy after earnings or major events when IV spikes then crashes.', example: 'Sell a QQQ iron condor the morning AFTER earnings when IV is still elevated. As IV returns to baseline over the next week, the premium you sold deflates and you profit.' },
      { term: 'Volatility Skew', def: 'OTM puts typically have higher IV than OTM calls (the "volatility smirk") because investors pay more for downside protection. Steep skew = bearish sentiment. Flat or inverted skew (calls > puts) = aggressive bullish positioning or short squeeze potential.', example: 'SPY 5% OTM put at 22% IV vs 5% OTM call at 14% IV = steep put skew = market is paying a big premium for downside insurance. Bearish underlying tone.' },
      { term: 'Volatility Smile', def: 'When both OTM puts AND OTM calls have higher IV than ATM — shaped like a smile. More common in individual high-volatility stocks and crypto options. Indicates the market is pricing in a big move in either direction.' },
    ],
  },
  {
    name: 'Flow & Volume',
    emoji: '💰',
    terms: [
      { term: 'Sweep Order', def: 'A large options order that fills across multiple exchanges simultaneously, indicating urgency. Sweeps suggest the buyer doesn\'t want to wait — they believe a move is imminent. They are willing to pay up across every available venue to fill their full size immediately.' },
      { term: 'Golden Sweep', def: 'A sweep order worth $1M+ in premium that is also bought on the ASK side (aggressive buying). Considered the strongest institutional conviction signal in options flow. When you see a Golden Sweep in a name, ask: what do they know that the market doesn\'t?', example: 'NVDA shows a Golden Sweep — $2.3M in call premium, bought at the ask, sweeping 8 exchanges. That\'s an institution making a very urgent, very large directional bet.' },
      { term: 'Block Trade', def: 'A single very large options order (typically $500K+ in premium) negotiated privately, appearing on a single exchange. Unlike sweeps, blocks are less urgent — but they signal a major institution quietly entering a position without broadcasting urgency.' },
      { term: 'Vol/OI Ratio', def: 'Today\'s volume divided by open interest. A ratio above 2× means new positions are being opened (not existing positions closing). A ratio above 5–10× is a strong unusual signal — someone is making a fresh, large directional bet.', example: 'A strike has OI of 400, but today sees volume of 5,000. Vol/OI = 12.5×. This is extremely unusual — someone opened 12× the existing interest in a single session.' },
      { term: 'Unusual Options Activity (UOA)', def: 'When options volume significantly exceeds normal levels, especially with high Vol/OI ratios, large premium size, and aggressive fills. The UOA score in this app combines 6+ factors (premium, vol/OI, aggression, DTE, moneyness, catalyst, repeat) into a 0–100 composite score. EXTREME (≥85) signals are the rarest and most significant.' },
      { term: 'Repeat Flow', def: 'When the same strike and expiration sees continued buying over multiple consecutive days. Suggests accumulation — an institution building a large position gradually to avoid moving the market. Repeat flow at the same strike over 3+ days is considered a very strong conviction signal.' },
      { term: 'Put/Call Ratio', def: 'Total put volume divided by total call volume. Above 1.0 = more puts than calls (bearish). Below 0.7 = more calls (bullish). Often used as a CONTRARIAN indicator — extreme put/call ratios at market bottoms signal too much fear (buy signal), and very low ratios at tops signal too much complacency (potential sell signal).' },
      { term: 'Max Pain', def: 'The strike price where the maximum number of options would expire worthless — causing the greatest loss to options BUYERS collectively. Market makers benefit when price pins near max pain at expiration. Stock prices have a tendency to gravitate toward max pain in the final days before expiration as market makers manage their exposure.', example: 'SPY max pain is $480 for Friday expiration. On Wednesday, SPY is at $487. Over the next two days, pinning toward $480 is possible as market makers reduce their hedges.' },
      { term: 'OI Profile', def: 'A visualization of open interest (total outstanding contracts) across all strike prices. Shows where the most contracts are concentrated. Heavy OI at a strike creates a "gravitational" effect — institutions with large positions there will defend or target those levels. The strike with the most call OI often acts as resistance; the most put OI often acts as support.', example: 'SPY has 100,000 calls at $500 strike. This is a massive "call wall" — market makers who sold those calls are short gamma there and will sell stock aggressively if price approaches $500 to hedge.' },
      { term: 'GEX (Gamma Exposure)', def: 'The total gamma held by market makers, aggregated across all strikes and weighted by open interest. GEX tells you how market makers will HEDGE as price moves. Positive GEX at a level = market makers will buy low / sell high (dampening volatility). Negative GEX = market makers will buy when rising / sell when falling (amplifying volatility). Used to understand whether the options market is currently suppressing or accelerating price moves.', example: 'SPY has +$5B GEX at $480. As SPY approaches $480 from below, market makers sell stock to hedge their gamma — acting as a natural ceiling. This is why stocks often get "pinned" near high-GEX strikes.' },
      { term: 'GEX Flip Point', def: 'The price level where net gamma exposure crosses from positive to negative (or vice versa). Below the flip point, market makers AMPLIFY moves (negative GEX zone). Above it, they DAMPEN moves (positive GEX zone). The flip point is one of the most important levels to watch — it\'s where the market\'s "character" changes.', example: 'SPY flip point is at $470. Below $470, every move down feeds more selling from market maker hedging (amplification). Above $470, selling is absorbed and volatility compresses. The flip point is like a volatility switch.' },
      { term: 'GEX Regime', def: 'POSITIVE GEX: Market makers are net long gamma. Their hedging (sell high / buy low) naturally dampens volatility and helps the market range. Good for selling premium strategies. NEGATIVE GEX: Market makers are net short gamma. Their hedging amplifies moves — a drop gets worse, a rally gets more extreme. Higher volatility, harder to trade. Negative GEX often precedes breakouts and sharp selloffs.' },
      { term: 'Call Wall / Put Wall', def: 'The strike prices with the largest open interest concentrations on each side. Call Wall = strike with most call OI, often acts as near-term resistance as market makers sell stock to hedge there. Put Wall = strike with most put OI, often acts as near-term support as market makers buy stock to hedge there. These walls shift week to week as positions roll.', example: 'SPY call wall at $490, put wall at $465. This defines the "pin zone" — SPY will likely trade between these levels through expiration. A break above $490 with volume would signal a breakout.' },
      { term: 'Implied Probability', def: 'The market\'s estimated probability that a stock will finish above (for calls) or below (for puts) a specific strike at expiration, derived directly from option prices. A call with 25% delta has roughly 25% implied probability of expiring ITM. OTM options with 10% delta have about 10% probability of paying off. Used to assess whether options are fairly priced for directional bets.', example: 'NVDA 30-day $200 call has 35% delta = ~35% implied probability of NVDA being above $200 in 30 days. If you think the true probability is 50%, that call is cheap.' },
      { term: 'Overnight OI Change', def: 'The difference in open interest between yesterday\'s close and today\'s open, published each morning. A large OI increase means significant NEW positions were opened. A large OI decrease means mass position closing. Traders watch overnight OI changes to detect when institutions add or exit large positions after the close.', example: 'AAPL $195 call shows +15,000 OI overnight. That\'s 15,000 new contracts — $1.5M+ in new long call exposure opened after yesterday\'s close. Someone made a big overnight bet.' },
      { term: 'Premium-Weighted P/C Ratio', def: 'Put/call ratio calculated using dollar premium (price × contracts × 100) instead of just volume counts. More accurate than raw volume because it weights large, expensive trades appropriately. A single $5M put sweep should matter more than 100 cheap OTM put contracts. Premium-weighted P/C > 1.0 = bears are spending more money on downside protection.' },
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
      { term: 'Vertical Spread', def: 'Any options strategy using two options of the same type and expiration but different strikes. Includes bull call spreads and bear put spreads. Defines both max risk and reward. The most common defined-risk options trade.' },
      { term: 'Strangle', def: 'Buy an OTM call AND an OTM put (different strikes, same expiration). Cheaper than a straddle because both legs are out of the money. Profits from a large move in either direction but requires a bigger move than a straddle to be profitable. Often used before earnings when you expect a large but uncertain move.', example: 'Buy TSLA $300 call + $250 put for $8 total. Stock needs to move above $308 or below $242 to profit at expiration.' },
      { term: 'Calendar Spread', def: 'Buy a far-dated option and sell a near-dated option at the SAME strike. Profits from time decay difference: the near-term option decays faster. Also benefits from IV expansion. A calendar is essentially a bet that the stock stays near the strike through the near-term expiration, then moves by the far-term expiration.', example: 'Sell AAPL $200 call expiring in 2 weeks, buy AAPL $200 call expiring in 6 weeks. Net cost = $1.50. If AAPL stays near $200 for 2 weeks, the sold call expires worthless and you own the longer-dated call almost free.' },
      { term: 'Credit Spread', def: 'Any options spread where you collect more premium than you pay — you receive a net credit. The credit received is your maximum profit; the difference in strikes minus the credit is your maximum loss. All credit spreads are defined risk. Examples: bull put spread (bullish), bear call spread (bearish), iron condor (neutral).', example: 'Sell SPY $450 put / Buy SPY $445 put for $1.50 net credit. Max profit = $150 per contract (if SPY stays above $450). Max loss = $350 per contract (if SPY drops below $445).' },
      { term: 'Debit Spread', def: 'An options spread where you pay more premium than you receive — net debit. Lower cost and lower max loss than buying a naked option, but caps maximum profit. Bull call spread and bear put spread are the most common. A $5-wide debit spread that costs $2 has max risk of $200 and max profit of $300 per contract.' },
      { term: 'Collar', def: 'Owning stock + buying a protective put + selling a covered call. The call premium offsets some of the put cost. Creates a "collar" of protection: capped downside, capped upside. Favored by institutional investors to protect large stock positions without selling.', example: 'Own 100 shares of AAPL at $175. Buy $165 put ($3). Sell $185 call ($3). Net cost = $0 (costless collar). Protected from drops below $165 but give up upside above $185.' },
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
      { term: 'Beta', def: 'Measures stock\'s volatility relative to the market. Beta > 1 = more volatile than market. Beta < 1 = less volatile. Negative beta = moves opposite to market (rare — gold miners, some defensive stocks).' },
      { term: 'ROE (Return on Equity)', def: 'Net income divided by shareholders\' equity. Measures how efficiently a company uses shareholder capital to generate profits. ROE > 15% = strong. ROE > 30% = exceptional (indicates competitive moat). High-ROE businesses can command high P/B multiples because they generate outsized returns on every dollar of book value.', example: 'NVDA ROE ≈ 70%+. For every $1 of equity, NVDA generates 70 cents of profit. This is why NVDA\'s P/B ratio of 30× is not crazy — the return on that book value is extraordinary.' },
      { term: 'P/B Ratio (Price-to-Book)', def: 'Stock price divided by book value per share. Book value = assets minus liabilities. Low P/B (< 1×) can indicate deep value or a troubled company. High P/B (> 10×) for tech/software is often justified when ROE is very high — asset-light businesses generate huge returns from very little balance sheet.', example: 'A bank at P/B 0.8× is cheap — you\'re buying $1 of assets for $0.80. But MSFT at P/B 15× is reasonable because its ROE > 40% justifies the premium over book value.' },
      { term: 'FCF Yield', def: 'Free cash flow per share divided by stock price, expressed as a percentage. More actionable than raw FCF — directly comparable to bond yields and earnings yields. FCF Yield above 4% generally means the stock is cheap relative to cash generation. Warren Buffett\'s preferred valuation lens: "I want to buy a business generating lots of cash relative to what I\'m paying for it."', example: 'AAPL generates $7 FCF per share. At $175 stock price, FCF Yield = 4%. Compare to a 10-year Treasury at 4.5%. AAPL\'s FCF yield is competitive with bonds AND has growth.' },
      { term: 'Relative Strength vs SPY', def: 'How much a stock outperformed or underperformed the S&P 500 over a specific period. RS +8% over 60 days means the stock beat SPY by 8 percentage points. Positive relative strength is the primary filter used by institutional investors — they rotate into market leaders and out of laggards. Ratings: STRONG LEADER (RS > +10%), LEADER (+2 to +10%), INLINE (-2 to +2%), LAGGARD (-5 to -2%), WEAK LAGGARD (< -5%).', example: 'On a day SPY falls 1%, NVDA falls 0.2%. NVDA shows relative strength — institutions are holding or even buying it into weakness. This kind of behavior repeated over weeks signals accumulation.' },
      { term: 'Earnings Per Share (EPS) Growth', def: 'Year-over-year change in net profit per share. Accelerating EPS growth (each quarter growing faster than the last) is one of the most bullish fundamental signals. Combined with revenue acceleration, it indicates a company\'s growth is both real and expanding. This is what moves stocks 200-500% over multi-year periods.' },
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
      { term: 'On-Balance Volume (OBV)', def: 'Cumulative volume indicator. Rising OBV with falling price = bullish divergence (accumulation). Falling OBV with rising price = bearish divergence (distribution). OBV is a leading indicator — divergences often precede price reversals by days to weeks.' },
      { term: 'OBV Divergence', def: 'When On-Balance Volume moves in the opposite direction from price. BULLISH divergence: price makes lower lows but OBV makes higher lows — smart money is buying into the weakness, suggesting an upside reversal. BEARISH divergence: price makes higher highs but OBV makes lower highs — institutions are quietly selling into the rally (distribution). Both are high-conviction signals when confirmed by other indicators.', example: 'SPY makes a new 3-month high, but OBV is at a 3-month low. That\'s bearish divergence — the rally is happening on declining participation. High probability of reversal.' },
      { term: 'Relative Volume (RelVol)', def: 'Today\'s trading volume divided by the 20-day average volume. RelVol of 2.0× means twice the normal activity is occurring. Why it matters: volume confirms signals. A breakout on 3× RelVol is far more significant than the same breakout on 0.6× RelVol. Low-volume breakouts fail more often. Institutional participation leaves a volume footprint.', example: 'MSFT breaks above $420 resistance. RelVol = 0.7×. Low-volume breakout — likely to fail. The same break with RelVol = 2.5× signals strong institutional participation behind the move.' },
      { term: 'CMF (Chaikin Money Flow)', def: 'Measures buying vs selling pressure over a period (typically 20 days) by combining both price position within each candle AND volume. CMF > +0.05 = net buying pressure (bullish). CMF < -0.05 = net selling pressure (bearish). CMF near 0 = neither buyers nor sellers in control. One of the best volume-weighted confirmation tools for trend analysis.', example: 'A stock makes a new high while CMF = +0.15. Volume-weighted buying pressure confirms the breakout — this is a real move, not just thin-market noise.' },
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
      { term: 'Contango / Backwardation', def: 'Terms for the IV term structure shape. Contango = near-term IV < long-term IV (normal). Backwardation = near-term IV > long-term IV (fear/crisis, or earnings approaching). Humped = mid-term IV higher than both ends, typical when a known catalyst (earnings, FDA) sits in the middle expirations.' },
      { term: 'Expected Move', def: 'The range the market prices a stock to trade within by a given expiration, derived from straddle pricing. Roughly ±1 standard deviation — meaning the market estimates ~68% probability the stock finishes within this range. Calculated as: ATM straddle price ÷ current price. Use it to: (1) set realistic price targets, (2) evaluate whether a stock actually moves more than expected (vol expansion opportunity), (3) size iron condors and strangles.', example: 'AAPL earnings in 14 days. ATM straddle costs $8. Stock at $190. Expected move = $8/$190 = ±4.2% → market expects AAPL to stay between $182 and $198. If you think AAPL moves 8%, the straddle is cheap.' },
      { term: 'Liquidity', def: 'How easily you can buy and sell an option without moving its price. Measured by bid-ask spread: tight spreads (< 5% of mid price) = high liquidity, easy to trade. Wide spreads (> 15%) = low liquidity, you\'ll lose money just entering and exiting. Always check the spread before trading options. SPY and SPX have the tightest spreads. Small-cap options can have 20-50% spreads that make them nearly untradeable.' },
      { term: 'Assignment Risk', def: 'The risk that if you sell (short) an option that expires ITM, you may be obligated to buy or deliver 100 shares. Selling covered calls risks having shares called away. Selling puts risks being forced to buy shares at the strike. Early assignment can happen anytime on American-style options, especially around ex-dividend dates. Manage by closing ITM short options before expiration.' },
      { term: 'FOMC (Federal Open Market Committee)', def: 'The Federal Reserve committee that sets US interest rates. FOMC meetings (8 per year) are major market-moving events. Rate decisions, dot plots, and Chair press conferences can move the entire market 1-3% in minutes. Options IV for SPY, QQQ, and most large-caps spikes in the days leading up to FOMC and crushes immediately after.' },
    ],
  },
  {
    name: 'App Signals & Scores',
    emoji: '🤖',
    terms: [
      { term: 'Heat Score (Scanner)', def: 'The scanner\'s proprietary momentum + volume composite score (0–100+) used to rank the 180+ tickers by activity. Two components: Momentum (0–60 pts) based on % price change (5% move = full 60 pts), and Volume Surge (0–40 pts) based on today vs 20-day average (2× avg = 20 pts, 3× avg = 40 pts). A Heat Score above 50 means a ticker has both price momentum AND elevated volume — the two most reliable signals that something is happening.', example: 'NVDA up 4.2% on 2.4× average volume → Momentum score: 50, Volume score: 28 → Heat = 78. Top of the scanner. Worth investigating.' },
      { term: 'UOA Score (Unusual Options Score)', def: 'Composite 0–100 signal rating the significance of an unusual options trade. Six factors: Premium size (30 pts) — how much money was at risk; Vol/OI ratio (20 pts) — how new the position is; Aggression (20 pts) — was it bought at the ask; DTE (15 pts) — time horizon; Moneyness (10 pts) — how far OTM; plus adjustments for catalysts, repeat flow, and hedge discounts. Tiers: EXTREME (≥85), VERY_HIGH (70–84), HIGH (55–69), MEDIUM (40–54), LOW (<40). Focus on EXTREME and VERY_HIGH.', example: 'NVDA $150 call, $2.3M premium, 5× Vol/OI, bought at ask, 21 DTE, 8% OTM → UOA Score 91 = EXTREME. This is an institution making a large, urgent, directional bet.' },
      { term: 'IV History Days', def: 'How many daily ATM IV readings the app has stored in its database for a specific ticker. This determines whether IV Rank and IV Percentile are REAL (based on actual historical data) or ESTIMATED (based on HV anchoring). When ≥20 days: the Volatility Premium widget shows a green badge and uses true historical comparison — identical to Bloomberg methodology. When <20 days: an amber "est." badge appears and the app uses an HV-anchored estimate. IV Rank becomes more accurate as more days accumulate over weeks and months.' },
      { term: 'Relative Strength Ratings', def: 'The app\'s classification of a stock\'s RS vs SPY score into five tiers. STRONG LEADER: outperforming SPY by >10% over 60 days — a confirmed market leader with institutional tailwinds. LEADER: +2 to +10% — above average performance. INLINE: -2 to +2% — moving with the market. LAGGARD: -5 to -2% — underperforming, weak relative demand. WEAK LAGGARD: below -5% — institutional selling or fundamental deterioration. The rating shown is based on the 60-day RS, the most widely used institutional timeframe.', example: 'During a 10% SPY correction, if a stock drops only 3%, its 60d RS is +7% — rating = LEADER. Institutions clearly accumulated it during the dip.' },
      { term: '24-Point Stock Score', def: 'The app\'s composite stock analysis score: 12 fundamental points + 12 technical points. Fundamental factors include ROE, P/E (growth-adjusted), P/B (ROIC-adjusted), revenue growth, EPS growth, D/E, FCF yield, PEG, EV/EBITDA. Technical factors include SMA structure, MACD, RSI momentum zone, 52-week position, relative volume, ADX trend strength, CMF, and OBV divergence. Score ≥18/24 = strong bullish case. Score ≤8/24 = avoid or consider bearish strategies.' },
      { term: 'Market Regime', def: 'The app\'s classification of the current market environment based on ADX and trend data. BULLISH_TREND: price above both SMAs, ADX > 25. BEARISH_TREND: price below both SMAs, ADX > 25. WEAK_TREND: directional but ADX < 25. RANGE: price oscillating between support/resistance, low ADX. HIGH_VOL: elevated volatility regardless of trend direction. The regime adjusts scoring thresholds and strategy recommendations — high-vol regimes penalize low-confidence trades.' },
      { term: 'Evidence Packet', def: 'The app\'s transparent record of every factor and data point that contributed to a trade recommendation or score. Each packet includes SHA-256 hashes of the input data for auditability. This allows you to see exactly why the algorithm rated a stock or flagged an unusual trade — not just the conclusion, but the full reasoning chain. Inspired by institutional quantitative research standards.' },
      { term: 'GEX Flip Point (App Context)', def: 'Shown as an amber divider line in the GEX chart. The strike where gamma exposure transitions from net positive (dampening) to net negative (amplifying). Below this level, market makers\' hedging amplifies downside moves. Above it, they naturally absorb volatility. Watching whether price is above or below the flip point helps frame your directional bias and expected volatility for the day.' },
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
