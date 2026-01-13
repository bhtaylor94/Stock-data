import { NextRequest, NextResponse } from 'next/server';
import { getSchwabAccessToken, schwabFetchJson } from '@/lib/schwab';

export const runtime = 'nodejs';

// ============================================================
// PORTFOLIO CONTEXT API
// Returns portfolio data for position-aware recommendations
// ============================================================

interface PortfolioContext {
  positions: Array<{
    symbol: string;
    quantity: number;
    averagePrice: number;
    currentPrice: number;
    marketValue: number;
    unrealizedPL: number;
    unrealizedPLPercent: number;
  }>;
  balances: {
    cashBalance: number;
    buyingPower: number;
    equity: number;
  };
  summary: {
    totalPositions: number;
    portfolioValue: number;
    totalUnrealizedPL: number;
  };
  isDayTrader: boolean;
  roundTrips: number;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const symbol = searchParams.get('symbol'); // Optional: check specific symbol

    // Get Schwab access token
    const tokenResult = await getSchwabAccessToken('tracker', { forceRefresh: false });
    
    if (!tokenResult.token) {
      return NextResponse.json(
        { error: 'Schwab authentication failed', details: tokenResult.error },
        { status: 401 }
      );
    }

    // Fetch account numbers
    const accountsResult = await schwabFetchJson<any[]>(
      tokenResult.token,
      'https://api.schwabapi.com/trader/v1/accounts/accountNumbers',
      { scope: 'tracker' }
    );

    if (!accountsResult.ok || !accountsResult.data || accountsResult.data.length === 0) {
      return NextResponse.json(
        { error: 'Failed to get account information' },
        { status: 500 }
      );
    }

    const accountHash = accountsResult.data[0].hashValue;

    // Fetch full account details with positions
    const accountResult = await schwabFetchJson<any>(
      tokenResult.token,
      `https://api.schwabapi.com/trader/v1/accounts/${accountHash}?fields=positions`,
      { scope: 'tracker' }
    );

    if (!accountResult.ok || !accountResult.data) {
      return NextResponse.json(
        { error: 'Failed to get account details' },
        { status: 500 }
      );
    }

    const account = accountResult.data.securitiesAccount;

    // Build portfolio context
    const positions = (account.positions || []).map((pos: any) => ({
      symbol: pos.instrument?.symbol || 'UNKNOWN',
      quantity: pos.longQuantity || 0,
      averagePrice: pos.averagePrice || 0,
      currentPrice: pos.marketValue ? pos.marketValue / pos.longQuantity : 0,
      marketValue: pos.marketValue || 0,
      unrealizedPL: (pos.marketValue || 0) - (pos.averagePrice || 0) * (pos.longQuantity || 0),
      unrealizedPLPercent: pos.averagePrice 
        ? (((pos.marketValue / pos.longQuantity) - pos.averagePrice) / pos.averagePrice) * 100 
        : 0,
    }));

    const balances = {
      cashBalance: account.currentBalances?.cashBalance || 0,
      buyingPower: account.currentBalances?.buyingPower || 0,
      equity: account.currentBalances?.equity || 0,
    };

    const portfolioValue = balances.equity;
    const totalUnrealizedPL = positions.reduce((sum: number, p: any) => sum + p.unrealizedPL, 0);

    const context: PortfolioContext = {
      positions,
      balances,
      summary: {
        totalPositions: positions.length,
        portfolioValue,
        totalUnrealizedPL,
      },
      isDayTrader: account.isDayTrader || false,
      roundTrips: account.roundTrips || 0,
    };

    // If checking specific symbol, add position details
    let symbolPosition = null;
    if (symbol) {
      symbolPosition = positions.find((p: any) => p.symbol === symbol.toUpperCase());
    }

    return NextResponse.json({
      success: true,
      context,
      symbolPosition,
      meta: {
        timestamp: new Date().toISOString(),
        accountHash: accountHash.substring(0, 8) + '...',
      }
    });

  } catch (error: any) {
    console.error('[Portfolio Context] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}
