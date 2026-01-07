import { NextRequest, NextResponse } from 'next/server';

// Token cache (in-memory for serverless - will reset on cold start)
let cachedAccessToken: string | null = null;
let tokenExpiry: number = 0;

async function getAccessToken(): Promise<string | null> {
  const appKey = process.env.SCHWAB_APP_KEY;
  const appSecret = process.env.SCHWAB_APP_SECRET;
  const refreshToken = process.env.SCHWAB_REFRESH_TOKEN;

  if (!appKey || !appSecret || !refreshToken) {
    console.error('Missing Schwab credentials');
    return null;
  }

  // Return cached token if still valid (with 1 min buffer)
  if (cachedAccessToken && Date.now() < tokenExpiry - 60000) {
    return cachedAccessToken;
  }

  try {
    const credentials = Buffer.from(`${appKey}:${appSecret}`).toString('base64');
    
    const response = await fetch('https://api.schwabapi.com/v1/oauth/token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        'grant_type': 'refresh_token',
        'refresh_token': refreshToken,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Token refresh failed:', errorText);
      return null;
    }

    const data = await response.json();
    cachedAccessToken = data.access_token;
    tokenExpiry = Date.now() + (data.expires_in * 1000); // expires_in is in seconds
    
    return cachedAccessToken;
  } catch (error) {
    console.error('Error refreshing token:', error);
    return null;
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { ticker: string } }
) {
  const ticker = params.ticker.toUpperCase();
  
  try {
    const accessToken = await getAccessToken();
    
    if (!accessToken) {
      return NextResponse.json(
        { error: 'Failed to authenticate with Schwab. Check your credentials.' },
        { status: 401 }
      );
    }

    // Fetch options chain from Schwab
    const response = await fetch(
      `https://api.schwabapi.com/marketdata/v1/chains?symbol=${ticker}&contractType=ALL&strikeCount=20&includeUnderlyingQuote=true`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json',
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Schwab API error:', errorText);
      return NextResponse.json(
        { error: 'Failed to fetch options data from Schwab' },
        { status: response.status }
      );
    }

    const data = await response.json();

    // Process calls
    const callExpDateMap = data.callExpDateMap || {};
    const calls: any[] = [];
    
    // Get the nearest expiration
    const callExpirations = Object.keys(callExpDateMap).sort();
    const nearestCallExp = callExpirations[0];
    
    if (nearestCallExp && callExpDateMap[nearestCallExp]) {
      const strikesMap = callExpDateMap[nearestCallExp];
      for (const strike of Object.keys(strikesMap)) {
        const contract = strikesMap[strike][0]; // First contract at this strike
        if (contract) {
          calls.push({
            strike: parseFloat(strike),
            last: contract.last || 0,
            bid: contract.bid || 0,
            ask: contract.ask || 0,
            volume: contract.totalVolume || 0,
            openInterest: contract.openInterest || 0,
            impliedVolatility: contract.volatility || 0,
            delta: contract.delta || 0,
            gamma: contract.gamma || 0,
            theta: contract.theta || 0,
            vega: contract.vega || 0,
            itm: contract.inTheMoney || false,
            contractSymbol: contract.symbol,
          });
        }
      }
    }

    // Process puts
    const putExpDateMap = data.putExpDateMap || {};
    const puts: any[] = [];
    
    const putExpirations = Object.keys(putExpDateMap).sort();
    const nearestPutExp = putExpirations[0];
    
    if (nearestPutExp && putExpDateMap[nearestPutExp]) {
      const strikesMap = putExpDateMap[nearestPutExp];
      for (const strike of Object.keys(strikesMap)) {
        const contract = strikesMap[strike][0];
        if (contract) {
          puts.push({
            strike: parseFloat(strike),
            last: contract.last || 0,
            bid: contract.bid || 0,
            ask: contract.ask || 0,
            volume: contract.totalVolume || 0,
            openInterest: contract.openInterest || 0,
            impliedVolatility: contract.volatility || 0,
            delta: contract.delta || 0,
            gamma: contract.gamma || 0,
            theta: contract.theta || 0,
            vega: contract.vega || 0,
            itm: contract.inTheMoney || false,
            contractSymbol: contract.symbol,
          });
        }
      }
    }

    // Sort by strike
    calls.sort((a, b) => a.strike - b.strike);
    puts.sort((a, b) => a.strike - b.strike);

    // Calculate aggregate metrics
    const totalCallVolume = calls.reduce((sum, c) => sum + c.volume, 0);
    const totalPutVolume = puts.reduce((sum, p) => sum + p.volume, 0);
    const totalCallOI = calls.reduce((sum, c) => sum + c.openInterest, 0);
    const totalPutOI = puts.reduce((sum, p) => sum + p.openInterest, 0);
    
    const callIVs = calls.filter(c => c.impliedVolatility > 0).map(c => c.impliedVolatility);
    const putIVs = puts.filter(p => p.impliedVolatility > 0).map(p => p.impliedVolatility);
    const allIVs = [...callIVs, ...putIVs];
    
    const avgIV = allIVs.length > 0 
      ? allIVs.reduce((a, b) => a + b, 0) / allIVs.length 
      : 0;

    // Get expiration date in readable format
    const expiration = nearestCallExp ? nearestCallExp.split(':')[0] : null;

    const optionsData = {
      ticker,
      currentPrice: data.underlyingPrice || data.underlying?.last || 0,
      expiration,
      expirations: callExpirations.slice(0, 6).map(e => e.split(':')[0]),
      
      calls,
      puts,
      
      metrics: {
        putCallRatio: totalCallVolume > 0 ? (totalPutVolume / totalCallVolume).toFixed(2) : '0.00',
        putCallOIRatio: totalCallOI > 0 ? (totalPutOI / totalCallOI).toFixed(2) : '0.00',
        totalCallVolume,
        totalPutVolume,
        totalCallOI,
        totalPutOI,
        avgIV: avgIV.toFixed(1),
      },
      
      timestamp: new Date().toISOString(),
      source: 'schwab',
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
