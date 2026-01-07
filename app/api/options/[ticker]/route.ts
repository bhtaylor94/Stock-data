import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: { ticker: string } }
) {
  const ticker = params.ticker.toUpperCase();
  
  try {
    // Use Yahoo Finance for FREE full options data (bid, ask, volume, OI, IV)
    const response = await fetch(
      `https://query1.finance.yahoo.com/v7/finance/options/${ticker}`,
      { 
        headers: { 
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        next: { revalidate: 60 } // Cache for 60 seconds
      }
    );
    
    if (!response.ok) {
      return NextResponse.json({ error: 'Failed to fetch options data' }, { status: 500 });
    }
    
    const data = await response.json();
    const result = data.optionChain?.result?.[0];
    
    if (!result) {
      return NextResponse.json({ error: 'No options data available for this ticker' }, { status: 404 });
    }
    
    const currentPrice = result.quote?.regularMarketPrice || 0;
    const expirationTimestamps = result.expirationDates || [];
    
    if (expirationTimestamps.length === 0) {
      return NextResponse.json({ error: 'No options expirations available' }, { status: 404 });
    }
    
    // Get nearest expiration
    const nearestTimestamp = expirationTimestamps[0];
    const nearestExpiration = new Date(nearestTimestamp * 1000).toISOString().split('T')[0];
    
    // Fetch chain for nearest expiration
    const chainResponse = await fetch(
      `https://query1.finance.yahoo.com/v7/finance/options/${ticker}?date=${nearestTimestamp}`,
      { 
        headers: { 
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      }
    );
    
    if (!chainResponse.ok) {
      return NextResponse.json({ error: 'Failed to fetch chain data' }, { status: 500 });
    }
    
    const chainData = await chainResponse.json();
    const options = chainData.optionChain?.result?.[0]?.options?.[0];
    
    if (!options) {
      return NextResponse.json({ error: 'No chain data available' }, { status: 404 });
    }
    
    // Process calls - Yahoo gives us REAL data!
    const calls = (options.calls || [])
      .slice(0, 20) // Limit to 20 strikes around ATM
      .map((c: any) => ({
        strike: c.strike,
        last: c.lastPrice || 0,
        bid: c.bid || 0,
        ask: c.ask || 0,
        volume: c.volume || 0,
        openInterest: c.openInterest || 0,
        impliedVolatility: c.impliedVolatility || 0,
        itm: c.inTheMoney || false,
        change: c.change || 0,
        percentChange: c.percentChange || 0,
        contractSymbol: c.contractSymbol,
      }));
    
    // Process puts
    const puts = (options.puts || [])
      .slice(0, 20)
      .map((p: any) => ({
        strike: p.strike,
        last: p.lastPrice || 0,
        bid: p.bid || 0,
        ask: p.ask || 0,
        volume: p.volume || 0,
        openInterest: p.openInterest || 0,
        impliedVolatility: p.impliedVolatility || 0,
        itm: p.inTheMoney || false,
        change: p.change || 0,
        percentChange: p.percentChange || 0,
        contractSymbol: p.contractSymbol,
      }));
    
    // Calculate aggregate metrics
    const totalCallVolume = calls.reduce((sum: number, c: any) => sum + (c.volume || 0), 0);
    const totalPutVolume = puts.reduce((sum: number, p: any) => sum + (p.volume || 0), 0);
    const totalCallOI = calls.reduce((sum: number, c: any) => sum + (c.openInterest || 0), 0);
    const totalPutOI = puts.reduce((sum: number, p: any) => sum + (p.openInterest || 0), 0);
    
    // Calculate average IV
    const callIVs = calls.filter((c: any) => c.impliedVolatility > 0).map((c: any) => c.impliedVolatility);
    const putIVs = puts.filter((p: any) => p.impliedVolatility > 0).map((p: any) => p.impliedVolatility);
    const allIVs = [...callIVs, ...putIVs];
    
    const avgCallIV = callIVs.length > 0 ? callIVs.reduce((a: number, b: number) => a + b, 0) / callIVs.length : 0;
    const avgPutIV = putIVs.length > 0 ? putIVs.reduce((a: number, b: number) => a + b, 0) / putIVs.length : 0;
    const avgIV = allIVs.length > 0 ? allIVs.reduce((a: number, b: number) => a + b, 0) / allIVs.length : 0;
    
    // Convert expiration timestamps to dates for UI
    const expirations = expirationTimestamps.slice(0, 6).map((ts: number) => 
      new Date(ts * 1000).toISOString().split('T')[0]
    );

    const optionsData = {
      ticker,
      currentPrice,
      expiration: nearestExpiration,
      expirations,
      
      calls,
      puts,
      
      metrics: {
        putCallRatio: totalCallVolume > 0 ? (totalPutVolume / totalCallVolume).toFixed(2) : '0.00',
        putCallOIRatio: totalCallOI > 0 ? (totalPutOI / totalCallOI).toFixed(2) : '0.00',
        totalCallVolume,
        totalPutVolume,
        totalCallOI,
        totalPutOI,
        avgCallIV: (avgCallIV * 100).toFixed(1),
        avgPutIV: (avgPutIV * 100).toFixed(1),
        avgIV: (avgIV * 100).toFixed(1),
      },
      
      timestamp: new Date().toISOString(),
      source: 'yahoo',
    };

    return NextResponse.json(optionsData);
    
  } catch (error) {
    console.error('Options API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch options data', ticker },
      { status: 500 }
    );
  }
}
