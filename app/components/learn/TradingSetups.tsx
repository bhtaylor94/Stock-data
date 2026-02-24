'use client';
import React, { useState, useMemo } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────────

type Outlook    = 'bullish' | 'bearish' | 'neutral' | 'volatile';
type Difficulty = 'beginner' | 'intermediate' | 'advanced';
type IVEnv      = 'low' | 'high' | 'any';

interface TradeExample {
  scenario: string;
  setup: string[];
  profitCase: string;
  lossCase: string;
}

interface TradingSetup {
  id: string;
  name: string;
  emoji: string;
  category: string;
  outlook: Outlook;
  difficulty: Difficulty;
  ivEnv: IVEnv;
  idealDTE: string;
  tagline: string;
  whatIsIt: string;
  whenToUse: string[];
  setupSteps: string[];
  maxLoss: string;
  maxProfit: string;
  breakeven: string;
  example: TradeExample;
  risks: string[];
  tips: string[];
}

// ── Data ──────────────────────────────────────────────────────────────────────

const SETUPS: TradingSetup[] = [
  // ── 1. Long Call ──────────────────────────────────────────────────────────
  {
    id: 'long-call',
    name: 'Long Call',
    emoji: '🚀',
    category: 'Directional',
    outlook: 'bullish',
    difficulty: 'beginner',
    ivEnv: 'low',
    idealDTE: '30–60 days',
    tagline: 'Bet on a stock rising with strictly limited risk',
    whatIsIt:
      'Buy a call option to profit when a stock climbs above the strike price plus the premium you paid. Your maximum loss is exactly the premium you paid — nothing more, no matter how far the stock falls. Your upside is unlimited.',
    whenToUse: [
      'Stock breaking out above key resistance on above-average volume',
      'Bullish catalyst: earnings beat, product launch, FDA approval, guidance raise',
      'Institutional call sweep or block trade detected on the flow scanner',
      'IV Rank is below 30% — options are relatively cheap to buy',
      'Sector momentum is strong and the stock is a sector leader',
    ],
    setupSteps: [
      'Confirm a bullish catalyst or clean technical breakout with volume',
      'Select strike: ATM for higher probability, or 5–10% OTM for leverage',
      'Choose DTE: minimum 30–45 days. Never buy < 14 DTE — theta eats you alive',
      'Size appropriately: risk no more than 2–3% of your account on one call',
      'Plan your exits BEFORE you enter: take profit at 50–100% gain, stop out at 50% loss',
      'Buy to open the call — your broker will deduct the premium immediately',
    ],
    maxLoss: 'Premium paid (100% of what you spent)',
    maxProfit: 'Unlimited — grows with every dollar above breakeven',
    breakeven: 'Strike price + premium paid',
    example: {
      scenario:
        'NVDA is at $875. A golden sweep just crossed: 2,000 contracts of the $900 Call in 30 days, $3.2M premium. Technicals show a breakout above $860 resistance. IV Rank is 22% — options are cheap.',
      setup: [
        'Buy 1× NVDA $900 Call (45 DTE) at $18.00 → cost: $1,800',
        'Breakeven: $918 at expiration',
        'Profit target: $36+ (100% gain) → close when option is worth $3,600',
        'Stop loss: option drops to $9.00 (50% loss) → cut and walk away',
      ],
      profitCase:
        'NVDA rallies to $960. The $900 Call is now deep ITM, worth ~$64 → profit: $4,600 on $1,800 invested (+256%).',
      lossCase:
        'NVDA fails and drops to $820. The $900 Call expires worthless → lose $1,800. That\'s the max loss. NVDA can go to $0 and you still only lose $1,800.',
    },
    risks: [
      'Theta decay: even if the stock is flat, you lose money every day',
      'IV crush: buying before earnings can result in a loss even if the stock moves your way',
      'Too OTM: stock never reaches your strike and expires worthless',
      'Over-sizing: a few bad trades can devastate your account',
    ],
    tips: [
      'Buy when IV Rank < 30%. Buying calls when IV is high (IV Rank > 70%) is like paying full price for a depreciating asset',
      'Use institutional flow as confirmation — if a $5M sweep just hit, you have smart money on your side',
      'Follow the "21/50 rule": consider closing when 21 days remain OR when you\'ve made 50% of max possible gain',
      'Never buy a call the day before earnings unless you understand IV crush',
    ],
  },

  // ── 2. Long Put ──────────────────────────────────────────────────────────
  {
    id: 'long-put',
    name: 'Long Put',
    emoji: '📉',
    category: 'Directional',
    outlook: 'bearish',
    difficulty: 'beginner',
    ivEnv: 'low',
    idealDTE: '30–60 days',
    tagline: 'Profit from a falling stock — also the cleanest portfolio hedge',
    whatIsIt:
      'Buy a put option to profit when a stock falls below the strike minus the premium paid. Like a call, your max loss is capped at the premium. Used for directional bearish bets AND as portfolio insurance against a crash.',
    whenToUse: [
      'Stock breaking down below key support on heavy volume',
      'Failed earnings report — miss + lowered guidance',
      'Institutional put sweeps or block trades detected in the flow scanner',
      'Macro headwinds: hot CPI, hawkish FOMC, rising yields hitting growth stocks',
      'Technical breakdown: stock below 200-day MA, death cross forming, RSI divergence',
      'Hedging: buy SPY puts to protect a long stock portfolio in uncertain markets',
    ],
    setupSteps: [
      'Confirm a bearish catalyst or breakdown below key support with volume',
      'Select strike: ATM for highest probability, or 5–10% OTM for lower cost/higher leverage',
      'Choose DTE: 30–60 days minimum to give the thesis time to play out',
      'Size to 2–3% of account maximum per trade',
      'Set your exit plan: take profit at 50–100% gain, stop at 50% loss',
      'Buy to open the put — premium is debited from your account immediately',
    ],
    maxLoss: 'Premium paid (the option goes to $0 if stock stays above strike)',
    maxProfit: 'Strike − premium paid (stock going to $0, theoretical maximum)',
    breakeven: 'Strike price − premium paid',
    example: {
      scenario:
        'TSLA breaks below $200 support on big volume after a production miss. Institutional put flow: 1,500 contracts of the $190 Put swept for $900K. RSI showing bearish divergence.',
      setup: [
        'Buy 1× TSLA $190 Put (45 DTE) at $10.00 → cost: $1,000',
        'Breakeven: $180 at expiration',
        'Profit target: $20+ (100% gain) → take profits when put hits $2,000',
        'Stop loss: put drops to $5.00 (50% loss) → exit',
      ],
      profitCase:
        'TSLA sells off to $155 over the next 3 weeks. Put is now worth ~$38 → profit: $2,800 on $1,000 invested (+280%).',
      lossCase:
        'TSLA reverses and bounces back to $220. Put expires worthless → lose $1,000 (max loss).',
    },
    risks: [
      'Short squeezes: stocks with high short interest can explode upward on any good news',
      'Central bank or company buybacks can artificially prop up falling stocks',
      'IV crush after a catalyst even if the stock moves down somewhat',
      'Theta — every day without a move costs you time value',
    ],
    tips: [
      'For portfolio hedging, use SPY or QQQ puts rather than single stocks — cleaner and more liquid',
      'Confirm with at least 2 bearish signals before buying: technical + flow OR technical + fundamental',
      'Don\'t fight the overall market trend. A bearish single stock bet against a raging bull market is fighting two enemies',
      'Puts are insurance — having some in your portfolio is smart risk management, not pessimism',
    ],
  },

  // ── 3. Bull Call Spread ────────────────────────────────────────────────────
  {
    id: 'bull-call-spread',
    name: 'Bull Call Spread',
    emoji: '📐',
    category: 'Spread',
    outlook: 'bullish',
    difficulty: 'intermediate',
    ivEnv: 'high',
    idealDTE: '21–45 days',
    tagline: 'A cheaper bullish bet with defined risk and capped reward',
    whatIsIt:
      'Buy a call at a lower strike and simultaneously sell a call at a higher strike — same expiration. The sold call reduces your cost significantly but caps your maximum profit at the difference between the strikes. Use this when you\'re bullish but not expecting a massive move, or when IV is high and buying a naked call would be too expensive.',
    whenToUse: [
      'Bullish but IV is elevated — the call you sell reduces your inflated cost',
      'You have a specific price target in mind (that\'s where you sell the upper call)',
      'Expecting a moderate, measured move — not a parabolic squeeze',
      'Stock near support, expecting a rally to nearby resistance',
      'Earnings play: you expect a beat but not a massive gap-up',
    ],
    setupSteps: [
      'Identify a bullish thesis and a realistic price target',
      'Buy a call at or near the money (your entry strike)',
      'Sell a call at your target price — same expiration (this is your profit cap)',
      'Net debit = price of long call − premium from short call',
      'Max profit = (spread width − net debit) × 100',
      'Aim for a minimum 1:2 risk-to-reward ratio (risk $1 to make $2)',
      'Close the spread at 50–75% of max profit. Don\'t be greedy waiting for the final $0.20',
    ],
    maxLoss: 'Net debit paid (if stock closes below your long call strike)',
    maxProfit: '(Spread width − net debit) × 100 contracts',
    breakeven: 'Long call strike + net debit paid',
    example: {
      scenario:
        'SPY is at $485 after a brief pullback to support. You expect a rally to $495 over 30 days. IV Rank is 45% — options are expensive, so a spread makes more sense than a naked call.',
      setup: [
        'Buy SPY $487 Call (30 DTE) for $5.20',
        'Sell SPY $495 Call (30 DTE) for $3.40',
        'Net debit: $1.80 per spread ($180 total)',
        'Max profit: $8.00 − $1.80 = $6.20 per spread ($620 total)',
        'Breakeven: $488.80',
        'Risk/reward: risk $180 to make $620 (3.4:1)',
      ],
      profitCase:
        'SPY rallies to $497. Both calls are ITM, the spread is worth the full $8.00 → profit: $620 on $180 invested (+344%).',
      lossCase:
        'SPY drops to $480. Both calls expire worthless → lose $180 (max loss). Much better than a naked $487 call which would have cost $520 and also lost everything.',
    },
    risks: [
      'Capped upside: if SPY rockets to $510, you still only make $620. A naked call would have made much more',
      'Both legs must be managed together — you can\'t just close one leg carelessly',
      'Early assignment risk: if your short call goes deep ITM near expiration, the buyer may exercise',
    ],
    tips: [
      'Use spreads when IV Rank is above 40% — the sold call offsets expensive premium significantly',
      'Put your short call at your honest price target. Not the moon — where you realistically expect the stock to be',
      'The spread width should equal your expected price move. A $8 spread for a $5 expected move doesn\'t make sense',
      'Close at 50% of max profit to lock in gains and free up capital for the next trade',
    ],
  },

  // ── 4. Bear Put Spread ─────────────────────────────────────────────────────
  {
    id: 'bear-put-spread',
    name: 'Bear Put Spread',
    emoji: '📏',
    category: 'Spread',
    outlook: 'bearish',
    difficulty: 'intermediate',
    ivEnv: 'high',
    idealDTE: '21–45 days',
    tagline: 'A defined-risk bearish bet at a fraction of a long put\'s cost',
    whatIsIt:
      'Buy a put at a higher strike and sell a put at a lower strike — same expiration. The sold put reduces your cost significantly but caps gains at the spread width. This is the bearish equivalent of a bull call spread. Use it when you expect a measured decline to a specific level, not a total collapse.',
    whenToUse: [
      'Stock failing at resistance multiple times — clear downside target',
      'High IV environment — selling the lower put offsets expensive premium',
      'Earnings play: you expect a miss but a measured decline, not a crash',
      'Stock in a clear downtrend with a realistic target price',
      'Macro headwind hitting a specific sector with a defined decline in mind',
    ],
    setupSteps: [
      'Identify a bearish thesis and your realistic downside target price',
      'Buy a put at or near the money (your entry strike)',
      'Sell a put at your price target (lower strike, same expiration)',
      'Net debit = price of long put − premium from short put',
      'Max profit = (spread width − net debit) × 100',
      'Aim for 1:2 risk-to-reward minimum',
      'Close at 50–75% of max profit — don\'t wait for the last few dollars',
    ],
    maxLoss: 'Net debit paid (stock stays above your long put strike)',
    maxProfit: '(Spread width − net debit) × 100',
    breakeven: 'Long put strike − net debit paid',
    example: {
      scenario:
        'QQQ at $415, failing repeatedly at $420 resistance. Tech sector under pressure from rising yields. IV Rank is 55%. You expect QQQ to pull back to $400 over the next month.',
      setup: [
        'Buy QQQ $412 Put (30 DTE) for $6.50',
        'Sell QQQ $400 Put (30 DTE) for $3.20',
        'Net debit: $3.30 per spread ($330 total)',
        'Max profit: $12 − $3.30 = $8.70 per spread ($870)',
        'Breakeven: $408.70',
        'Risk/reward: risk $330 to make $870 (2.6:1)',
      ],
      profitCase:
        'QQQ drops to $397. Full spread profit: $870 on $330 invested (+164%).',
      lossCase:
        'QQQ rallies to $425. Both puts expire worthless → lose $330 (max loss).',
    },
    risks: [
      'Capped downside gains: if QQQ crashes to $380, you still only make $870',
      'Your short put caps profits — if stock collapses below your short strike, you leave money on the table',
      'Early assignment risk on the short put if it goes deep ITM near expiration',
    ],
    tips: [
      'Match the spread to your genuine price target. If you think QQQ goes to $395, sell the $395 put, not $400',
      'In high-IV environments, the credit you receive for the short put can be 50-60% of the debit — very efficient',
      'Use vertical spreads for earnings rather than naked puts/calls — the defined risk lets you sleep at night',
      'Width matters: a $20-wide spread gives more room and max profit than a $5-wide spread',
    ],
  },

  // ── 5. Covered Call ────────────────────────────────────────────────────────
  {
    id: 'covered-call',
    name: 'Covered Call',
    emoji: '💼',
    category: 'Income',
    outlook: 'neutral',
    difficulty: 'beginner',
    ivEnv: 'high',
    idealDTE: '14–30 days',
    tagline: 'Generate monthly income from shares you already own',
    whatIsIt:
      'Own 100 shares of a stock AND sell an OTM call against them. You collect the premium immediately and keep it no matter what. If the stock stays below your strike at expiration, the call expires worthless and you repeat. If the stock rises above your strike, your shares get "called away" at that price — you still profit, just with capped upside. It\'s the most widely used options strategy in the world.',
    whenToUse: [
      'You own 100+ shares of a stock and expect it to be flat or slightly up',
      'IV is elevated — richer premium to collect',
      'You\'d be comfortable selling your shares at the strike price',
      'Monthly income generation goal on existing holdings',
      'Stock near strong resistance — unlikely to break out soon',
    ],
    setupSteps: [
      'Ensure you own 100 shares of the stock (required — this is "covered")',
      'Sell 1 call contract per 100 shares you own',
      'Choose strike: 5–10% OTM — you want it to expire worthless, but not so far it pays nothing',
      'Choose DTE: 21–30 days for maximum theta decay',
      'Collect premium immediately — it appears in your account the next day',
      'If stock stays below strike at expiration: option expires, you keep premium, sell again next month',
      'If stock rises above strike: shares may be called away. You still keep the premium AND sell at the strike',
    ],
    maxLoss: 'Shares falling (same risk as holding stock). Premium collected provides a small buffer.',
    maxProfit: 'Premium received + (strike − your share purchase price)',
    breakeven: 'Share cost basis − premium received per share',
    example: {
      scenario:
        'You own 100 AAPL shares purchased at $175. AAPL is now at $186. You\'re slightly bullish but don\'t expect a major move. IV Rank is 42% — premium is juicy.',
      setup: [
        'Own: 100 AAPL shares at $186',
        'Sell: 1× AAPL $195 Call (21 DTE) for $2.50 → collect $250 immediately',
        'Your shares are "covered" — you could fulfill the call if assigned',
        'Annual income potential: ~12 covered calls × $250 = $3,000/year on $18,600 of stock (~16% yield)',
      ],
      profitCase:
        'AAPL stays below $195 at expiration. Call expires worthless, you keep $250. Repeat next month. Over a year: $250 × 12 = $3,000 in income from your $18,600 position.',
      lossCase:
        'AAPL rockets to $210. Your call gets exercised — you must sell your 100 shares at $195. You miss the gains from $195 to $210 ($1,500 left on the table). You still made $195 + $2.50 = $197.50 effective sale price — profitable, just not as much as you would have without the covered call.',
    },
    risks: [
      'You miss out on any upside above your strike. If AAPL goes to $250, you only got $195',
      'Shares can still fall — the $250 premium only offsets a small decline',
      'Tax implications: assignment can trigger a taxable event if you sell shares',
      'Psychologically painful when a stock you own rockets past your short strike',
    ],
    tips: [
      'Only sell covered calls on positions where you\'d be happy selling at the strike. If you\'d be upset selling at $195, don\'t sell the $195 call',
      'Don\'t write covered calls on your highest-conviction, long-term holdings — you\'ll sell them at the wrong time',
      'High IV periods (after earnings, market selloffs) are the best time to sell — the premiums are much richer',
      'Buy back the call early (at 50% of premium) to free up the stock and redeploy into the next month. Don\'t wait for expiration',
    ],
  },

  // ── 6. Cash-Secured Put ────────────────────────────────────────────────────
  {
    id: 'cash-secured-put',
    name: 'Cash-Secured Put',
    emoji: '💰',
    category: 'Income',
    outlook: 'neutral',
    difficulty: 'beginner',
    ivEnv: 'high',
    idealDTE: '14–30 days',
    tagline: 'Get paid to buy a stock at a discount — or just collect the premium',
    whatIsIt:
      'Sell an OTM put and set aside enough cash to buy the shares if assigned. You collect premium immediately. If the stock stays above your strike, the put expires worthless — you keep the cash. If it falls below, you\'re obligated to buy 100 shares at your strike price — but that\'s a price you chose because you wanted to own the stock there. You get shares at a discount AND you already collected the premium. Statistically, this is one of the highest win-rate strategies in options trading.',
    whenToUse: [
      'A stock you genuinely want to own at a lower price',
      'IV is elevated — premium is rich relative to the risk taken',
      'Stock trading near support — downside feels limited',
      'Monthly income generation without owning shares yet',
      'After a market selloff: premiums spike, creating excellent put-selling opportunities',
    ],
    setupSteps: [
      'Identify a stock you would genuinely be happy owning at your strike price',
      'Set aside the full cash collateral: strike × 100 shares',
      'Sell 1 OTM put at your desired buy price (below current price)',
      'Choose DTE: 21–30 days',
      'Collect premium immediately',
      'If stock stays above strike: keep premium, repeat the following month',
      'If stock falls below strike and you\'re assigned: buy 100 shares at the strike (your effective cost basis = strike − premium)',
    ],
    maxLoss: 'Stock goes to $0 minus premium received (same as owning shares at assignment — offset by premium)',
    maxProfit: 'Premium received',
    breakeven: 'Strike price − premium received',
    example: {
      scenario:
        'MSFT is trading at $395. You\'ve been waiting to buy it at $380 for months. IV Rank is 48% after a brief market dip. Great put-selling opportunity.',
      setup: [
        'Cash reserved: $380 × 100 = $38,000 (held in your account)',
        'Sell 1× MSFT $380 Put (30 DTE) for $5.00 → collect $500',
        'Breakeven: $375 (you start losing relative to just owning at $380)',
        'If assigned: effective MSFT cost basis = $375/share (5% below where you\'d buy it anyway)',
      ],
      profitCase:
        'MSFT stays above $380 at expiration. Put expires worthless, you keep $500 (~1.3% return in 30 days, or ~16% annualized). Repeat next month.',
      lossCase:
        'MSFT drops to $362 and you\'re assigned 100 shares at $380. Effective cost basis: $375. MSFT is now at $362 — you\'re down $13/share on paper. But you wanted to own MSFT and you got it cheaper than the original $395 price. Hold or sell covered calls to generate more income.',
    },
    risks: [
      'Large capital requirement: you must have the full cash reserved ($38,000 for a $380 strike)',
      'If the stock crashes hard, you\'re buying a falling knife at your strike',
      'Never sell puts on stocks you don\'t genuinely want to own long-term',
      'Don\'t sell on high-IV junk stocks — the premium is high because the risk is real',
    ],
    tips: [
      'Treat this as "getting paid to place a limit buy order." Your strike IS your desired entry price',
      'The wheel strategy: sell cash-secured puts → get assigned → sell covered calls → get called away → repeat',
      'SPY and QQQ cash-secured puts are statistically some of the most profitable options trades over long periods',
      'Buy back early at 50% of premium (don\'t wait for expiration) and roll to next month to maximize income',
    ],
  },

  // ── 7. Long Straddle ──────────────────────────────────────────────────────
  {
    id: 'long-straddle',
    name: 'Long Straddle',
    emoji: '⚡',
    category: 'Volatility',
    outlook: 'volatile',
    difficulty: 'intermediate',
    ivEnv: 'low',
    idealDTE: '1–7 days before catalyst, or 14–30 days for swing',
    tagline: 'Profit from a big move in either direction — direction doesn\'t matter',
    whatIsIt:
      'Buy an ATM call AND an ATM put at the same strike and expiration. You pay both premiums but profit if the stock makes a large enough move in EITHER direction. This is the purest "volatility bet" — you\'re not predicting direction, you\'re predicting that the stock will MOVE significantly. Most commonly used right before earnings reports.',
    whenToUse: [
      'Major catalyst approaching: earnings, FDA ruling, product launch, legal decision',
      'IV is relatively low — the straddle is cheap relative to the expected move',
      'The stock is "coiling" — tight price range before an expected breakout',
      'Binary event: FOMC, CPI, NFP — big move guaranteed, direction unclear',
      'Implied move from the straddle price is LESS than the stock\'s historical earnings move',
    ],
    setupSteps: [
      'Check the straddle price vs. historical move: if NVDA typically moves 8% on earnings and the straddle costs 5%, it\'s good value',
      'Buy 1× ATM call + 1× ATM put, same strike, same expiration',
      'Total cost = call premium + put premium',
      'Upside breakeven = strike + total premium',
      'Downside breakeven = strike − total premium',
      'The stock must move MORE than the total straddle cost to profit',
      'Exit strategy: close BOTH legs immediately after the catalyst — don\'t let IV crush destroy you',
    ],
    maxLoss: 'Total premium paid (if stock stays flat through expiration)',
    maxProfit: 'Unlimited on the call side; strike − premium on the put side',
    breakeven: 'Strike ± total premium paid',
    example: {
      scenario:
        'NVDA at $880, earnings in 3 days. Options market implies a ±5% move (~$44). But historically NVDA moves 8–12% on earnings. The straddle looks cheap relative to history.',
      setup: [
        'Buy 1× NVDA $880 Call (5 DTE) for $22.00',
        'Buy 1× NVDA $880 Put (5 DTE) for $20.00',
        'Total cost: $42.00 ($4,200)',
        'Upside breakeven: $922',
        'Downside breakeven: $838',
        'The stock must move more than 4.8% in either direction to profit',
      ],
      profitCase:
        'NVDA beats earnings massively and gaps up 12% to $986. Call worth ~$108. Profit: $6,600 on $4,200 invested (+157%). Alternatively: NVDA misses and drops 10% to $792. Put worth ~$92. Profit: $5,000.',
      lossCase:
        'NVDA beats by a small amount, stock moves 3% to $906. Implied volatility collapses (IV crush). Both options lose value rapidly. Close for $18.00 total → lose $2,400.',
    },
    risks: [
      'IV crush is the biggest risk — even a correct directional move can result in a loss if IV collapses more than the stock moves',
      'Both legs decay: theta attacks the call AND the put simultaneously',
      'The stock must move significantly more than the straddle price to profit',
      'Most earnings straddles lose money — the market tends to price earnings IV efficiently',
    ],
    tips: [
      'Always compare: straddle cost vs. historical average earnings move. Only buy if the straddle implies less than the historical average move',
      'Close the winning leg quickly after the catalyst and let the other leg ride briefly — sometimes a stock reverses',
      'Consider buying 1–2 weeks before earnings rather than the day before (IV starts rising earlier)',
      'The straddle price IS the market\'s implied move — if it costs $40 on a $880 stock, the market implies a ±4.5% move',
    ],
  },

  // ── 8. Iron Condor ─────────────────────────────────────────────────────────
  {
    id: 'iron-condor',
    name: 'Iron Condor',
    emoji: '🦅',
    category: 'Volatility',
    outlook: 'neutral',
    difficulty: 'intermediate',
    ivEnv: 'high',
    idealDTE: '21–45 days',
    tagline: 'Collect premium when the market goes sideways',
    whatIsIt:
      'Simultaneously sell an OTM call spread AND an OTM put spread. You collect net premium up front and keep all of it if the stock stays within your range ("condor wings") through expiration. This is the go-to strategy for high-IV environments and choppy, range-bound markets. You profit from time passing and IV declining — you\'re on the same side as theta and vega.',
    whenToUse: [
      'IV Rank is above 50% — you\'re selling expensive premium that should deflate',
      'Stock range-bound between clear support and resistance',
      'AFTER a high-IV event (earnings, FOMC): IV crushes, sell condors to capture the deflation',
      'Low expected near-term catalysts — no major news or events that could break the range',
      'Monthly income strategy on highly liquid underlyings like SPY, QQQ',
    ],
    setupSteps: [
      'Sell an OTM call spread: sell a call close to current price, buy a call farther OTM',
      'Sell an OTM put spread: sell a put close to current price, buy a put farther OTM',
      'Collect net premium from all 4 legs',
      'Max profit = net premium received (stock stays between short strikes)',
      'Max loss = spread width − net premium (stock breaks past outer strikes)',
      'Target: close at 50% of max profit to lock in gains quickly and remove risk',
      'Stop loss: if the spread loses 2× what you collected, close the whole condor',
    ],
    maxLoss: '(Spread width − net premium) × 100 — on whichever side breaks',
    maxProfit: 'Net premium received × 100',
    breakeven: 'Short call strike + premium (upside) / Short put strike − premium (downside)',
    example: {
      scenario:
        'SPY at $485 after a quiet week. IV Rank is 60% following recent choppiness. You expect SPY to stay between $470–$500 for the next 30 days.',
      setup: [
        'Sell SPY $500 Call / Buy SPY $505 Call (30 DTE) → collect $0.90 credit',
        'Sell SPY $470 Put / Buy SPY $465 Put (30 DTE) → collect $1.20 credit',
        'Total net credit: $2.10 ($210 per condor)',
        'Max loss: $5 − $2.10 = $2.90 ($290) per condor',
        'Profit zone: SPY stays between $467.90 and $502.10',
        'Risk/reward: risk $290 to make $210 (0.72:1 — win rate must exceed ~58% to be profitable)',
      ],
      profitCase:
        'SPY closes at $487 at expiration. All 4 options expire worthless. Keep $210 per condor. If you traded 10 condors: $2,100 profit in 30 days.',
      lossCase:
        'SPY surges to $504 past the short $500 Call. Call spread maxes out, lose $290 per condor. Close early to limit damage when SPY breaks $498.',
    },
    risks: [
      'Gap risk: a major overnight event can push the stock past both wings before you can react',
      'Uncapped loss beyond the bought strikes is capped, but the max loss can be 2× your premium collected',
      'Requires active management — not a "set and forget" strategy',
      'Win rate needs to be high enough to overcome the unfavorable risk/reward ratio',
    ],
    tips: [
      'Sell condors on SPY and QQQ — most liquid options, tightest spreads, no single-stock risk',
      'Close at 50% of max profit. Don\'t be greedy — the last 50% of profit takes 80% of the time and most of the risk',
      'Widen your strikes in high-IV environments to collect more premium per condor',
      'Manage the "tested side" (the side the stock is moving toward) by rolling it out in time or closing early',
    ],
  },

  // ── 9. Poor Man's Covered Call (PMCC) ─────────────────────────────────────
  {
    id: 'pmcc',
    name: "Poor Man's Covered Call",
    emoji: '🔄',
    category: 'Advanced',
    outlook: 'bullish',
    difficulty: 'advanced',
    ivEnv: 'any',
    idealDTE: 'LEAPS: 6–12 months · Short call: 20–45 days',
    tagline: 'The covered call strategy using 80% less capital than owning shares',
    whatIsIt:
      'Instead of owning 100 shares (expensive), buy a deep ITM LEAPS call (6–12 months out) as a "share substitute," then sell shorter-dated OTM calls against it monthly — just like a covered call. The LEAPS has a high delta (0.80+) and behaves very similarly to owning stock, but costs a fraction of the share price. This lets you run a covered call income strategy on high-priced stocks with far less capital tied up.',
    whenToUse: [
      'Bullish on a stock long-term (6–12 month view)',
      'Stock is too expensive to buy 100 shares (TSLA at $250 = $25,000 vs. ~$8,000 for ITM LEAPS)',
      'Monthly income strategy with a bullish directional bias',
      'You want covered call income but don\'t want to commit full share capital',
    ],
    setupSteps: [
      'Buy a deep ITM call option with 6–12 months to expiration (delta must be 0.80 or higher)',
      'This LEAPS call IS your "share substitute" — treat it like stock',
      'Sell a shorter-dated OTM call (20–45 DTE) against the LEAPS — same as selling a covered call',
      'Critical rule: the short call strike must be ABOVE your LEAPS strike to avoid a "short diagonal"',
      'Collect premium each month from the short call',
      'As each short call expires, sell another one at the next expiration',
      'Roll or close the LEAPS before it has less than 90 days remaining to avoid accelerating decay',
    ],
    maxLoss: 'Net debit on LEAPS − all premium collected over time from short calls',
    maxProfit: '(Short call strike − LEAPS strike) − net debit paid, when short call is assigned',
    breakeven: 'LEAPS strike + net debit − total premium collected',
    example: {
      scenario:
        'AAPL at $186, bullish long-term. Owning 100 shares costs $18,600. Instead, run a PMCC.',
      setup: [
        'Buy AAPL $155 Call (12-month LEAPS) at $38.00 → cost: $3,800 (delta: 0.84)',
        'Sell AAPL $195 Call (30 DTE) at $2.50 → collect $250',
        'Net position cost: $3,800 LEAPS − $250 = $3,550 (vs. $18,600 for 100 shares)',
        'Repeat monthly: sell the next $195 (or higher if stock rises) call each cycle',
        '12 months of selling: 12 × $250 = $3,000 in premium collected',
        'After 12 months: LEAPS cost effectively $800',
      ],
      profitCase:
        'AAPL rises to $200. Short $195 call gets assigned — you\'re forced to sell the LEAPS effectively at $195. LEAPS worth ~$45 → sell for $4,500. Plus $3,000 premium collected over the year. Total received: $7,500 on $3,800 invested (+97%).',
      lossCase:
        'AAPL drops to $155 over the year. LEAPS (bought for $38) now worth ~$10. Minus $3,000 in premium collected → net loss: ($3,800 − $3,000 − $1,000) = -$800. Far less painful than holding 100 shares at a $3,100 loss.',
    },
    risks: [
      'More complex than a simple covered call — requires managing two legs across different expirations',
      'If the stock crashes, the LEAPS loses value faster than the short call premiums can compensate',
      'Early assignment on the short call requires careful management of the LEAPS',
      'The LEAPS still has time decay (theta) — it\'s slower than a short-dated option but it\'s there',
    ],
    tips: [
      'LEAPS delta must be 0.80+ to truly mimic stock. A 0.60 delta LEAPS gives you a "leaky" covered call',
      'Keep the short call strike above your LEAPS strike at all times. Violating this creates unlimited risk',
      'Use on stocks with liquid options markets. Illiquid LEAPS have huge bid-ask spreads that eat your profit',
      'Think of the LEAPS as a 12-month mortgage on the stock — you\'re "renting" the position with monthly payment from premium',
    ],
  },

  // ── 10. Calendar Spread ────────────────────────────────────────────────────
  {
    id: 'calendar-spread',
    name: 'Calendar Spread',
    emoji: '🗓️',
    category: 'Advanced',
    outlook: 'neutral',
    difficulty: 'advanced',
    ivEnv: 'low',
    idealDTE: 'Sell: 14–30 days · Buy: 45–90 days (same strike)',
    tagline: 'Profit from time decay differences between two expirations',
    whatIsIt:
      'Buy a longer-dated option and sell a shorter-dated option at the SAME strike price. You profit because the short option decays faster than the long option. The ideal outcome: the stock sits exactly at your strike when the front-month option expires. Then you sell the next month\'s option and collect more premium, while still holding the back-month option.',
    whenToUse: [
      'Stock consolidating at a key technical level with no near-term catalyst',
      'Near-term IV is relatively low (cheap to buy the back month)',
      'You expect the stock to stay near one price level for the next 2–4 weeks',
      'Between earnings cycles — no major events in the front month',
      'You want to own a longer-dated option but need to reduce cost via the short premium',
    ],
    setupSteps: [
      'Identify a stock consolidating near a level you expect it to stay at',
      'Buy a call (or put) at that strike, 45–90 DTE — this is your long leg',
      'Sell the same strike call (or put), 14–30 DTE — this is your short leg',
      'Net debit = cost of back month − premium from front month',
      'At front-month expiration: ideally stock is still near the strike',
      'The short option expires (or is closed), back-month option retains more value',
      'Roll: sell next month\'s option to collect more premium and lower your cost further',
    ],
    maxLoss: 'Net debit paid (if stock moves far from the strike in either direction)',
    maxProfit: 'Maximized when stock pins exactly at the strike at front-month expiration',
    breakeven: 'A range around the strike — wider range = more profitable setup',
    example: {
      scenario:
        'AMD at $155, consolidating tightly between $150-$160 for 3 weeks. No earnings for 8 weeks. Low IV environment — options are cheap.',
      setup: [
        'Buy AMD $155 Call (60 DTE) for $12.00',
        'Sell AMD $155 Call (21 DTE) for $6.00',
        'Net debit: $6.00 ($600)',
        'Risk: $600 if AMD moves far from $155',
        'Reward: back-month option retains $9-10 in value if AMD stays at $155',
      ],
      profitCase:
        'AMD stays at $155 at front-month expiration. Short call expires worthless, back-month call worth ~$10. Profit: $400 on $600 invested (+67%). Now sell next month\'s $155 call for another $5 — continuing to harvest premium.',
      lossCase:
        'AMD breaks out to $175. Short $155 call goes deep ITM, back-month barely keeps up. Close both for a loss of ~$300. AMD could also drop to $135 — both options lose value, lose ~$300.',
    },
    risks: [
      'Any significant price move in EITHER direction hurts — you need the stock to stay put',
      'If near-term IV rises while far-term IV stays low, your short option gets more expensive (hurt)',
      'Requires precise prediction of both PRICE and TIME — harder than directional trades',
      'More complex management: two legs across two expirations',
    ],
    tips: [
      'Calendar spreads work best on stocks with low historical volatility and clear consolidation patterns',
      'Use ATM or at-the-level strikes — the closer the stock stays to your strike, the more you make',
      'Don\'t use calendars when a binary catalyst (earnings, FDA) is in the front-month period',
      'The "roll" is the key income mechanism — every month you sell a new front-month option to continuously lower your cost',
    ],
  },
];

// ── Filter config ──────────────────────────────────────────────────────────────

type FilterType = 'all' | Outlook | 'beginner' | 'intermediate' | 'advanced' | 'income';

const FILTERS: { id: FilterType; label: string }[] = [
  { id: 'all',          label: 'All Setups' },
  { id: 'beginner',     label: '🟢 Beginner'  },
  { id: 'bullish',      label: '📈 Bullish'   },
  { id: 'bearish',      label: '📉 Bearish'   },
  { id: 'neutral',      label: '↔️ Neutral'   },
  { id: 'volatile',     label: '⚡ Volatile'  },
  { id: 'income',       label: '💰 Income'    },
  { id: 'intermediate', label: '⚡ Intermediate' },
  { id: 'advanced',     label: '🔴 Advanced'  },
];

// ── Style helpers ──────────────────────────────────────────────────────────────

const OUTLOOK_STYLE: Record<Outlook, { border: string; badge: string; label: string }> = {
  bullish:  { border: 'border-l-emerald-500', badge: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30', label: 'Bullish'  },
  bearish:  { border: 'border-l-red-500',     badge: 'bg-red-500/15 text-red-300 border-red-500/30',             label: 'Bearish'  },
  neutral:  { border: 'border-l-blue-500',    badge: 'bg-blue-500/15 text-blue-300 border-blue-500/30',           label: 'Neutral'  },
  volatile: { border: 'border-l-amber-500',   badge: 'bg-amber-500/15 text-amber-300 border-amber-500/30',        label: 'Volatile' },
};

const DIFF_STYLE: Record<Difficulty, string> = {
  beginner:     'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
  intermediate: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
  advanced:     'bg-red-500/10 text-red-400 border border-red-500/20',
};

const IV_LABEL: Record<IVEnv, string> = {
  low:  'Low IV preferred',
  high: 'High IV preferred',
  any:  'Any IV',
};

// ── SetupCard ──────────────────────────────────────────────────────────────────

function SetupCard({ setup }: { setup: TradingSetup }) {
  const [open, setOpen] = useState(false);
  const os = OUTLOOK_STYLE[setup.outlook];

  return (
    <div className={`rounded-2xl border-l-4 border border-slate-700/50 bg-slate-800/20 overflow-hidden ${os.border}`}>
      {/* Header — always visible */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-start gap-3 px-4 py-3.5 hover:bg-slate-800/30 transition-colors text-left"
      >
        <span className="text-2xl flex-shrink-0 mt-0.5">{setup.emoji}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="text-sm font-bold text-white">{setup.name}</span>
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${os.badge}`}>
              {os.label}
            </span>
            <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${DIFF_STYLE[setup.difficulty]}`}>
              {setup.difficulty.charAt(0).toUpperCase() + setup.difficulty.slice(1)}
            </span>
            <span className="text-[10px] text-slate-500 px-2 py-0.5 rounded-full bg-slate-700/40">
              {setup.category}
            </span>
          </div>
          <p className="text-[12px] text-slate-400 leading-snug">{setup.tagline}</p>

          {/* Quick stats */}
          <div className="flex items-center gap-3 mt-2 text-[11px] text-slate-500 flex-wrap">
            <span>⏱ {setup.idealDTE}</span>
            <span>·</span>
            <span>{IV_LABEL[setup.ivEnv]}</span>
          </div>
        </div>
        {open
          ? <ChevronDown size={14} className="text-slate-500 flex-shrink-0 mt-1" />
          : <ChevronRight size={14} className="text-slate-500 flex-shrink-0 mt-1" />}
      </button>

      {/* Expanded body */}
      {open && (
        <div className="px-4 pb-5 space-y-5 border-t border-slate-700/40 pt-4">

          {/* What is it */}
          <div>
            <SectionLabel label="What Is It?" />
            <p className="text-[12px] text-slate-300 leading-relaxed">{setup.whatIsIt}</p>
          </div>

          {/* When to use */}
          <div>
            <SectionLabel label="When to Use" />
            <ul className="space-y-1">
              {setup.whenToUse.map((w, i) => (
                <li key={i} className="flex items-start gap-2 text-[12px] text-slate-400 leading-snug">
                  <span className="text-blue-500 flex-shrink-0 mt-0.5">›</span>
                  {w}
                </li>
              ))}
            </ul>
          </div>

          {/* Setup steps */}
          <div>
            <SectionLabel label="How to Set It Up" />
            <ol className="space-y-1.5">
              {setup.setupSteps.map((s, i) => (
                <li key={i} className="flex items-start gap-2.5 text-[12px] text-slate-400 leading-snug">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-slate-700 text-slate-300 text-[10px] font-bold flex items-center justify-center mt-0.5">
                    {i + 1}
                  </span>
                  {s}
                </li>
              ))}
            </ol>
          </div>

          {/* Risk / Reward */}
          <div>
            <SectionLabel label="Risk / Reward" />
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-xl bg-red-500/8 border border-red-500/20 px-3 py-2.5">
                <p className="text-[9px] font-bold text-red-400 uppercase tracking-wide mb-1">Max Loss</p>
                <p className="text-[11px] text-slate-300 leading-snug">{setup.maxLoss}</p>
              </div>
              <div className="rounded-xl bg-emerald-500/8 border border-emerald-500/20 px-3 py-2.5">
                <p className="text-[9px] font-bold text-emerald-400 uppercase tracking-wide mb-1">Max Profit</p>
                <p className="text-[11px] text-slate-300 leading-snug">{setup.maxProfit}</p>
              </div>
              <div className="rounded-xl bg-blue-500/8 border border-blue-500/20 px-3 py-2.5">
                <p className="text-[9px] font-bold text-blue-400 uppercase tracking-wide mb-1">Breakeven</p>
                <p className="text-[11px] text-slate-300 leading-snug">{setup.breakeven}</p>
              </div>
            </div>
          </div>

          {/* Real example */}
          <div>
            <SectionLabel label="Real Trade Example" />
            <div className="rounded-xl bg-slate-900/60 border border-slate-700/50 overflow-hidden">
              <div className="px-3 py-2 border-b border-slate-800/60 bg-slate-800/40">
                <p className="text-[11px] text-slate-300 font-medium">{setup.example.scenario}</p>
              </div>
              <div className="px-3 py-3 space-y-3">
                <div>
                  <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">The Setup</p>
                  <ul className="space-y-1">
                    {setup.example.setup.map((s, i) => (
                      <li key={i} className="text-[11px] text-slate-400 font-mono flex items-start gap-1.5">
                        <span className="text-slate-600 flex-shrink-0">→</span>
                        {s}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <div className="rounded-lg border-l-2 border-l-emerald-500 bg-emerald-500/5 px-3 py-2">
                    <p className="text-[9px] font-bold text-emerald-400 uppercase tracking-wide mb-1">✓ Profit Case</p>
                    <p className="text-[11px] text-slate-300 leading-snug">{setup.example.profitCase}</p>
                  </div>
                  <div className="rounded-lg border-l-2 border-l-red-500 bg-red-500/5 px-3 py-2">
                    <p className="text-[9px] font-bold text-red-400 uppercase tracking-wide mb-1">✕ Loss Case</p>
                    <p className="text-[11px] text-slate-300 leading-snug">{setup.example.lossCase}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Risks */}
          <div>
            <SectionLabel label="⚠️ Key Risks" />
            <ul className="space-y-1">
              {setup.risks.map((r, i) => (
                <li key={i} className="flex items-start gap-2 text-[12px] text-slate-400 leading-snug">
                  <span className="text-red-500 flex-shrink-0 mt-0.5">·</span>
                  {r}
                </li>
              ))}
            </ul>
          </div>

          {/* Pro tips */}
          <div>
            <SectionLabel label="💡 Pro Tips" />
            <ul className="space-y-1.5">
              {setup.tips.map((t, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2 text-[12px] text-slate-400 leading-snug px-3 py-2 rounded-lg bg-blue-500/5 border border-blue-500/10"
                >
                  <span className="text-blue-400 flex-shrink-0 mt-0.5">💡</span>
                  {t}
                </li>
              ))}
            </ul>
          </div>

          <p className="text-[10px] text-slate-600 text-right">Educational purposes only. Not financial advice.</p>
        </div>
      )}
    </div>
  );
}

function SectionLabel({ label }: { label: string }) {
  return (
    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">{label}</p>
  );
}

// ── Main export ────────────────────────────────────────────────────────────────

export function TradingSetups() {
  const [filter, setFilter] = useState<FilterType>('all');
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    let list = SETUPS;
    if (filter === 'beginner' || filter === 'intermediate' || filter === 'advanced') {
      list = list.filter(s => s.difficulty === filter);
    } else if (filter === 'income') {
      list = list.filter(s => s.category === 'Income');
    } else if (filter !== 'all') {
      list = list.filter(s => s.outlook === filter);
    }
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        s =>
          s.name.toLowerCase().includes(q) ||
          s.tagline.toLowerCase().includes(q) ||
          s.category.toLowerCase().includes(q),
      );
    }
    return list;
  }, [filter, search]);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-white">Trading Setups</h2>
        <p className="text-xs text-slate-500 mt-0.5">
          {SETUPS.length} setups · tap any card to see examples and strategies
        </p>
      </div>

      {/* Search */}
      <div className="relative">
        <input
          type="text"
          placeholder="Search setups..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-4 pr-9 py-2.5 rounded-xl bg-slate-800/60 border border-slate-700/50 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/50"
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

      {/* Filter pills */}
      <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-0.5">
        {FILTERS.map(f => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`flex-shrink-0 px-3 py-1.5 text-[11px] font-semibold rounded-full border transition-colors ${
              filter === f.id
                ? 'bg-blue-600 border-blue-500 text-white'
                : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white hover:border-slate-600'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Count */}
      <p className="text-[11px] text-slate-600">
        Showing {filtered.length} of {SETUPS.length} setups
      </p>

      {/* Setup cards */}
      <div className="space-y-3">
        {filtered.map(s => <SetupCard key={s.id} setup={s} />)}
      </div>

      {filtered.length === 0 && (
        <p className="text-sm text-slate-500 text-center py-8">No setups match your filter</p>
      )}
    </div>
  );
}
