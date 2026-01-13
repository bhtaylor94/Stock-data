import { NextRequest, NextResponse } from 'next/server';
import { getSchwabAccessToken, schwabFetchJson } from '@/lib/schwab';

export const runtime = 'nodejs';

// ============================================================
// SCHWAB ORDER PLACEMENT API
// Places market, limit, and stop orders for stocks and options
// ============================================================

interface OrderRequest {
  symbol: string;
  quantity: number;
  orderType: 'MARKET' | 'LIMIT' | 'STOP' | 'STOP_LIMIT';
  instruction: 'BUY' | 'SELL' | 'BUY_TO_OPEN' | 'SELL_TO_CLOSE' | 'BUY_TO_CLOSE' | 'SELL_TO_OPEN';
  assetType: 'EQUITY' | 'OPTION';
  price?: number;
  stopPrice?: number;
  duration?: 'DAY' | 'GTC' | 'FILL_OR_KILL';
}

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  
  try {
    const body: OrderRequest = await req.json();
    
    // Validation
    if (!body.symbol || !body.quantity || !body.orderType || !body.instruction) {
      return NextResponse.json(
        { error: 'Missing required fields: symbol, quantity, orderType, instruction' },
        { status: 400 }
      );
    }

    // Validate limit/stop prices
    if (body.orderType === 'LIMIT' && !body.price) {
      return NextResponse.json(
        { error: 'Limit orders require a price' },
        { status: 400 }
      );
    }

    if ((body.orderType === 'STOP' || body.orderType === 'STOP_LIMIT') && !body.stopPrice) {
      return NextResponse.json(
        { error: 'Stop orders require a stopPrice' },
        { status: 400 }
      );
    }

    console.log('[Schwab Order] Placing order:', {
      symbol: body.symbol,
      quantity: body.quantity,
      type: body.orderType,
      instruction: body.instruction
    });

    // Step 1: Get Schwab access token
    const tokenResult = await getSchwabAccessToken('tracker', { forceRefresh: false });
    
    if (!tokenResult.token) {
      return NextResponse.json(
        { 
          error: 'Schwab authentication failed', 
          details: tokenResult.error 
        },
        { status: 401 }
      );
    }

    // Step 2: Get account hash
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

    // Step 3: Build order payload
    const orderPayload: any = {
      orderType: body.orderType,
      session: 'NORMAL',
      duration: body.duration || 'DAY',
      orderStrategyType: 'SINGLE',
      orderLegCollection: [{
        instruction: body.instruction,
        quantity: body.quantity,
        instrument: {
          symbol: body.symbol,
          assetType: body.assetType || 'EQUITY'
        }
      }]
    };

    // Add price for limit orders
    if (body.orderType === 'LIMIT') {
      orderPayload.price = body.price;
    }

    // Add stop price for stop orders
    if (body.orderType === 'STOP' || body.orderType === 'STOP_LIMIT') {
      orderPayload.stopPrice = body.stopPrice;
      if (body.orderType === 'STOP_LIMIT') {
        orderPayload.price = body.price;
      }
    }

    console.log('[Schwab Order] Payload:', JSON.stringify(orderPayload, null, 2));

    // Step 4: Place order
    const orderResponse = await fetch(
      `https://api.schwabapi.com/trader/v1/accounts/${accountHash}/orders`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${tokenResult.token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(orderPayload)
      }
    );

    // Schwab returns 201 with order ID in Location header
    if (orderResponse.status === 201) {
      const locationHeader = orderResponse.headers.get('location');
      const orderId = locationHeader?.split('/').pop() || 'unknown';

      console.log('[Schwab Order] SUCCESS - Order placed:', orderId);

      return NextResponse.json({
        success: true,
        orderId: orderId,
        message: 'Order placed successfully',
        order: {
          symbol: body.symbol,
          quantity: body.quantity,
          orderType: body.orderType,
          instruction: body.instruction,
          price: body.price,
          stopPrice: body.stopPrice
        },
        meta: {
          responseTimeMs: Date.now() - startTime,
          timestamp: new Date().toISOString()
        }
      });
    }

    // Handle errors
    const errorText = await orderResponse.text();
    let errorData: any = {};
    try {
      errorData = JSON.parse(errorText);
    } catch {
      errorData = { message: errorText };
    }

    console.error('[Schwab Order] FAILED:', orderResponse.status, errorData);

    return NextResponse.json(
      {
        error: 'Order placement failed',
        status: orderResponse.status,
        details: errorData.message || errorText,
        schwabError: errorData
      },
      { status: orderResponse.status }
    );

  } catch (error: any) {
    console.error('[Schwab Order] Exception:', error);
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

// ============================================================
// GET ORDER STATUS
// Check status of a specific order
// ============================================================

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const orderId = searchParams.get('orderId');

  if (!orderId) {
    return NextResponse.json(
      { error: 'orderId query parameter required' },
      { status: 400 }
    );
  }

  try {
    // Get token and account hash
    const tokenResult = await getSchwabAccessToken('tracker', { forceRefresh: false });
    if (!tokenResult.token) {
      return NextResponse.json({ error: 'Authentication failed' }, { status: 401 });
    }

    const accountsResult = await schwabFetchJson<any[]>(
      tokenResult.token,
      'https://api.schwabapi.com/trader/v1/accounts/accountNumbers',
      { scope: 'tracker' }
    );

    if (!accountsResult.ok || !accountsResult.data || accountsResult.data.length === 0) {
      return NextResponse.json({ error: 'Failed to get account' }, { status: 500 });
    }

    const accountHash = accountsResult.data[0].hashValue;

    // Get order details
    const orderResult = await schwabFetchJson<any>(
      tokenResult.token,
      `https://api.schwabapi.com/trader/v1/accounts/${accountHash}/orders/${orderId}`,
      { scope: 'tracker' }
    );

    if (!orderResult.ok) {
      return NextResponse.json(
        { error: 'Failed to get order status', details: orderResult.error },
        { status: orderResult.status }
      );
    }

    return NextResponse.json({
      success: true,
      order: orderResult.data
    });

  } catch (error: any) {
    console.error('[Schwab Order Status] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}

// ============================================================
// CANCEL ORDER
// Cancel a pending order
// ============================================================

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const orderId = searchParams.get('orderId');

  if (!orderId) {
    return NextResponse.json(
      { error: 'orderId query parameter required' },
      { status: 400 }
    );
  }

  try {
    // Get token and account hash
    const tokenResult = await getSchwabAccessToken('tracker', { forceRefresh: false });
    if (!tokenResult.token) {
      return NextResponse.json({ error: 'Authentication failed' }, { status: 401 });
    }

    const accountsResult = await schwabFetchJson<any[]>(
      tokenResult.token,
      'https://api.schwabapi.com/trader/v1/accounts/accountNumbers',
      { scope: 'tracker' }
    );

    if (!accountsResult.ok || !accountsResult.data || accountsResult.data.length === 0) {
      return NextResponse.json({ error: 'Failed to get account' }, { status: 500 });
    }

    const accountHash = accountsResult.data[0].hashValue;

    // Cancel order
    const cancelResponse = await fetch(
      `https://api.schwabapi.com/trader/v1/accounts/${accountHash}/orders/${orderId}`,
      {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${tokenResult.token}`
        }
      }
    );

    if (cancelResponse.status === 200 || cancelResponse.status === 204) {
      return NextResponse.json({
        success: true,
        message: 'Order cancelled successfully',
        orderId: orderId
      });
    }

    const errorText = await cancelResponse.text();
    return NextResponse.json(
      { error: 'Failed to cancel order', details: errorText },
      { status: cancelResponse.status }
    );

  } catch (error: any) {
    console.error('[Schwab Order Cancel] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}
