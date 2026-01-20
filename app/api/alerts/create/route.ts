// app/api/alerts/create/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      type,
      ticker,
      assetType, // 'STOCK' | 'OPTION'
      conditions,
      notificationMethod,
      userId
    } = body;

    // ============================================================
    // ALERT TYPES FOR STOCKS & OPTIONS
    // ============================================================
    // STOCK ALERTS:
    // - PRICE_TARGET (hit target price)
    // - PRICE_BREAKOUT (breaks resistance/support)
    // - VOLUME_SPIKE (unusual volume)
    // - ANALYST_UPGRADE (rating change)
    // - EARNINGS_DATE (approaching earnings)
    // - INSIDER_ACTIVITY (insider buying/selling)
    // - AI_SIGNAL (12 investors agree on BUY/SELL)
    //
    // OPTION ALERTS:
    // - UNUSUAL_ACTIVITY (sweeps, blocks)
    // - IV_SPIKE (volatility increase)
    // - GAMMA_SQUEEZE (potential squeeze)
    // - MAX_PAIN_SHIFT (max pain moved)
    // - PUT_CALL_EXTREME (extreme ratio)
    // - STRATEGY_SETUP (ideal Iron Condor conditions)

    const alert = {
      id: `alert_${Date.now()}`,
      userId,
      type,
      ticker,
      assetType,
      conditions,
      notificationMethod,
      active: true,
      triggered: false,
      createdAt: new Date().toISOString(),
      lastChecked: null,
    };

    // TODO: Store in database
    // For now, return success

    return NextResponse.json({
      success: true,
      alert,
      message: `Alert created for ${ticker} (${assetType})`
    });

  } catch (error: any) {
    console.error('Alert creation error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
