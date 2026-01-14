// app/api/backtest/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getSchwabAccessToken } from '@/lib/schwab';

interface BacktestResult {
  assetType: 'STOCK' | 'OPTION';
  strategy: string;
  trades: any[];
  summary: {
    totalTrades: number;
    winners: number;
    losers: number;
    winRate: number;
    avgProfit: number;
    avgLoss: number;
    totalProfit: number;
    totalLoss: number;
    netProfit: number;
    expectedValue: number;
    maxDrawdown: number;
    sharpeRatio: number;
    profitFactor: number;
  };
}

export async function POST(request: NextRequest) {
  try {
    const {
      assetType,
      strategy,
      ticker,
      startDate,
      endDate,
      entry,
      exit,
    } = await request.json();

    // ============================================================
    // STOCK BACKTESTING
    // ============================================================
    if (assetType === 'STOCK') {
      return await backtestStockStrategy({
        strategy, // 'BUY_HOLD', 'MOMENTUM', 'MEAN_REVERSION', 'AI_SIGNALS'
        ticker,
        startDate,
        endDate,
        entry, // { aiSignal: 'STRONG_BUY', minConfidence: 75 }
        exit, // { aiSignal: 'SELL', profitTarget: 0.15, stopLoss: -0.08 }
      });
    }

    // ============================================================
    // OPTIONS BACKTESTING
    // ============================================================
    else if (assetType === 'OPTION') {
      return await backtestOptionsStrategy({
        strategy, // 'IRON_CONDOR', 'BUTTERFLY', 'VERTICAL', 'CALENDAR'
        ticker,
        startDate,
        endDate,
        entry, // { ivRank: { min: 50 }, daysToExpiration: 45 }
        exit, // { profitTarget: 0.5, stopLoss: -2.0, daysToExpiration: 21 }
      });
    }

    throw new Error('Invalid asset type');

  } catch (error: any) {
    console.error('Backtest error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

// ============================================================
// STOCK BACKTESTING
// ============================================================
async function backtestStockStrategy(params: any) {
  const { strategy, ticker, startDate, endDate, entry, exit } = params;
  const trades: any[] = [];
  
  // Get historical data
  const accessToken = await getSchwabAccessToken();
  
  // Schwab API for historical prices
  const start = new Date(startDate);
  const end = new Date(endDate);
  const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  
  const histUrl = `https://api.schwabapi.com/marketdata/v1/pricehistory?symbol=${ticker}&periodType=year&period=1&frequencyType=daily`;
  const histRes = await fetch(histUrl, {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });
  const histData = await histRes.json();
  const candles = histData.candles || [];

  // STRATEGY: AI_SIGNALS
  if (strategy === 'AI_SIGNALS') {
    let position: any = null;

    for (let i = 0; i < candles.length; i++) {
      const candle = candles[i];
      const date = new Date(candle.datetime);
      
      // Simulate AI analysis (in production, run actual analysis)
      const aiSignal = simulateAISignal(candle, candles.slice(Math.max(0, i - 30), i));
      
      // ENTRY: Strong buy signal
      if (!position && aiSignal.action === 'STRONG_BUY' && aiSignal.confidence >= (entry.minConfidence || 75)) {
        position = {
          entryDate: date.toISOString(),
          entryPrice: candle.close,
          quantity: 100, // shares
          exitReason: null,
        };
      }
      
      // EXIT: Sell signal or stop loss/profit target
      if (position) {
        const profitPercent = (candle.close - position.entryPrice) / position.entryPrice;
        
        let shouldExit = false;
        let exitReason = '';
        
        // Profit target
        if (exit.profitTarget && profitPercent >= exit.profitTarget) {
          shouldExit = true;
          exitReason = 'Profit Target';
        }
        // Stop loss
        else if (exit.stopLoss && profitPercent <= exit.stopLoss) {
          shouldExit = true;
          exitReason = 'Stop Loss';
        }
        // AI sell signal
        else if (aiSignal.action === 'SELL' || aiSignal.action === 'STRONG_SELL') {
          shouldExit = true;
          exitReason = 'AI Sell Signal';
        }
        
        if (shouldExit) {
          trades.push({
            ...position,
            exitDate: date.toISOString(),
            exitPrice: candle.close,
            exitReason,
            profit: (candle.close - position.entryPrice) * position.quantity,
            profitPercent,
            daysHeld: Math.ceil((date.getTime() - new Date(position.entryDate).getTime()) / (1000 * 60 * 60 * 24)),
          });
          position = null;
        }
      }
    }
    
    // Close any open position at end
    if (position && candles.length > 0) {
      const lastCandle = candles[candles.length - 1];
      trades.push({
        ...position,
        exitDate: new Date(lastCandle.datetime).toISOString(),
        exitPrice: lastCandle.close,
        exitReason: 'End of Period',
        profit: (lastCandle.close - position.entryPrice) * position.quantity,
        profitPercent: (lastCandle.close - position.entryPrice) / position.entryPrice,
        daysHeld: Math.ceil((new Date(lastCandle.datetime).getTime() - new Date(position.entryDate).getTime()) / (1000 * 60 * 60 * 24)),
      });
    }
  }

  // Calculate summary
  const winners = trades.filter(t => t.profit > 0);
  const losers = trades.filter(t => t.profit <= 0);
  const totalProfit = winners.reduce((sum, t) => sum + t.profit, 0);
  const totalLoss = Math.abs(losers.reduce((sum, t) => sum + t.profit, 0));
  
  const result: BacktestResult = {
    assetType: 'STOCK',
    strategy,
    trades,
    summary: {
      totalTrades: trades.length,
      winners: winners.length,
      losers: losers.length,
      winRate: trades.length > 0 ? winners.length / trades.length : 0,
      avgProfit: winners.length > 0 ? totalProfit / winners.length : 0,
      avgLoss: losers.length > 0 ? totalLoss / losers.length : 0,
      totalProfit,
      totalLoss,
      netProfit: totalProfit - totalLoss,
      expectedValue: trades.length > 0 ? (totalProfit - totalLoss) / trades.length : 0,
      maxDrawdown: calculateMaxDrawdown(trades),
      sharpeRatio: calculateSharpeRatio(trades),
      profitFactor: totalLoss > 0 ? totalProfit / totalLoss : 0,
    },
  };

  return NextResponse.json(result);
}

// ============================================================
// OPTIONS BACKTESTING
// ============================================================
async function backtestOptionsStrategy(params: any) {
  const { strategy, ticker, startDate, endDate, entry, exit } = params;
  const trades: any[] = [];
  
  // Simplified for demo - in production, fetch historical options data
  // Simulate Iron Condor trades
  if (strategy === 'IRON_CONDOR') {
    // Generate sample trades
    const numTrades = 24; // ~2 years of monthly trades
    let currentDate = new Date(startDate);
    
    for (let i = 0; i < numTrades; i++) {
      currentDate.setDate(currentDate.getDate() + 30); // Monthly
      
      const ivRank = Math.random() * 100;
      
      // Only enter if IV rank meets criteria
      if (ivRank >= (entry.ivRank?.min || 50)) {
        const credit = 2.50; // $250 credit per contract
        const maxLoss = 5.00; // $500 max loss (wing width - credit)
        
        // Simulate outcome
        const rand = Math.random();
        let profit: number;
        let exitReason: string;
        
        if (rand < 0.75) { // 75% win rate
          profit = credit * 100; // Full credit ($250)
          exitReason = 'Expired Worthless';
        } else {
          profit = -maxLoss * 100; // Max loss ($500)
          exitReason = 'Stop Loss';
        }
        
        trades.push({
          entryDate: currentDate.toISOString(),
          exitDate: new Date(currentDate.getTime() + 21 * 24 * 60 * 60 * 1000).toISOString(),
          strategy: 'Iron Condor',
          credit: credit * 100,
          maxLoss: maxLoss * 100,
          profit,
          profitPercent: profit / (maxLoss * 100),
          daysHeld: 21,
          ivRankAtEntry: ivRank,
          exitReason,
        });
      }
    }
  }

  // Calculate summary
  const winners = trades.filter(t => t.profit > 0);
  const losers = trades.filter(t => t.profit <= 0);
  const totalProfit = winners.reduce((sum, t) => sum + t.profit, 0);
  const totalLoss = Math.abs(losers.reduce((sum, t) => sum + t.profit, 0));
  
  const result: BacktestResult = {
    assetType: 'OPTION',
    strategy,
    trades,
    summary: {
      totalTrades: trades.length,
      winners: winners.length,
      losers: losers.length,
      winRate: trades.length > 0 ? winners.length / trades.length : 0,
      avgProfit: winners.length > 0 ? totalProfit / winners.length : 0,
      avgLoss: losers.length > 0 ? totalLoss / losers.length : 0,
      totalProfit,
      totalLoss,
      netProfit: totalProfit - totalLoss,
      expectedValue: trades.length > 0 ? (totalProfit - totalLoss) / trades.length : 0,
      maxDrawdown: calculateMaxDrawdown(trades),
      sharpeRatio: calculateSharpeRatio(trades),
      profitFactor: totalLoss > 0 ? totalProfit / totalLoss : 0,
    },
  };

  return NextResponse.json(result);
}

// Helper functions
function simulateAISignal(candle: any, history: any[]) {
  // Simplified AI simulation
  const recentAvg = history.slice(-20).reduce((sum, c) => sum + c.close, 0) / 20;
  const change = (candle.close - recentAvg) / recentAvg;
  
  if (change > 0.05) return { action: 'STRONG_BUY', confidence: 85 };
  if (change > 0.02) return { action: 'BUY', confidence: 70 };
  if (change < -0.05) return { action: 'STRONG_SELL', confidence: 85 };
  if (change < -0.02) return { action: 'SELL', confidence: 70 };
  return { action: 'HOLD', confidence: 50 };
}

function calculateMaxDrawdown(trades: any[]) {
  let peak = 0;
  let maxDD = 0;
  let cumulative = 0;
  
  for (const trade of trades) {
    cumulative += trade.profit;
    if (cumulative > peak) peak = cumulative;
    const dd = peak - cumulative;
    if (dd > maxDD) maxDD = dd;
  }
  
  return maxDD;
}

function calculateSharpeRatio(trades: any[]) {
  if (trades.length === 0) return 0;
  
  const returns = trades.map(t => t.profitPercent);
  const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
  const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
  const stdDev = Math.sqrt(variance);
  
  return stdDev > 0 ? (avgReturn / stdDev) * Math.sqrt(252) : 0; // Annualized
}
