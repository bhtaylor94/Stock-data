import { NextRequest, NextResponse } from 'next/server';

const POLYGON_KEY = process.env.POLYGON_API_KEY;

export async function GET(
  request: NextRequest,
  { params }: { params: { ticker: string } }
) {
  const ticker = params.ticker.toUpperCase();
  
  try {
    // Get options contracts from Polygon
    const [contractsRes, snapshotRes] = await Promise.all([
      // Get list of options contracts
      fetch(`https://api.polygon.io/v3/reference/options/contracts?underlying_ticker=${ticker}&limit=100&apiKey=${POLYGON_KEY}`)
        .then(r => r.ok ? r.json() : null)
        .catch(() => null),
      
      // Get options chain snapshot (requires paid tier, but we'll try)
      fetch(`https://api.polygon.io/v3/snapshot/options/${ticker}?apiKey=${POLYGON_KEY}`)
        .then(r => r.ok ? r.json() : null)
        .catch(() => null),
    ]);

    const contracts = contractsRes?.results || [];
    const snapshots = snapshotRes?.results || [];
    
    // Get current stock price for ITM calculations
    const stockRes = await fetch(`https://finnhub.io/api/v1/quote?symbol=${ticker}&token=${process.env.FINNHUB_KEY}`)
      .then(r => r.ok ? r.json() : null)
      .catch(() => null);
    
    const currentPrice = stockRes?.c || 0;
    
    // Find nearest expiration date
    const expirations = Array.from(new Set(contracts.map((c: any) => c.expiration_date))).sort();
    const nearestExpiration = expirations[0] || null;
    
    // Filter contracts for nearest expiration
    const nearTermContracts = contracts.filter((c: any) => c.expiration_date === nearestExpiration);
    
    // Separate calls and puts
    const calls = nearTermContracts
      .filter((c: any) => c.contract_type === 'call')
      .sort((a: any, b: any) => a.strike_price - b.strike_price)
      .slice(0, 15)
      .map((c: any) => {
        const snapshot = snapshots.find((s: any) => s.details?.ticker === c.ticker);
        return {
          strike: c.strike_price,
          expiration: c.expiration_date,
          contractSymbol: c.ticker,
          bid: snapshot?.last_quote?.bid || 0,
          ask: snapshot?.last_quote?.ask || 0,
          last: snapshot?.day?.close || 0,
          volume: snapshot?.day?.volume || 0,
          openInterest: snapshot?.open_interest || 0,
          impliedVolatility: snapshot?.implied_volatility || 0,
          delta: snapshot?.greeks?.delta || 0,
          gamma: snapshot?.greeks?.gamma || 0,
          theta: snapshot?.greeks?.theta || 0,
          vega: snapshot?.greeks?.vega || 0,
          itm: currentPrice > c.strike_price,
        };
      });
    
    const puts = nearTermContracts
      .filter((c: any) => c.contract_type === 'put')
      .sort((a: any, b: any) => a.strike_price - b.strike_price)
      .slice(0, 15)
      .map((c: any) => {
        const snapshot = snapshots.find((s: any) => s.details?.ticker === c.ticker);
        return {
          strike: c.strike_price,
          expiration: c.expiration_date,
          contractSymbol: c.ticker,
          bid: snapshot?.last_quote?.bid || 0,
          ask: snapshot?.last_quote?.ask || 0,
          last: snapshot?.day?.close || 0,
          volume: snapshot?.day?.volume || 0,
          openInterest: snapshot?.open_interest || 0,
          impliedVolatility: snapshot?.implied_volatility || 0,
          delta: snapshot?.greeks?.delta || 0,
          gamma: snapshot?.greeks?.gamma || 0,
          theta: snapshot?.greeks?.theta || 0,
          vega: snapshot?.greeks?.vega || 0,
          itm: currentPrice < c.strike_price,
        };
      });
    
    // Calculate aggregate metrics
    const totalCallVolume = calls.reduce((sum: number, c: any) => sum + c.volume, 0);
    const totalPutVolume = puts.reduce((sum: number, c: any) => sum + c.volume, 0);
    const totalCallOI = calls.reduce((sum: number, c: any) => sum + c.openInterest, 0);
    const totalPutOI = puts.reduce((sum: number, c: any) => sum + c.openInterest, 0);
    
    const avgCallIV = calls.length > 0 
      ? calls.reduce((sum: number, c: any) => sum + c.impliedVolatility, 0) / calls.length 
      : 0;
    const avgPutIV = puts.length > 0 
      ? puts.reduce((sum: number, c: any) => sum + c.impliedVolatility, 0) / puts.length 
      : 0;

    const optionsData = {
      ticker,
      currentPrice,
      expiration: nearestExpiration,
      expirations: expirations.slice(0, 6), // Next 6 expirations
      
      calls,
      puts,
      
      // Aggregate metrics
      metrics: {
        putCallRatio: totalCallVolume > 0 ? totalPutVolume / totalCallVolume : 0,
        putCallOIRatio: totalCallOI > 0 ? totalPutOI / totalCallOI : 0,
        totalCallVolume,
        totalPutVolume,
        totalCallOI,
        totalPutOI,
        avgCallIV: avgCallIV * 100, // Convert to percentage
        avgPutIV: avgPutIV * 100,
        avgIV: ((avgCallIV + avgPutIV) / 2) * 100,
      },
      
      timestamp: new Date().toISOString(),
      source: 'polygon',
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
