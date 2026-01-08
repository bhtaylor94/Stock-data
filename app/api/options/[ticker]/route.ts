import { NextResponse } from 'next/server';

// Mock data for demo - replace with real Schwab/Finnhub API calls
const generateMockData = (ticker: string) => {
  const price = ticker === 'AAPL' ? 260.33 : ticker === 'TSLA' ? 248.50 : ticker === 'NVDA' ? 138.25 : 100 + Math.random() * 200;
  const trend = Math.random() > 0.5 ? 'BULLISH' : 'BEARISH';
  const changePercent = (Math.random() * 15 - 5).toFixed(1);
  
  return {
    ticker,
    currentPrice: parseFloat(price.toFixed(2)),
    expiration: "2026-01-17",
    analysis: {
      trend: { 
        trend, 
        changePercent: parseFloat(changePercent), 
        volatility: parseFloat((Math.random() * 2 + 0.5).toFixed(1))
      },
      newsSentiment: {
        sentiment: trend,
        score: Math.floor(Math.random() * 5),
        keywords: ["+surge", "+beat", "+growth", "-concern"],
        recentHeadlines: [
          `${ticker} Reports Strong Quarterly Results`,
          `Analysts Upgrade ${ticker} Price Target`,
          `${ticker} Announces New Product Launch`,
          `Market Reacts to ${ticker} News`,
          `${ticker} Faces Competition Concerns`
        ]
      },
      earnings: { 
        date: "2026-01-29", 
        daysUntil: 22, 
        epsEstimate: parseFloat((Math.random() * 3 + 1).toFixed(2))
      },
      analystRating: {
        consensus: "buy",
        buyPercent: "72",
        strongBuy: 18,
        buy: 12,
        hold: 8,
        sell: 2,
        strongSell: 1
      }
    },
    metrics: {
      putCallRatio: (0.7 + Math.random() * 0.5).toFixed(2),
      totalCallVolume: Math.floor(1000000 + Math.random() * 500000),
      totalPutVolume: Math.floor(800000 + Math.random() * 400000),
      avgIV: (25 + Math.random() * 10).toFixed(1)
    },
    suggestions: generateSuggestions(ticker, price, trend),
    calls: generateOptionsChain(price, 'call'),
    puts: generateOptionsChain(price, 'put')
  };
};

const generateSuggestions = (ticker: string, price: number, trend: string) => {
  const isBullish = trend === 'BULLISH';
  const atmStrike = Math.round(price / 5) * 5;
  
  return [
    {
      type: "CALL",
      strategy: "Aggressive Call",
      strike: atmStrike + 5,
      expiration: "2026-01-17",
      daysToExpiration: 10,
      bid: parseFloat((3 + Math.random()).toFixed(2)),
      ask: parseFloat((3.2 + Math.random()).toFixed(2)),
      delta: 0.42,
      gamma: 0.045,
      theta: -0.15,
      iv: 28.2,
      maxRisk: ((3.45) * 100).toFixed(2),
      breakeven: (atmStrike + 5 + 3.45).toFixed(2),
      reasoning: [
        `30-day trend ${isBullish ? 'UP' : 'DOWN'}`,
        `${isBullish ? 'Positive' : 'Mixed'} news sentiment`,
        "IV at 28% is moderate - options fairly priced",
        "Delta 0.42 offers good leverage"
      ],
      riskLevel: "AGGRESSIVE",
      confidence: isBullish ? 78 : 45
    },
    {
      type: "CALL",
      strategy: "Conservative Call",
      strike: atmStrike + 10,
      expiration: "2026-02-21",
      daysToExpiration: 45,
      bid: parseFloat((5.5 + Math.random()).toFixed(2)),
      ask: parseFloat((6 + Math.random()).toFixed(2)),
      delta: 0.32,
      gamma: 0.028,
      theta: -0.08,
      iv: 27.5,
      maxRisk: ((6.10) * 100).toFixed(2),
      breakeven: (atmStrike + 10 + 6.10).toFixed(2),
      reasoning: [
        "45 DTE gives time for thesis to play out",
        "Lower theta decay (-$8/day) vs aggressive",
        "Analyst consensus: 72% bullish"
      ],
      riskLevel: "CONSERVATIVE",
      confidence: isBullish ? 72 : 50
    },
    {
      type: "PUT",
      strategy: "Aggressive Put",
      strike: atmStrike - 5,
      expiration: "2026-01-17",
      daysToExpiration: 10,
      bid: parseFloat((2.5 + Math.random()).toFixed(2)),
      ask: parseFloat((3 + Math.random()).toFixed(2)),
      delta: -0.38,
      gamma: 0.042,
      theta: -0.14,
      iv: 29.1,
      maxRisk: ((3.05) * 100).toFixed(2),
      breakeven: (atmStrike - 5 - 3.05).toFixed(2),
      reasoning: [
        "Hedge against potential reversal",
        "Some negative keywords in news",
        "Earnings approaching - potential volatility"
      ],
      riskLevel: "AGGRESSIVE",
      confidence: isBullish ? 35 : 65
    },
    {
      type: "ALERT",
      strategy: "Earnings Approaching",
      reasoning: [
        "Earnings in 22 days",
        "IV may increase as earnings approach",
        "Consider position sizing carefully"
      ],
      riskLevel: "WARNING",
      confidence: 0
    }
  ];
};

const generateOptionsChain = (price: number, type: 'call' | 'put') => {
  const atmStrike = Math.round(price / 5) * 5;
  const strikes = type === 'call' 
    ? [atmStrike - 5, atmStrike, atmStrike + 5, atmStrike + 10, atmStrike + 15]
    : [atmStrike - 15, atmStrike - 10, atmStrike - 5, atmStrike, atmStrike + 5];
  
  return strikes.map((strike, i) => {
    const moneyness = (price - strike) / price;
    const baseDelta = type === 'call' 
      ? Math.max(0.1, Math.min(0.9, 0.5 + moneyness * 2))
      : Math.min(-0.1, Math.max(-0.9, -0.5 + moneyness * 2));
    
    return {
      strike,
      bid: parseFloat((Math.max(0.5, 7 - i * 1.5 + Math.random())).toFixed(2)),
      ask: parseFloat((Math.max(0.7, 7.3 - i * 1.5 + Math.random())).toFixed(2)),
      delta: parseFloat(baseDelta.toFixed(2)),
      gamma: parseFloat((0.03 + Math.random() * 0.02).toFixed(3)),
      theta: parseFloat((-0.08 - Math.random() * 0.08).toFixed(2)),
      volume: Math.floor(10000 + Math.random() * 40000),
      openInterest: Math.floor(30000 + Math.random() * 70000),
      impliedVolatility: parseFloat((0.27 + Math.random() * 0.03).toFixed(3))
    };
  });
};

export async function GET(
  request: Request,
  { params }: { params: { ticker: string } }
) {
  const ticker = params.ticker.toUpperCase();
  
  // In production, replace with real API calls:
  // const finnhubData = await fetch(`https://finnhub.io/api/v1/quote?symbol=${ticker}&token=${process.env.FINNHUB_API_KEY}`);
  // const schwabOptions = await fetch(...); // Schwab OAuth flow
  
  const data = generateMockData(ticker);
  
  return NextResponse.json(data);
}
