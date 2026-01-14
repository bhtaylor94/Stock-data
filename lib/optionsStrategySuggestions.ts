// lib/optionsStrategySuggestions.ts
// Advanced options strategy suggestion engine
// Suggests: Iron Condor, Butterfly, Calendar, Vertical spreads, etc.

export interface StrategyLeg {
  action: 'BUY' | 'SELL';
  type: 'CALL' | 'PUT';
  strike: number;
  expiration: string;
  quantity: number;
  optionSymbol: string;
  premium: number;
  delta: number;
  gamma: number;
  theta: number;
  vega: number;
}

export interface TradeSuggestion {
  strategy: string;
  strategyType: 'DIRECTIONAL' | 'NEUTRAL' | 'VOLATILITY' | 'INCOME';
  description: string;
  legs: StrategyLeg[];
  analysis: {
    maxProfit: number;
    maxLoss: number;
    breakeven: number[];
    probabilityOfProfit: number;
    returnOnRisk: number;
    netPremium: number;
    netDelta: number;
    netGamma: number;
    netTheta: number;
    netVega: number;
  };
  marketConditions: {
    underlyingPrice: number;
    impliedVolatility: number;
    ivRank: number;
    trend: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  };
  timing: {
    daysToExpiration: number;
    optimalHoldPeriod: number;
    exitConditions: string[];
  };
  risks: string[];
  requirements: {
    buyingPower: number;
    margin: number;
    collateral: number;
  };
  confidence: number;
  reasoning: string[];
}

// ============================================================
// STRATEGY GENERATORS
// ============================================================

/**
 * Generate Iron Condor suggestions (neutral strategy)
 */
export function suggestIronCondor(
  optionsChain: any[],
  underlyingPrice: number,
  ivRank: number
): TradeSuggestion | null {
  // Iron Condor works best in high IV environments
  if (ivRank < 40) return null;

  // Find suitable strikes (typically 1 standard deviation out)
  const calls = optionsChain.filter(o => o.putCall === 'CALL');
  const puts = optionsChain.filter(o => o.putCall === 'PUT');

  // Sort by strike
  const callsSorted = calls.sort((a, b) => a.strikePrice - b.strikePrice);
  const putsSorted = puts.sort((a, b) => b.strikePrice - a.strikePrice);

  // Find strikes around 16 delta (1 standard deviation)
  const longCall = callsSorted.find(c => Math.abs(c.delta) >= 0.10 && Math.abs(c.delta) <= 0.20);
  const shortCall = callsSorted.find(c => 
    c.strikePrice < (longCall?.strikePrice || Infinity) && 
    Math.abs(c.delta) >= 0.25 && 
    Math.abs(c.delta) <= 0.35
  );
  
  const longPut = putsSorted.find(p => Math.abs(p.delta) >= 0.10 && Math.abs(p.delta) <= 0.20);
  const shortPut = putsSorted.find(p => 
    p.strikePrice > (longPut?.strikePrice || 0) && 
    Math.abs(p.delta) >= 0.25 && 
    Math.abs(p.delta) <= 0.35
  );

  if (!longCall || !shortCall || !longPut || !shortPut) return null;

  // Calculate premiums
  const callCreditReceived = (shortCall.bid - longCall.ask) * 100;
  const putCreditReceived = (shortPut.bid - longPut.ask) * 100;
  const totalCredit = callCreditReceived + putCreditReceived;

  // Calculate max loss
  const callSpreadWidth = (longCall.strikePrice - shortCall.strikePrice) * 100;
  const putSpreadWidth = (shortPut.strikePrice - longPut.strikePrice) * 100;
  const maxLoss = Math.max(callSpreadWidth, putSpreadWidth) - totalCredit;

  // Calculate breakevens
  const upperBreakeven = shortCall.strikePrice + (totalCredit / 100);
  const lowerBreakeven = shortPut.strikePrice - (totalCredit / 100);

  // Probability of profit (simplistic - between the short strikes)
  const profitRange = shortCall.strikePrice - shortPut.strikePrice;
  const profitRangePercent = (profitRange / underlyingPrice) * 100;
  const probabilityOfProfit = Math.min(85, 50 + profitRangePercent * 2);

  const legs: StrategyLeg[] = [
    {
      action: 'SELL',
      type: 'PUT',
      strike: shortPut.strikePrice,
      expiration: shortPut.expirationDate,
      quantity: 1,
      optionSymbol: shortPut.symbol,
      premium: shortPut.bid * 100,
      delta: shortPut.delta,
      gamma: shortPut.gamma || 0,
      theta: shortPut.theta || 0,
      vega: shortPut.vega || 0,
    },
    {
      action: 'BUY',
      type: 'PUT',
      strike: longPut.strikePrice,
      expiration: longPut.expirationDate,
      quantity: 1,
      optionSymbol: longPut.symbol,
      premium: longPut.ask * 100,
      delta: longPut.delta,
      gamma: longPut.gamma || 0,
      theta: longPut.theta || 0,
      vega: longPut.vega || 0,
    },
    {
      action: 'SELL',
      type: 'CALL',
      strike: shortCall.strikePrice,
      expiration: shortCall.expirationDate,
      quantity: 1,
      optionSymbol: shortCall.symbol,
      premium: shortCall.bid * 100,
      delta: shortCall.delta,
      gamma: shortCall.gamma || 0,
      theta: shortCall.theta || 0,
      vega: shortCall.vega || 0,
    },
    {
      action: 'BUY',
      type: 'CALL',
      strike: longCall.strikePrice,
      expiration: longCall.expirationDate,
      quantity: 1,
      optionSymbol: longCall.symbol,
      premium: longCall.ask * 100,
      delta: longCall.delta,
      gamma: longCall.gamma || 0,
      theta: longCall.theta || 0,
      vega: longCall.vega || 0,
    },
  ];

  const netGreeks = calculateNetGreeks(legs);
  const daysToExpiration = calculateDTE(shortCall.expirationDate);

  return {
    strategy: 'Iron Condor',
    strategyType: 'NEUTRAL',
    description: `Sell ${shortPut.strikePrice}/${shortCall.strikePrice} strangle, buy ${longPut.strikePrice}/${longCall.strikePrice} wings`,
    legs,
    analysis: {
      maxProfit: totalCredit,
      maxLoss: maxLoss,
      breakeven: [lowerBreakeven, upperBreakeven],
      probabilityOfProfit,
      returnOnRisk: maxLoss > 0 ? (totalCredit / maxLoss) * 100 : 0,
      netPremium: totalCredit,
      ...netGreeks,
    },
    marketConditions: {
      underlyingPrice,
      impliedVolatility: shortCall.volatility || 0,
      ivRank,
      trend: 'NEUTRAL',
    },
    timing: {
      daysToExpiration,
      optimalHoldPeriod: Math.floor(daysToExpiration * 0.5),
      exitConditions: [
        `Take profit at 50% of max credit ($${(totalCredit * 0.5).toFixed(0)})`,
        `Exit if underlying breaks ${upperBreakeven.toFixed(2)} or ${lowerBreakeven.toFixed(2)}`,
        `Close at 21 DTE or 50% of time passed`,
      ],
    },
    risks: [
      'Max loss if underlying moves beyond wings',
      'Early assignment risk on short options',
      'Earnings announcement could cause volatility spike',
    ],
    requirements: {
      buyingPower: maxLoss,
      margin: maxLoss,
      collateral: maxLoss,
    },
    confidence: ivRank >= 60 ? 80 : 70,
    reasoning: [
      `High IV environment (IV Rank: ${ivRank})`,
      `Probability of profit: ${probabilityOfProfit.toFixed(0)}%`,
      `Risk/Reward: ${(totalCredit / maxLoss * 100).toFixed(0)}% return on risk`,
      `Theta decay benefits seller (Net Theta: ${netGreeks.netTheta.toFixed(2)})`,
    ],
  };
}

/**
 * Generate Butterfly spread suggestions (neutral/low volatility)
 */
export function suggestButterfly(
  optionsChain: any[],
  underlyingPrice: number,
  ivRank: number,
  type: 'CALL' | 'PUT'
): TradeSuggestion | null {
  // Butterflies work best in low IV environments
  if (ivRank > 60) return null;

  const contracts = optionsChain.filter(o => o.putCall === type);
  const sorted = contracts.sort((a, b) => a.strikePrice - b.strikePrice);

  // Find ATM strike
  const atmContract = sorted.reduce((prev, curr) => 
    Math.abs(curr.strikePrice - underlyingPrice) < Math.abs(prev.strikePrice - underlyingPrice) 
      ? curr : prev
  );

  const atmStrike = atmContract.strikePrice;

  // Find wings (equidistant from ATM)
  const wingDistance = underlyingPrice * 0.05; // 5% wings
  const lowerWing = sorted.find(c => c.strikePrice <= atmStrike - wingDistance);
  const upperWing = sorted.find(c => c.strikePrice >= atmStrike + wingDistance);

  if (!lowerWing || !atmContract || !upperWing) return null;

  // Calculate cost
  const cost = (lowerWing.ask + upperWing.ask - 2 * atmContract.bid) * 100;
  const maxProfit = ((atmStrike - lowerWing.strikePrice) * 100) - cost;
  const maxLoss = cost;

  const legs: StrategyLeg[] = [
    {
      action: 'BUY',
      type,
      strike: lowerWing.strikePrice,
      expiration: lowerWing.expirationDate,
      quantity: 1,
      optionSymbol: lowerWing.symbol,
      premium: lowerWing.ask * 100,
      delta: lowerWing.delta,
      gamma: lowerWing.gamma || 0,
      theta: lowerWing.theta || 0,
      vega: lowerWing.vega || 0,
    },
    {
      action: 'SELL',
      type,
      strike: atmStrike,
      expiration: atmContract.expirationDate,
      quantity: 2,
      optionSymbol: atmContract.symbol,
      premium: atmContract.bid * 100,
      delta: atmContract.delta,
      gamma: atmContract.gamma || 0,
      theta: atmContract.theta || 0,
      vega: atmContract.vega || 0,
    },
    {
      action: 'BUY',
      type,
      strike: upperWing.strikePrice,
      expiration: upperWing.expirationDate,
      quantity: 1,
      optionSymbol: upperWing.symbol,
      premium: upperWing.ask * 100,
      delta: upperWing.delta,
      gamma: upperWing.gamma || 0,
      theta: upperWing.theta || 0,
      vega: upperWing.vega || 0,
    },
  ];

  const netGreeks = calculateNetGreeks(legs);
  const daysToExpiration = calculateDTE(atmContract.expirationDate);

  return {
    strategy: `${type === 'CALL' ? 'Call' : 'Put'} Butterfly`,
    strategyType: 'NEUTRAL',
    description: `Buy ${lowerWing.strikePrice}/${upperWing.strikePrice}, sell 2x ${atmStrike}`,
    legs,
    analysis: {
      maxProfit,
      maxLoss,
      breakeven: [
        lowerWing.strikePrice + (cost / 100),
        upperWing.strikePrice - (cost / 100),
      ],
      probabilityOfProfit: 45, // Butterflies have lower PoP but high reward
      returnOnRisk: (maxProfit / maxLoss) * 100,
      netPremium: -cost,
      ...netGreeks,
    },
    marketConditions: {
      underlyingPrice,
      impliedVolatility: atmContract.volatility || 0,
      ivRank,
      trend: 'NEUTRAL',
    },
    timing: {
      daysToExpiration,
      optimalHoldPeriod: daysToExpiration,
      exitConditions: [
        `Max profit at expiration if underlying at $${atmStrike.toFixed(2)}`,
        `Exit if underlying moves beyond breakevens`,
        `Take profit at 75% of max profit`,
      ],
    },
    risks: [
      'Profit zone is narrow',
      'Max profit only achieved at expiration',
      'Time decay hurts long wings',
    ],
    requirements: {
      buyingPower: maxLoss,
      margin: maxLoss,
      collateral: maxLoss,
    },
    confidence: ivRank < 40 ? 75 : 60,
    reasoning: [
      `Low IV environment (IV Rank: ${ivRank})`,
      `Targeting ${atmStrike.toFixed(2)} at expiration`,
      `Risk/Reward: ${(maxProfit / maxLoss * 100).toFixed(0)}% potential return`,
    ],
  };
}

/**
 * Generate Calendar spread suggestions (volatility/time decay)
 */
export function suggestCalendar(
  nearOptions: any[],
  farOptions: any[],
  underlyingPrice: number,
  ivRank: number,
  type: 'CALL' | 'PUT'
): TradeSuggestion | null {
  // Find ATM strikes in both expirations
  const nearAtm = nearOptions
    .filter(o => o.putCall === type)
    .reduce((prev, curr) => 
      Math.abs(curr.strikePrice - underlyingPrice) < Math.abs(prev.strikePrice - underlyingPrice) 
        ? curr : prev
    );

  const farAtm = farOptions
    .filter(o => o.putCall === type && Math.abs(o.strikePrice - nearAtm.strikePrice) < 1)
    .reduce((prev, curr) => 
      Math.abs(curr.strikePrice - underlyingPrice) < Math.abs(prev.strikePrice - underlyingPrice) 
        ? curr : prev
    );

  if (!nearAtm || !farAtm) return null;

  // Calculate cost (buy far, sell near)
  const cost = (farAtm.ask - nearAtm.bid) * 100;
  const estimatedProfit = cost * 0.3; // Calendars typically target 30% profit

  const legs: StrategyLeg[] = [
    {
      action: 'SELL',
      type,
      strike: nearAtm.strikePrice,
      expiration: nearAtm.expirationDate,
      quantity: 1,
      optionSymbol: nearAtm.symbol,
      premium: nearAtm.bid * 100,
      delta: nearAtm.delta,
      gamma: nearAtm.gamma || 0,
      theta: nearAtm.theta || 0,
      vega: nearAtm.vega || 0,
    },
    {
      action: 'BUY',
      type,
      strike: farAtm.strikePrice,
      expiration: farAtm.expirationDate,
      quantity: 1,
      optionSymbol: farAtm.symbol,
      premium: farAtm.ask * 100,
      delta: farAtm.delta,
      gamma: farAtm.gamma || 0,
      theta: farAtm.theta || 0,
      vega: farAtm.vega || 0,
    },
  ];

  const netGreeks = calculateNetGreeks(legs);
  const nearDTE = calculateDTE(nearAtm.expirationDate);

  return {
    strategy: `${type === 'CALL' ? 'Call' : 'Put'} Calendar Spread`,
    strategyType: 'VOLATILITY',
    description: `Sell ${nearAtm.expirationDate} ${nearAtm.strikePrice}, buy ${farAtm.expirationDate} ${farAtm.strikePrice}`,
    legs,
    analysis: {
      maxProfit: estimatedProfit,
      maxLoss: cost,
      breakeven: [nearAtm.strikePrice],
      probabilityOfProfit: 55,
      returnOnRisk: (estimatedProfit / cost) * 100,
      netPremium: -cost,
      ...netGreeks,
    },
    marketConditions: {
      underlyingPrice,
      impliedVolatility: nearAtm.volatility || 0,
      ivRank,
      trend: 'NEUTRAL',
    },
    timing: {
      daysToExpiration: nearDTE,
      optimalHoldPeriod: nearDTE,
      exitConditions: [
        `Close near-dated leg at expiration`,
        `Take profit at 25-30% of cost`,
        `Exit if underlying moves >10% from strike`,
      ],
    },
    risks: [
      'Volatility decrease hurts position',
      'Early assignment risk on short leg',
      'Requires management at near expiration',
    ],
    requirements: {
      buyingPower: cost,
      margin: cost,
      collateral: cost,
    },
    confidence: 70,
    reasoning: [
      `Benefits from time decay differential`,
      `Positive Vega: profits from IV increase`,
      `Near-term theta decay benefits position`,
    ],
  };
}

/**
 * Generate Bull/Bear vertical spread suggestions (directional)
 */
export function suggestVerticalSpread(
  optionsChain: any[],
  underlyingPrice: number,
  trend: 'BULLISH' | 'BEARISH',
  ivRank: number
): TradeSuggestion | null {
  const type = trend === 'BULLISH' ? 'CALL' : 'PUT';
  const contracts = optionsChain.filter(o => o.putCall === type);
  const sorted = contracts.sort((a, b) => a.strikePrice - b.strikePrice);

  // For bull call: buy ATM/ITM, sell OTM
  // For bear put: buy ATM/ITM, sell OTM
  
  const longStrike = sorted.find(c => 
    trend === 'BULLISH' 
      ? c.strikePrice <= underlyingPrice * 1.02
      : c.strikePrice >= underlyingPrice * 0.98
  );

  const shortStrike = sorted.find(c => 
    trend === 'BULLISH'
      ? c.strikePrice > (longStrike?.strikePrice || 0) && c.strikePrice <= underlyingPrice * 1.10
      : c.strikePrice < (longStrike?.strikePrice || Infinity) && c.strikePrice >= underlyingPrice * 0.90
  );

  if (!longStrike || !shortStrike) return null;

  const cost = (longStrike.ask - shortStrike.bid) * 100;
  const spreadWidth = Math.abs(shortStrike.strikePrice - longStrike.strikePrice) * 100;
  const maxProfit = spreadWidth - cost;
  const maxLoss = cost;

  const legs: StrategyLeg[] = [
    {
      action: 'BUY',
      type,
      strike: longStrike.strikePrice,
      expiration: longStrike.expirationDate,
      quantity: 1,
      optionSymbol: longStrike.symbol,
      premium: longStrike.ask * 100,
      delta: longStrike.delta,
      gamma: longStrike.gamma || 0,
      theta: longStrike.theta || 0,
      vega: longStrike.vega || 0,
    },
    {
      action: 'SELL',
      type,
      strike: shortStrike.strikePrice,
      expiration: shortStrike.expirationDate,
      quantity: 1,
      optionSymbol: shortStrike.symbol,
      premium: shortStrike.bid * 100,
      delta: shortStrike.delta,
      gamma: shortStrike.gamma || 0,
      theta: shortStrike.theta || 0,
      vega: shortStrike.vega || 0,
    },
  ];

  const netGreeks = calculateNetGreeks(legs);
  const daysToExpiration = calculateDTE(longStrike.expirationDate);
  const breakevenPrice = trend === 'BULLISH'
    ? longStrike.strikePrice + (cost / 100)
    : longStrike.strikePrice - (cost / 100);

  return {
    strategy: trend === 'BULLISH' ? 'Bull Call Spread' : 'Bear Put Spread',
    strategyType: 'DIRECTIONAL',
    description: `Buy ${longStrike.strikePrice}, sell ${shortStrike.strikePrice}`,
    legs,
    analysis: {
      maxProfit,
      maxLoss,
      breakeven: [breakevenPrice],
      probabilityOfProfit: 60,
      returnOnRisk: (maxProfit / maxLoss) * 100,
      netPremium: -cost,
      ...netGreeks,
    },
    marketConditions: {
      underlyingPrice,
      impliedVolatility: longStrike.volatility || 0,
      ivRank,
      trend,
    },
    timing: {
      daysToExpiration,
      optimalHoldPeriod: Math.floor(daysToExpiration * 0.75),
      exitConditions: [
        `Take profit at 75% of max profit`,
        `Exit if trend reverses`,
        `Hold to expiration if still ITM`,
      ],
    },
    risks: [
      `Max profit capped at $${maxProfit.toFixed(0)}`,
      'Requires underlying to move in predicted direction',
      'Time decay can hurt if move is slow',
    ],
    requirements: {
      buyingPower: maxLoss,
      margin: maxLoss,
      collateral: maxLoss,
    },
    confidence: 75,
    reasoning: [
      `${trend === 'BULLISH' ? 'Bullish' : 'Bearish'} market trend detected`,
      `Risk/Reward: ${(maxProfit / maxLoss * 100).toFixed(0)}% potential return`,
      `Breakeven at ${breakevenPrice.toFixed(2)}`,
    ],
  };
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

function calculateNetGreeks(legs: StrategyLeg[]): {
  netDelta: number;
  netGamma: number;
  netTheta: number;
  netVega: number;
} {
  let netDelta = 0;
  let netGamma = 0;
  let netTheta = 0;
  let netVega = 0;

  for (const leg of legs) {
    const multiplier = leg.action === 'BUY' ? leg.quantity : -leg.quantity;
    netDelta += leg.delta * multiplier;
    netGamma += leg.gamma * multiplier;
    netTheta += leg.theta * multiplier;
    netVega += leg.vega * multiplier;
  }

  return {
    netDelta: Math.round(netDelta * 100) / 100,
    netGamma: Math.round(netGamma * 10000) / 10000,
    netTheta: Math.round(netTheta * 100) / 100,
    netVega: Math.round(netVega * 100) / 100,
  };
}

function calculateDTE(expirationDate: string): number {
  const exp = new Date(expirationDate);
  const now = new Date();
  const diffTime = exp.getTime() - now.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Main function to generate all applicable strategy suggestions
 */
export function generateAllSuggestions(
  optionsData: {
    nearChain: any[];
    farChain: any[];
    underlyingPrice: number;
    ivRank: number;
    trend: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  }
): TradeSuggestion[] {
  const suggestions: TradeSuggestion[] = [];

  // Iron Condor (neutral, high IV)
  const ironCondor = suggestIronCondor(
    optionsData.nearChain,
    optionsData.underlyingPrice,
    optionsData.ivRank
  );
  if (ironCondor) suggestions.push(ironCondor);

  // Butterfly (neutral, low IV)
  const callButterfly = suggestButterfly(
    optionsData.nearChain,
    optionsData.underlyingPrice,
    optionsData.ivRank,
    'CALL'
  );
  if (callButterfly) suggestions.push(callButterfly);

  const putButterfly = suggestButterfly(
    optionsData.nearChain,
    optionsData.underlyingPrice,
    optionsData.ivRank,
    'PUT'
  );
  if (putButterfly) suggestions.push(putButterfly);

  // Calendar spreads
  if (optionsData.farChain.length > 0) {
    const callCalendar = suggestCalendar(
      optionsData.nearChain,
      optionsData.farChain,
      optionsData.underlyingPrice,
      optionsData.ivRank,
      'CALL'
    );
    if (callCalendar) suggestions.push(callCalendar);

    const putCalendar = suggestCalendar(
      optionsData.nearChain,
      optionsData.farChain,
      optionsData.underlyingPrice,
      optionsData.ivRank,
      'PUT'
    );
    if (putCalendar) suggestions.push(putCalendar);
  }

  // Vertical spreads (directional)
  if (optionsData.trend !== 'NEUTRAL') {
    const verticalSpread = suggestVerticalSpread(
      optionsData.nearChain,
      optionsData.underlyingPrice,
      optionsData.trend,
      optionsData.ivRank
    );
    if (verticalSpread) suggestions.push(verticalSpread);
  }

  // Sort by confidence
  return suggestions.sort((a, b) => b.confidence - a.confidence);
}
