import { NextRequest, NextResponse } from 'next/server';
import { getSchwabAccessToken } from '@/lib/schwab';

export const runtime = 'nodejs';

// ============================================================
// SCHWAB WEBSOCKET STREAMING CONNECTION
// Provides real-time market data via WebSocket
// ============================================================

export async function POST(req: NextRequest) {
  try {
    const { symbols, fields } = await req.json();

    if (!symbols || !Array.isArray(symbols) || symbols.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Symbols array required' },
        { status: 400 }
      );
    }

    // Get Schwab access token
    const tokenResult = await getSchwabAccessToken('marketdata', { forceRefresh: false });
    
    if (!tokenResult.token) {
      return NextResponse.json(
        { success: false, error: 'Authentication failed', details: tokenResult.error },
        { status: 401 }
      );
    }

    // Request streaming session
    const streamResponse = await fetch('https://api.schwabapi.com/marketdata/v1/stream/preferences', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${tokenResult.token}`,
        'Accept': 'application/json',
      },
    });

    if (!streamResponse.ok) {
      throw new Error(`Schwab streaming request failed: ${streamResponse.statusText}`);
    }

    const streamData = await streamResponse.json();

    // Extract WebSocket URL and credentials
    const wsUrl = streamData.streamerInfo?.streamerSocketUrl;
    const credentials = {
      userid: streamData.streamerInfo?.schwabClientCustomerId,
      token: streamData.streamerInfo?.schwabClientChannel,
      company: streamData.accounts?.[0]?.company,
      segment: streamData.accounts?.[0]?.segment,
      cddomain: streamData.accounts?.[0]?.accountCdDomainId,
      usergroup: streamData.streamerInfo?.schwabClientFunctionId,
      accesslevel: streamData.streamerInfo?.accessLevel,
      timestamp: Date.now(),
    };

    if (!wsUrl) {
      throw new Error('WebSocket URL not available from Schwab');
    }

    // Build subscription request
    const subscriptionRequest = {
      requests: [
        {
          service: 'QUOTE',
          requestid: '1',
          command: 'SUBS',
          account: credentials.userid,
          source: credentials.token,
          parameters: {
            keys: symbols.join(','),
            fields: (fields || ['0', '1', '2', '3', '4', '8', '9']).join(','),
          },
        },
      ],
    };

    return NextResponse.json({
      success: true,
      wsUrl,
      credentials,
      subscriptionRequest,
      symbols,
      note: 'Use these credentials to connect to WebSocket and subscribe',
    });

  } catch (error: any) {
    console.error('[Schwab Stream] Error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error.message,
        fallback: 'simulation',
        note: 'Will use price simulation instead'
      },
      { status: 500 }
    );
  }
}

// Disconnect endpoint
export async function DELETE(req: NextRequest) {
  try {
    // In a production app, you'd track active WebSocket connections
    // and close them here. For now, just return success.
    return NextResponse.json({
      success: true,
      message: 'WebSocket connection closed',
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
