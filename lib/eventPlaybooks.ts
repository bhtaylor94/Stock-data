import type { MarketEvent } from '@/app/api/news-feed/route';

export interface Strategy {
  name: string;
  type: 'bullish' | 'bearish' | 'neutral' | 'warning';
  description: string;
}

export interface EventPlaybook {
  title: string;
  emoji: string;
  whatIsIt: string;
  typicalBehavior: string;
  strategies: Strategy[];
}

export function getPlaybook(event: MarketEvent): EventPlaybook | null {
  if (event.type === 'quarterly_opex') return QUARTERLY_OPEX;
  if (event.type === 'opex') return MONTHLY_OPEX;
  if (event.type === 'earnings') return EARNINGS;
  if (event.type === 'economic') {
    const l = event.label.toLowerCase();
    if (l.includes('fomc') || l.includes('federal funds') || l.includes('interest rate decision')) return FOMC;
    if (l.includes('cpi') || l.includes('consumer price index')) return CPI;
    if (l.includes('nonfarm') || l.includes('non-farm') || l.includes('payroll')) return NFP;
    if (l.includes('pce') || l.includes('personal consumption')) return PCE;
    if (l.includes('gdp')) return GDP;
    if (l.includes('ppi') || l.includes('producer price')) return PPI;
    if (l.includes('jolts') || l.includes('job openings')) return JOLTS;
    if (l.includes('retail sales')) return RETAIL_SALES;
  }
  return null;
}

// ── Playbooks ────────────────────────────────────────────────────────────────

const MONTHLY_OPEX: EventPlaybook = {
  title: 'Monthly Options Expiration (OpEx)',
  emoji: '📅',
  whatIsIt:
    'Every 3rd Friday of the month, standard monthly options on stocks and ETFs expire. Market makers who sold those contracts must unwind their delta hedges — buying or selling shares to stay neutral — which creates predictable but sometimes violent intraday price action.',
  typicalBehavior:
    'Prices "pin" to heavily-populated strikes in the final 2–3 days. Large open interest at specific strikes acts like a gravitational pull. Volume surges on Friday morning as dealers close out thousands of contracts at once.',
  strategies: [
    {
      name: 'Pin Risk — Close Long Options Early',
      type: 'warning',
      description:
        'Avoid holding long options into the final 48 hours. Even if you\'re directionally correct, a stock pinning to a strike can make your options expire worthless. Close or roll at least 5 days before expiration.',
    },
    {
      name: 'Sell Expiring Premium',
      type: 'neutral',
      description:
        'Theta decay (time value erosion) accelerates dramatically in the final week. Sell iron condors, covered calls, or cash-secured puts 7–10 days before OpEx and let time decay work in your favor.',
    },
    {
      name: 'Gamma Scalp Intraday',
      type: 'neutral',
      description:
        'If you hold long gamma (e.g., a long straddle), OpEx week creates scalping opportunities as price whipsaws between strikes. Buy dips / sell rips within the expected range.',
    },
    {
      name: 'Roll Before Theta Cliff',
      type: 'warning',
      description:
        'If you own long options and still want exposure, roll to the next monthly expiration at least 5–7 days before OpEx to avoid the final-week theta cliff.',
    },
  ],
};

const QUARTERLY_OPEX: EventPlaybook = {
  title: 'Quarterly OpEx — Triple Witching',
  emoji: '🔮',
  whatIsIt:
    'Four times per year (March, June, September, December), THREE contract types expire simultaneously: stock options, stock index options, AND stock index futures. This coordinated expiration is called "Triple Witching" and triggers massive dealer hedging activity all at once. It\'s far more disruptive than a normal monthly OpEx.',
  typicalBehavior:
    'Volume often runs 2–3× a normal Friday. The final 30 minutes (3:30–4 PM ET) are especially chaotic as institutions rebalance trillions in index exposure. Quarter-end "window dressing" (funds buying winners to show on their statements) can push the market higher into the close. Expect violent intraday swings and potential fakeouts throughout the day.',
  strategies: [
    {
      name: 'Reduce Position Size — Sit on Hands',
      type: 'warning',
      description:
        'Triple Witching is NOT the day for new large bets. Erratic liquidity and forced dealer hedging can stop out even correct directional positions. Trade small or stand aside entirely.',
    },
    {
      name: 'Close Long Options by Thursday',
      type: 'warning',
      description:
        'Any long options expiring Friday will have near-zero extrinsic value by Thursday afternoon. Sell them Thursday morning — don\'t donate the remaining premium to market makers.',
    },
    {
      name: 'Watch End-of-Day Rebalancing Rally',
      type: 'bullish',
      description:
        'At quarter-end, funds buy their winners to window-dress portfolios. This often creates a sharp rally into the last 15–30 minutes. Consider holding long exposure (or a small call position) into the close.',
    },
    {
      name: 'Sell IV Into the Event',
      type: 'neutral',
      description:
        'IV on index options (SPY, QQQ) spikes ahead of Triple Witching. Sell ATM strangles 2–3 weeks out to collect elevated premium that tends to collapse after the event passes.',
    },
  ],
};

const FOMC: EventPlaybook = {
  title: 'FOMC Rate Decision',
  emoji: '🏛️',
  whatIsIt:
    'The Federal Open Market Committee meets 8 times per year and votes on the federal funds rate — the benchmark interest rate that shapes the cost of every mortgage, loan, and investment in the economy. The rate decision is announced at 2 PM ET, followed by a Fed Chair press conference at 2:30 PM. This single event moves markets more than almost anything else.',
  typicalBehavior:
    'Markets go quiet and choppy the morning of FOMC. At 2 PM, algorithms instantly parse the statement, causing an immediate spike (often in both directions within seconds). The "real" sustained move typically emerges 15–30 minutes later as humans process the nuance. Rate cuts → bullish (cheaper money = higher valuations). Rate hikes → bearish. But the *language* (hawkish vs dovish tone) often matters MORE than the actual rate decision.',
  strategies: [
    {
      name: 'Buy a Straddle 1–2 Days Before',
      type: 'neutral',
      description:
        'Buy SPY or QQQ calls AND puts at the same strike (a straddle). You profit from the volatility explosion regardless of direction. Close both legs within 2 hours of the 2 PM announcement.',
    },
    {
      name: 'Wait 15–30 Min Before Entering',
      type: 'warning',
      description:
        'The first 15 minutes after the announcement are an algo-driven whipsaw trap. Fake breakouts in both directions are common. Wait for the real trend to establish before committing capital.',
    },
    {
      name: 'Rate-Sensitive Sector Rotation',
      type: 'neutral',
      description:
        'Rate cut → buy REITs (XLRE), utilities (XLU), small caps (IWM), and tech (XLK). Rate hike → sell growth stocks, buy short-term T-bills or financial sector (XLF for margin expansion). These rotations can last weeks.',
    },
    {
      name: 'Sell IV After the Announcement',
      type: 'neutral',
      description:
        'Implied volatility on index options collapses the moment FOMC is resolved (IV crush). Sell iron condors on SPY/QQQ within 30 minutes of the announcement to profit from falling premium.',
    },
  ],
};

const CPI: EventPlaybook = {
  title: 'CPI — Consumer Price Index',
  emoji: '📊',
  whatIsIt:
    'Released monthly by the Bureau of Labor Statistics (usually the 2nd or 3rd Tuesday at 8:30 AM ET). CPI measures how much prices have changed for a basket of consumer goods and services — groceries, rent, gas, healthcare. It\'s the most widely quoted inflation gauge. The Fed watches it closely when deciding to raise or lower rates.',
  typicalBehavior:
    'Hot CPI (above estimate) = stocks fall, dollar rises, treasury yields spike → the Fed needs to keep rates higher for longer. Cool CPI (below estimate) = stocks rally, dollar weakens, growth stocks surge. Because the release is pre-market at 8:30 AM, futures gap immediately. The initial gap direction usually holds for 30–60 minutes.',
  strategies: [
    {
      name: 'Reduce Overnight Exposure',
      type: 'warning',
      description:
        'Don\'t hold large unhedged directional positions overnight before CPI. A 1–2% gap in either direction at 8:30 AM can wipe out stops before you can react. If you must hold, buy puts or calls as insurance the afternoon before.',
    },
    {
      name: 'Pre-Market Straddle',
      type: 'neutral',
      description:
        'Buy a 0-DTE SPY or QQQ straddle 30 minutes before market open. The volatile opening move typically covers the straddle cost on any significant surprise. Close within 60 minutes.',
    },
    {
      name: 'Growth vs Value Rotation',
      type: 'neutral',
      description:
        'Hot CPI: sell tech/growth (XLK, QQQ), buy energy (XLE), financials (XLF), and commodities (GLD). Cool CPI: the reverse — growth stocks benefit most from lower rate expectations. Play via sector ETFs for lower single-stock risk.',
    },
    {
      name: 'Bond Inverse Play on Hot CPI',
      type: 'bearish',
      description:
        'A hot CPI print crushes long-duration bonds. Buy puts on TLT (20+ year treasury ETF) or buy TBT (2× inverse bonds) to profit from rising yields. This is one of the highest-conviction CPI trades.',
    },
  ],
};

const NFP: EventPlaybook = {
  title: 'NFP — Non-Farm Payrolls (Jobs Report)',
  emoji: '💼',
  whatIsIt:
    'Released the first Friday of every month at 8:30 AM ET by the Bureau of Labor Statistics. Shows how many jobs were added or lost in the US economy (excluding agriculture). The unemployment rate and average hourly earnings are released simultaneously. This is arguably the single biggest monthly market-moving data event.',
  typicalBehavior:
    'The reaction depends heavily on the current macro narrative. In a rate-hike cycle, strong jobs = bad news (the Fed stays hawkish longer). In a rate-cut cycle, strong jobs = good news (economy is healthy). This "bad news is good news / good news is bad news" flip confuses many traders. The first 15 minutes are almost always a whipsaw. Prior month revisions can dramatically shift interpretation.',
  strategies: [
    {
      name: 'Wait 15 Min Before Trading the Print',
      type: 'warning',
      description:
        'NFP causes a 1–5 minute algo whipsaw in both directions. The "real" directional move emerges after 15–30 minutes as humans interpret the full picture. Entering in the first 5 minutes is gambling, not trading.',
    },
    {
      name: 'Straddle the Release',
      type: 'neutral',
      description:
        'Buy SPY or QQQ straddles 30 minutes before the 8:30 ET print. A big beat or miss almost always covers the straddle cost. Close within the first hour as IV crushes.',
    },
    {
      name: 'Read the Revisions',
      type: 'neutral',
      description:
        'The prior month\'s jobs number is often revised significantly. A strong headline with large downward revisions to prior months is effectively a weak report. Always read the full BLS release, not just the headline.',
    },
    {
      name: 'Consumer Sector Rotation',
      type: 'bullish',
      description:
        'Strong jobs = strong consumer spending → buy XLY (consumer discretionary) calls or individual names like AMZN, HD, MCD, SBUX. Weak jobs → defensive rotation into XLU (utilities), XLP (staples), and XLV (healthcare).',
    },
  ],
};

const PCE: EventPlaybook = {
  title: "PCE — Personal Consumption Expenditures",
  emoji: '💡',
  whatIsIt:
    "The Federal Reserve's *preferred* inflation gauge, released monthly by the Bureau of Economic Analysis. Unlike CPI, PCE accounts for substitution behavior — when beef gets expensive, people buy chicken, and PCE captures that switch. The Fed explicitly targets 2% core PCE inflation. Because the Fed watches PCE more closely than CPI, it can be even more market-moving.",
  typicalBehavior:
    'Usually released on a Friday at 8:30 AM ET. Hot PCE → stocks fall, rate cut expectations pushed back, tech and REITs hurt most. Cool PCE → stocks rally, especially rate-sensitive sectors. Friday releases can be exaggerated as traders position heading into the weekend.',
  strategies: [
    {
      name: 'Watch for Gap Fills After Open',
      type: 'neutral',
      description:
        'Stocks often gap hard on PCE then spend the morning filling that gap. Wait 15–30 minutes for the initial volatility to settle before entering new swing positions.',
    },
    {
      name: 'Rate-Sensitive Plays',
      type: 'neutral',
      description:
        'Hot PCE hurts tech (XLK), REITs (XLRE), and utilities (XLU) the most — these are rate-sensitive sectors. Cool PCE benefits them the most. Check CME FedWatch Tool to see how rate cut probabilities shift in real time post-release.',
    },
    {
      name: 'Weekend Theta Sell',
      type: 'neutral',
      description:
        'If PCE comes in roughly in-line with expectations, IV deflates immediately on Friday. Sell near-expiry strangles Friday morning to capture 3 days of weekend theta decay (stocks don\'t move over the weekend but options lose time value).',
    },
  ],
};

const GDP: EventPlaybook = {
  title: 'GDP Report',
  emoji: '🌐',
  whatIsIt:
    'Gross Domestic Product measures the total economic output of the US. Released quarterly in three phases: the Advance estimate (first, most volatile), Preliminary, and Final. Positive GDP = growth. Two consecutive negative quarters = technical recession. Released at 8:30 AM ET.',
  typicalBehavior:
    'The Advance GDP estimate moves markets most. Strong GDP above expectations = bullish for cyclical stocks, bearish for bonds. Weak or negative GDP = recession fears, defensive rotation, and bond rally. The market reaction also depends on whether "too strong" GDP implies the Fed stays restrictive.',
  strategies: [
    {
      name: 'Cyclical vs Defensive Rotation',
      type: 'neutral',
      description:
        'Strong GDP: buy industrials (XLI), energy (XLE), financials (XLF), and small caps (IWM). Weak GDP: rotate to defensive sectors — utilities (XLU), staples (XLP), healthcare (XLV) — and buy TLT as rates fall.',
    },
    {
      name: 'Small Cap Sensitivity',
      type: 'neutral',
      description:
        'IWM (Russell 2000) is the most sensitive to domestic economic growth. Strong GDP often causes an outsized IWM rally relative to SPY. Trade the ratio if you want to isolate the economic signal.',
    },
    {
      name: 'Recessionary Hedge',
      type: 'bearish',
      description:
        'If GDP comes in negative for a second consecutive quarter, markets may reprice aggressively. Consider buying QQQ or SPY puts, or VIX calls, as recession repricing tends to be fast and violent.',
    },
  ],
};

const PPI: EventPlaybook = {
  title: 'PPI — Producer Price Index',
  emoji: '🏭',
  whatIsIt:
    'Measures inflation from the producer\'s perspective — how much companies pay for raw materials and inputs BEFORE those costs get passed to consumers. Think of it as an early-warning signal for future CPI. Released monthly at 8:30 AM ET.',
  typicalBehavior:
    'Hot PPI → inflation concern, similar to CPI but with smaller immediate market impact. Cool PPI → suggests future CPI may come in lower, slightly bullish. PPI is most market-moving when it diverges significantly from expectations or from the recent CPI trend.',
  strategies: [
    {
      name: 'Use PPI as CPI Lead Indicator',
      type: 'neutral',
      description:
        'Hot PPI today → next month\'s CPI could surprise to the upside. Start reducing exposure to rate-sensitive names (tech, REITs) or buying downside protection in advance of the next CPI release.',
    },
    {
      name: 'Input Cost Sector Plays',
      type: 'neutral',
      description:
        'Hot PPI hurts margin-compressed companies that can\'t easily pass on costs: airlines (JETS), automakers (GM, F), restaurants (MCD, SBUX). Cool PPI benefits those same sectors. Trade sector ETFs to lower single-stock risk.',
    },
  ],
};

const JOLTS: EventPlaybook = {
  title: 'JOLTS — Job Openings Report',
  emoji: '🔍',
  whatIsIt:
    'Job Openings and Labor Turnover Survey, released by the BLS usually on the first Tuesday of the month. Shows the number of unfilled job positions in the US economy. The Fed watches this carefully as a real-time gauge of labor market tightness — more openings = tighter labor market = more wage inflation pressure.',
  typicalBehavior:
    'High job openings → tight labor market → more wage inflation risk → Fed stays hawkish → rate-sensitive assets fall. Declining openings → labor market cooling → dovish signal → stocks and bonds rally. JOLTS has grown significantly in market importance since 2022 when the Fed became laser-focused on labor inflation.',
  strategies: [
    {
      name: 'Fed Narrative Play',
      type: 'neutral',
      description:
        'If openings drop significantly: buy rate-sensitive assets (TLT, XLU, XLK, IWM). If openings surge: sell those and buy short-duration bonds or financial sector (XLF). JOLTS primarily reprices rate expectations.',
    },
    {
      name: 'Don\'t Overreact to a Single Print',
      type: 'warning',
      description:
        'JOLTS alone rarely causes sustained moves. It\'s most useful in context with recent NFP and CPI data to paint a full labor market picture. A single JOLTS surprise is noise; two or three in a row is a signal.',
    },
  ],
};

const RETAIL_SALES: EventPlaybook = {
  title: 'Retail Sales Report',
  emoji: '🛒',
  whatIsIt:
    'Monthly BLS report measuring total receipts at retail stores — a direct read on consumer spending, which drives roughly 70% of US GDP. Released around the 15th of each month at 8:30 AM ET. Beats drive immediate consumer discretionary stock rallies.',
  typicalBehavior:
    'Strong retail sales = healthy consumer = GDP growth bullish signal. Weak sales = consumer stress or recessionary fears. Consumer discretionary stocks (AMZN, HD, TJX, MCD) react most directly. The "ex-autos" and "control group" numbers are often more reliable than the headline.',
  strategies: [
    {
      name: 'Consumer Discretionary Trade',
      type: 'neutral',
      description:
        'Strong retail: buy XLY (consumer discretionary ETF) calls or individual names (AMZN, HD, MCD, NKE). Weak retail: buy XLP (staples) and XLU (utilities) as defensive rotation targets. The rotation can last 2–5 days.',
    },
    {
      name: 'Watch Ex-Autos Core Number',
      type: 'neutral',
      description:
        'Large auto sales swings distort the headline figure. Markets often reprice after digesting the "control group" number (ex-autos, ex-gas, ex-building materials) which feeds directly into GDP calculations.',
    },
  ],
};

const EARNINGS: EventPlaybook = {
  title: 'Earnings Report',
  emoji: '📈',
  whatIsIt:
    'Public companies report quarterly financial results — earnings per share (EPS) and revenue — compared to Wall Street analyst estimates. A "beat" (EPS above estimate) usually triggers a rally; a "miss" triggers a selloff. However, forward guidance (what management says about FUTURE performance) often matters more than the historical numbers. Earnings season runs roughly 2–6 weeks after each quarter ends.',
  typicalBehavior:
    'IV on options spikes dramatically in the 1–2 weeks before earnings, then collapses immediately after the report — this is called "IV crush." Stock can move 5–20% overnight. The actual move often differs significantly from what options implied. "Beat and raise" (EPS beat + raised guidance) is the strongest bullish signal. "Beat and lower guidance" often sells off despite good numbers.',
  strategies: [
    {
      name: 'Beware IV Crush if Buying Options',
      type: 'warning',
      description:
        'Buying calls or puts before earnings is extremely risky due to IV crush. Even if you predict the direction correctly, options can lose value if the actual move is smaller than implied. This is the most common earnings trading mistake.',
    },
    {
      name: 'Sell Strangles to Capture IV Crush',
      type: 'neutral',
      description:
        'Sell an OTM call AND OTM put 1–2 days before earnings to collect elevated IV premium. Profit if the stock moves less than implied. Risk: unlimited if the stock gaps far beyond your strikes. Size appropriately.',
    },
    {
      name: 'Post-Earnings Drift',
      type: 'bullish',
      description:
        'Stocks that beat significantly often drift higher for 5–10 days as institutional funds slowly build positions. Enter directional positions 30–60 minutes after market open (post-earnings), not in after-hours when spreads are wide.',
    },
    {
      name: 'Read Guidance, Not Just EPS',
      type: 'neutral',
      description:
        'The most profitable earnings trades come from correctly anticipating guidance surprises. Check the earnings call transcript or headline: "beat and raise" = strongest buy. "Beat and lower guidance" = sell the pop. Revenue guidance matters more than EPS for growth stocks.',
    },
  ],
};
