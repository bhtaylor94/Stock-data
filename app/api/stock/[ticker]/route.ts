import { NextResponse } from 'next/server';

export async function GET(
  request: Request,
  { params }: { params: { ticker: string } }
) {
  const ticker = params.ticker.toUpperCase();
  
  // Mock stock data - replace with Finnhub API in production
  const data = {
    ticker,
    price: ticker === 'AAPL' ? 260.33 : ticker === 'TSLA' ? 248.50 : 100 + Math.random() * 200,
    change: (Math.random() * 10 - 5).toFixed(2),
    changePercent: (Math.random() * 5 - 2.5).toFixed(2),
    volume: Math.floor(50000000 + Math.random() * 50000000),
    marketCap: ticker === 'AAPL' ? '3.2T' : ticker === 'TSLA' ? '800B' : '100B',
    pe: (15 + Math.random() * 20).toFixed(1),
    eps: (2 + Math.random() * 5).toFixed(2),
    beta: (0.8 + Math.random() * 0.8).toFixed(2),
    dividend: ticker === 'AAPL' ? '0.96' : '0',
    targetHigh: (280 + Math.random() * 40).toFixed(0),
    targetLow: (180 + Math.random() * 40).toFixed(0),
    targetMean: (230 + Math.random() * 30).toFixed(0)
  };
  
  return NextResponse.json(data);
}
