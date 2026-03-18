// app/api/debug/route.js
// Shows raw Schwab chain structure so we can see the actual format

import { NextResponse } from 'next/server';
import { getAccessToken } from '@/lib/schwab';

export async function GET() {
  try {
    const token = await getAccessToken();
    if (!token) return NextResponse.json({ error: 'Auth failed' }, { status: 401 });

    // Fetch SPY chain with minimal params
    const fromDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const toDate = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const chainRes = await fetch(
      `https://api.schwabapi.com/marketdata/v1/chains?symbol=SPY&contractType=ALL&includeUnderlyingQuote=true&fromDate=${fromDate}&toDate=${toDate}&strikeCount=5`,
      { headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' } }
    );

    const chainData = await chainRes.json();

    // Get the first call expiration and show its structure
    const callMap = chainData.callExpDateMap || {};
    const firstExpKey = Object.keys(callMap)[0];
    const firstExpData = firstExpKey ? callMap[firstExpKey] : null;

    // Show the structure — is it an array? An object keyed by strike?
    let structureInfo = null;
    if (firstExpData) {
      structureInfo = {
        type: typeof firstExpData,
        isArray: Array.isArray(firstExpData),
        keys: typeof firstExpData === 'object' && !Array.isArray(firstExpData) ? Object.keys(firstExpData).slice(0, 5) : null,
        sample: JSON.stringify(firstExpData).substring(0, 1500),
      };
    }

    // Also try the quotes endpoint with different formats
    let quoteResult = null;
    try {
      // Try format 1: /quotes?symbols=
      const q1 = await fetch(
        `https://api.schwabapi.com/marketdata/v1/quotes?symbols=AAPL&fields=quote`,
        { headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' } }
      );
      quoteResult = { status: q1.status, body: await q1.text() };
    } catch (e) {
      quoteResult = { error: e.message };
    }

    return NextResponse.json({
      chainStatus: chainRes.status,
      underlyingPrice: chainData.underlyingPrice,
      callExpKeys: Object.keys(callMap).slice(0, 3),
      firstExpKey,
      firstExpStructure: structureInfo,
      quoteEndpointTest: quoteResult,
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
