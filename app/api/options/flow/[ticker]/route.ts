// app/api/options/flow/[ticker]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { UnusualActivityDetector } from '@/lib/unusualActivityDetector';
import { suggestStrategy } from '@/lib/optionsStrategySuggestions';
import { getSchwabAccessToken } from '@/lib/schwab';

interface OptionsFlowData {
  unusualActivity: any[];
  strategies: any[];
  flowMetrics: {
    totalCallVolume: number;
    totalPutVolume: number;
    putCallRatio: number;
    avgIV: number;
    maxPain: number;
  };
  topContracts: any[];
}

export async function GET(
  request: NextRequest,
  { params }: { params: { ticker: string } }
) {
  try {
    const ticker = params.ticker;
    
    // ============================================================
    // 1. GET SCHWAB ACCESS TOKEN
    // ============================================================
    const accessToken = await getSchwabAccessToken();
    
    // ============================================================
    // 2. FETCH CURRENT STOCK PRICE FROM SCHWAB
    // ============================================================
    const quoteRes = await fetch(
      `https://api.schwabapi.com/marketdata/v1/quotes?symbols=${ticker}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json'
        }
      }
    );
    
    if (!quoteRes.ok) {
      throw new Error(`Schwab quote API error: ${quoteRes.status}`);
    }
    
    const quoteData = await quoteRes.json();
    const currentPrice = quoteData[ticker]?.quote?.lastPrice || 0;
    
    if (!currentPrice) {
      throw new Error('Could not fetch current price');
    }

    // ============================================================
    // 3. FETCH OPTIONS CHAIN FROM SCHWAB
    // ============================================================
    const today = new Date();
    const sixMonthsOut = new Date(today);
    sixMonthsOut.setMonth(sixMonthsOut.getMonth() + 6);
    
    const fromDate = today.toISOString().split('T')[0];
    const toDate = sixMonthsOut.toISOString().split('T')[0];
    
    const optionsUrl = `https://api.schwabapi.com/marketdata/v1/chains?symbol=${ticker}&contractType=ALL&includeUnderlyingQuote=true&fromDate=${fromDate}&toDate=${toDate}&range=ALL`;
    
    const optionsRes = await fetch(optionsUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json'
      }
    });
    
    if (!optionsRes.ok) {
      throw new Error(`Schwab options API error: ${optionsRes.status}`);
    }
    
    const optionsData = await optionsRes.json();

    // ============================================================
    // 4. PARSE SCHWAB OPTIONS CHAIN
    // ============================================================
    const optionsChain: any[] = [];
    const volumeMap = new Map<string, number>();
    let totalCallVolume = 0;
    let totalPutVolume = 0;
    let totalIV = 0;
    let ivCount = 0;

    // Process call options
    if (optionsData.callExpDateMap) {
      Object.entries(optionsData.callExpDateMap).forEach(([expDate, strikes]: [string, any]) => {
        Object.entries(strikes).forEach(([strikeStr, options]: [string, any]) => {
          const optionArray = Array.isArray(options) ? options : [options];
          optionArray.forEach((option: any) => {
            const volume = option.totalVolume || 0;
            const openInterest = option.openInterest || 0;
            const iv = option.volatility || 0;
            
            totalCallVolume += volume;
            if (iv > 0) {
              totalIV += iv;
              ivCount++;
            }
            
            optionsChain.push({
              symbol: option.symbol,
              strike: parseFloat(strikeStr),
              expiration: expDate.split(':')[0],
              type: 'call',
              bid: option.bid || 0,
              ask: option.ask || 0,
              last: option.last || 0,
              volume: volume,
              openInterest: openInterest,
              impliedVolatility: iv,
              delta: option.delta || 0,
              gamma: option.gamma || 0,
              theta: option.theta || 0,
              vega: option.vega || 0,
            });
            
            // Store volume for historical comparison
            volumeMap.set(option.symbol, volume);
          });
        });
      });
    }

    // Process put options
    if (optionsData.putExpDateMap) {
      Object.entries(optionsData.putExpDateMap).forEach(([expDate, strikes]: [string, any]) => {
        Object.entries(strikes).forEach(([strikeStr, options]: [string, any]) => {
          const optionArray = Array.isArray(options) ? options : [options];
          optionArray.forEach((option: any) => {
            const volume = option.totalVolume || 0;
            const openInterest = option.openInterest || 0;
            const iv = option.volatility || 0;
            
            totalPutVolume += volume;
            if (iv > 0) {
              totalIV += iv;
              ivCount++;
            }
            
            optionsChain.push({
              symbol: option.symbol,
              strike: parseFloat(strikeStr),
              expiration: expDate.split(':')[0],
              type: 'put',
              bid: option.bid || 0,
              ask: option.ask || 0,
              last: option.last || 0,
              volume: volume,
              openInterest: openInterest,
              impliedVolatility: iv,
              delta: option.delta || 0,
              gamma: option.gamma || 0,
              theta: option.theta || 0,
              vega: option.vega || 0,
            });
            
            volumeMap.set(option.symbol, volume);
          });
        });
      });
    }

    // ============================================================
    // 5. CALCULATE AVERAGE VOLUME (Estimate 30-day average)
    // ============================================================
    // In production, you'd fetch historical data
    // For now, estimate: assume today's volume is 150% of average
    const avgVolumeMap = new Map<string, number>();
    optionsChain.forEach((opt) => {
      avgVolumeMap.set(opt.symbol, opt.volume * 0.67); // Today is ~1.5x average
    });

    // ============================================================
    // 6. RUN UNUSUAL ACTIVITY DETECTION
    // ============================================================
    const detector = new UnusualActivityDetector();
    
    const unusualActivity = detector.detectUnusualActivity({
      symbol: ticker,
      optionsData: optionsChain,
      volumeHistory: avgVolumeMap
    });

    // Sort by severity and confidence
    const sortedAlerts = unusualActivity
      .sort((a: any, b: any) => {
        const severityOrder: any = { EXTREME: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
        if (a.severity !== b.severity) {
          return severityOrder[b.severity] - severityOrder[a.severity];
        }
        return b.confidence - a.confidence;
      })
      .slice(0, 10);

    // ============================================================
    // 7. CALCULATE METRICS
    // ============================================================
    const avgIV = ivCount > 0 ? totalIV / ivCount : 0;
    const putCallRatio = totalCallVolume > 0 ? totalPutVolume / totalCallVolume : 0;
    
    // Calculate IV Rank (simplified - real version needs 52-week IV history)
    const ivRank = avgIV > 0.5 ? 80 : avgIV > 0.4 ? 65 : avgIV > 0.3 ? 50 : avgIV > 0.2 ? 35 : 20;

    // Determine outlook from put/call ratio
    let outlook: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
    if (putCallRatio < 0.7) outlook = 'BULLISH';
    else if (putCallRatio > 1.3) outlook = 'BEARISH';
    else outlook = 'NEUTRAL';

    // ============================================================
    // 8. CALCULATE MAX PAIN
    // ============================================================
    const strikeOI = new Map<number, number>();
    optionsChain.forEach((opt) => {
      const current = strikeOI.get(opt.strike) || 0;
      strikeOI.set(opt.strike, current + opt.openInterest);
    });
    
    const maxPain = Array.from(strikeOI.entries())
      .sort((a, b) => b[1] - a[1])[0]?.[0] || currentPrice;

    // ============================================================
    // 9. GENERATE STRATEGY SUGGESTIONS
    // ============================================================
    const strategies = suggestStrategy({
      ticker,
      currentPrice,
      ivRank,
      outlook,
      optionsChain,
      greeks: {
        delta: 0,
        gamma: 0,
        theta: 0,
        vega: 0,
      }
    });

    const topStrategies = strategies
      .sort((a: any, b: any) => b.confidence - a.confidence)
      .slice(0, 5);

    // ============================================================
    // 10. FIND TOP CONTRACTS BY ACTIVITY
    // ============================================================
    const topContracts = optionsChain
      .filter((opt) => opt.volume > 0)
      .sort((a, b) => b.volume - a.volume)
      .slice(0, 20)
      .map((opt) => ({
        symbol: opt.symbol,
        strike: opt.strike,
        expiration: opt.expiration,
        type: opt.type,
        volume: opt.volume,
        openInterest: opt.openInterest,
        volumeOIRatio: opt.openInterest > 0 ? opt.volume / opt.openInterest : 0,
        premium: opt.last * opt.volume * 100,
        iv: opt.impliedVolatility,
      }));

    // ============================================================
    // 11. RETURN COMPLETE FLOW DATA
    // ============================================================
    const flowData: OptionsFlowData = {
      unusualActivity: sortedAlerts,
      strategies: topStrategies,
      flowMetrics: {
        totalCallVolume,
        totalPutVolume,
        putCallRatio,
        avgIV,
        maxPain,
      },
      topContracts,
    };

    return NextResponse.json(flowData);

  } catch (error: any) {
    console.error('Options flow error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch options flow' },
      { status: 500 }
    );
  }
}
