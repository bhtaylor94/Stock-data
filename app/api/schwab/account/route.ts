import { NextRequest, NextResponse } from 'next/server';
import { getSchwabAccessToken, schwabFetchJson } from '@/lib/schwab';

export const runtime = 'nodejs';

// ============================================================
// SCHWAB ACCOUNTS API
// Gets user's Schwab account information
// ============================================================

interface AccountBalance {
  cashBalance: number;
  buyingPower: number;
  equity: number;
  longMarketValue: number;
  shortMarketValue: number;
  availableFunds: number;
}

interface Position {
  symbol: string;
  assetType: string;
  quantity: number;
  averagePrice: number;
  currentPrice: number;
  marketValue: number;
  unrealizedPL: number;
  unrealizedPLPercent: number;
  dayPLPercent: number;
}

export async function GET(req: NextRequest) {
  const startTime = Date.now();
  
  try {
    // Get Schwab access token with trading scope
    const tokenResult = await getSchwabAccessToken('tracker', { forceRefresh: false });
    
    if (!tokenResult.token) {
      return NextResponse.json(
        { 
          error: 'Schwab authentication failed', 
          details: tokenResult.error,
          requiresSetup: true
        },
        { status: 401 }
      );
    }

    // Step 1: Get account hash values
    console.log('[Schwab Accounts] Fetching account numbers...');
    const accountsResult = await schwabFetchJson<any[]>(
      tokenResult.token,
      'https://api.schwabapi.com/trader/v1/accounts/accountNumbers',
      { scope: 'tracker' }
    );

    if (!accountsResult.ok) {
      return NextResponse.json(
        { 
          error: 'Failed to fetch account numbers',
          details: accountsResult.error,
          status: accountsResult.status
        },
        { status: accountsResult.status }
      );
    }

    if (!accountsResult.data || accountsResult.data.length === 0) {
      return NextResponse.json(
        {
          error: 'No accounts found',
          message: 'No Schwab accounts are linked to this API app. Please ensure your brokerage account has API access enabled.'
        },
        { status: 404 }
      );
    }

    // Get first account (most users have one)
    const accountHash = accountsResult.data[0].hashValue;
    const accountNumber = accountsResult.data[0].accountNumber;

    console.log('[Schwab Accounts] Fetching account details for hash:', accountHash.substring(0, 8) + '...');

    // Step 2: Get full account details with positions
    const accountDetailsResult = await schwabFetchJson<any>(
      tokenResult.token,
      `https://api.schwabapi.com/trader/v1/accounts/${accountHash}?fields=positions`,
      { scope: 'tracker' }
    );

    if (!accountDetailsResult.ok) {
      return NextResponse.json(
        {
          error: 'Failed to fetch account details',
          details: accountDetailsResult.error,
          status: accountDetailsResult.status
        },
        { status: accountDetailsResult.status }
      );
    }

    const accountData = accountDetailsResult.data.securitiesAccount;

    // Step 3: Parse balances
    const balances: AccountBalance = {
      cashBalance: accountData.currentBalances.cashBalance || 0,
      buyingPower: accountData.currentBalances.buyingPower || 0,
      equity: accountData.currentBalances.equity || 0,
      longMarketValue: accountData.currentBalances.longMarketValue || 0,
      shortMarketValue: accountData.currentBalances.shortMarketValue || 0,
      availableFunds: accountData.currentBalances.availableFunds || 0,
    };

    // Step 4: Parse positions
    const positions: Position[] = (accountData.positions || []).map((pos: any) => {
      const instrument = pos.instrument;
      const currentPrice = pos.marketValue / pos.longQuantity || 0;
      const unrealizedPL = pos.marketValue - (pos.averagePrice * pos.longQuantity);
      const unrealizedPLPercent = ((currentPrice - pos.averagePrice) / pos.averagePrice) * 100;

      return {
        symbol: instrument.symbol,
        assetType: instrument.assetType,
        quantity: pos.longQuantity || pos.shortQuantity || 0,
        averagePrice: pos.averagePrice,
        currentPrice: currentPrice,
        marketValue: pos.marketValue,
        unrealizedPL: unrealizedPL,
        unrealizedPLPercent: unrealizedPLPercent,
        dayPLPercent: pos.currentDayProfitLossPercentage || 0,
      };
    });

    // Calculate total P&L
    const totalUnrealizedPL = positions.reduce((sum, pos) => sum + pos.unrealizedPL, 0);
    const totalUnrealizedPLPercent = balances.equity > 0 
      ? (totalUnrealizedPL / (balances.equity - totalUnrealizedPL)) * 100 
      : 0;

    // Step 5: Return formatted response
    return NextResponse.json({
      success: true,
      account: {
        accountNumber: accountNumber,
        accountHash: accountHash,
        type: accountData.type,
        isDayTrader: accountData.isDayTrader || false,
        roundTrips: accountData.roundTrips || 0,
      },
      balances: balances,
      positions: positions,
      summary: {
        totalPositions: positions.length,
        totalUnrealizedPL: Math.round(totalUnrealizedPL * 100) / 100,
        totalUnrealizedPLPercent: Math.round(totalUnrealizedPLPercent * 100) / 100,
        portfolioValue: balances.equity,
        cashPercentage: Math.round((balances.cashBalance / balances.equity) * 100) || 0,
      },
      meta: {
        source: 'schwab-live',
        asOf: new Date().toISOString(),
        responseTimeMs: Date.now() - startTime,
      }
    });

  } catch (error: any) {
    console.error('[Schwab Accounts] Error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}
