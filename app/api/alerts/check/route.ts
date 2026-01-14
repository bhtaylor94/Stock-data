// app/api/alerts/check/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getSchwabAccessToken } from '@/lib/schwab';

export const runtime = 'nodejs';

function baseUrlFromEnv(): string {
  const explicit = (process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || '').trim();
  if (explicit) return explicit.replace(/\/$/, '');
  const vercel = (process.env.VERCEL_URL || '').trim();
  if (vercel) return `https://${vercel}`;
  return 'http://localhost:3000';
}

export async function GET() {
  // The top-level app polls this endpoint; keep it safe even if there are no persisted alerts.
  return NextResponse.json({ checked: 0, triggered: 0, alerts: [] });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const alerts = Array.isArray(body.alerts) ? body.alerts : [];
    const tokenResult = await getSchwabAccessToken('options');
    
    if (!tokenResult.token) {
      throw new Error('Failed to get Schwab access token');
    }
    
    const accessToken = tokenResult.token;
    
    const triggered: any[] = [];

    for (const alert of alerts) {
      let shouldTrigger = false;
      let message = '';

      // ============================================================
      // STOCK ALERTS
      // ============================================================
      if (alert.assetType === 'STOCK') {
        // Get current stock data
        const quoteRes = await fetch(
          `https://api.schwabapi.com/marketdata/v1/quotes?symbols=${alert.ticker}`,
          { headers: { 'Authorization': `Bearer ${accessToken}` }}
        );
        const quoteData = await quoteRes.json();
        const quote = quoteData[alert.ticker]?.quote;

        if (!quote) continue;

        switch (alert.type) {
          case 'PRICE_TARGET':
            const targetPrice = alert.conditions.targetPrice;
            const direction = alert.conditions.direction; // 'ABOVE' | 'BELOW'
            
            if (direction === 'ABOVE' && quote.lastPrice >= targetPrice) {
              shouldTrigger = true;
              message = `${alert.ticker} hit ${targetPrice}! Now at $${quote.lastPrice}`;
            } else if (direction === 'BELOW' && quote.lastPrice <= targetPrice) {
              shouldTrigger = true;
              message = `${alert.ticker} dropped to ${targetPrice}! Now at $${quote.lastPrice}`;
            }
            break;

          case 'VOLUME_SPIKE':
            const avgVolume = alert.conditions.avgVolume || quote.totalVolume * 0.5;
            const multiplier = alert.conditions.multiplier || 2;
            
            if (quote.totalVolume > avgVolume * multiplier) {
              shouldTrigger = true;
              message = `${alert.ticker} volume spike! ${(quote.totalVolume / avgVolume).toFixed(1)}x average`;
            }
            break;

          case 'PRICE_BREAKOUT':
            const resistance = alert.conditions.resistance;
            const support = alert.conditions.support;
            
            if (resistance && quote.lastPrice > resistance) {
              shouldTrigger = true;
              message = `${alert.ticker} broke resistance at $${resistance}!`;
            } else if (support && quote.lastPrice < support) {
              shouldTrigger = true;
              message = `${alert.ticker} broke support at $${support}!`;
            }
            break;

          case 'AI_SIGNAL':
            // Check our AI analysis
            const analysisRes = await fetch(`${baseUrlFromEnv()}/api/stock/${alert.ticker}`, { cache: 'no-store' });
            const analysis = await analysisRes.json();
            
            const rating = analysis.meta?.tradeDecision?.action;
            if (rating === 'STRONG_BUY' || rating === 'STRONG_SELL') {
              shouldTrigger = true;
              message = `${alert.ticker} AI Signal: ${rating}! (${analysis.meta.tradeDecision.confidence}% confidence)`;
            }
            break;
        }
      }

      // ============================================================
      // OPTION ALERTS
      // ============================================================
      else if (alert.assetType === 'OPTION') {
        // Get options flow data
        const flowRes = await fetch(`${baseUrlFromEnv()}/api/options/flow/${alert.ticker}`, { cache: 'no-store' });
        const flowData = await flowRes.json();

        switch (alert.type) {
          case 'UNUSUAL_ACTIVITY':
            const minPremium = alert.conditions.minPremium || 500000;
            const sentiment = alert.conditions.sentiment; // 'BULLISH' | 'BEARISH' | 'ANY'
            
            const bigAlerts = flowData.unusualActivity.filter((a: any) => 
              a.metrics.premium >= minPremium &&
              (sentiment === 'ANY' || a.sentiment === sentiment)
            );

            if (bigAlerts.length > 0) {
              shouldTrigger = true;
              const top = bigAlerts[0];
              message = `${alert.ticker} ${top.activityType}: ${top.sentiment} - $${(top.metrics.premium / 1000).toFixed(0)}k premium`;
            }
            break;

          case 'IV_SPIKE':
            const ivThreshold = alert.conditions.ivThreshold || 0.5; // 50% IV
            
            if (flowData.flowMetrics.avgIV > ivThreshold) {
              shouldTrigger = true;
              message = `${alert.ticker} IV spike! Now at ${(flowData.flowMetrics.avgIV * 100).toFixed(0)}%`;
            }
            break;

          case 'PUT_CALL_EXTREME':
            const pcRatio = flowData.flowMetrics.putCallRatio;
            
            if (pcRatio > 1.5) {
              shouldTrigger = true;
              message = `${alert.ticker} extreme bearish flow! P/C ratio: ${pcRatio.toFixed(2)}`;
            } else if (pcRatio < 0.5) {
              shouldTrigger = true;
              message = `${alert.ticker} extreme bullish flow! P/C ratio: ${pcRatio.toFixed(2)}`;
            }
            break;

          case 'STRATEGY_SETUP':
            const idealStrategy = alert.conditions.strategy; // 'IRON_CONDOR', 'BUTTERFLY', etc.
            
            const matchingStrategies = flowData.strategies.filter((s: any) => 
              s.type === idealStrategy && s.confidence >= 75
            );

            if (matchingStrategies.length > 0) {
              shouldTrigger = true;
              message = `${alert.ticker} ${idealStrategy} setup detected! Confidence: ${matchingStrategies[0].confidence}%`;
            }
            break;
        }
      }

      // Add to triggered list
      if (shouldTrigger) {
        triggered.push({
          ...alert,
          triggeredAt: new Date().toISOString(),
          message,
        });
      }
    }

    // ============================================================
    // SEND NOTIFICATIONS
    // ============================================================
    for (const alert of triggered) {
      // TODO: Actually send emails/SMS/push notifications
      console.log(`ALERT: ${alert.message}`);
    }

    return NextResponse.json({
      checked: alerts.length,
      triggered: triggered.length,
      alerts: triggered,
    });

  } catch (error: any) {
    console.error('Alert check error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
