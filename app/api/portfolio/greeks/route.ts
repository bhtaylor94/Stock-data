// app/api/portfolio/greeks/route.ts
import { NextResponse } from 'next/server';
import { getSchwabAccessToken } from '@/lib/schwab';

interface PortfolioGreeks {
  totalDelta: number;
  totalGamma: number;
  totalTheta: number;
  totalVega: number;
  positionBreakdown: Array<{
    symbol: string;
    quantity: number;
    delta: number;
    gamma: number;
    theta: number;
    vega: number;
    contribution: {
      delta: number;
      gamma: number;
      theta: number;
      vega: number;
    };
  }>;
  hedgingSuggestions: Array<{
    action: string;
    symbol: string;
    quantity: number;
    reasoning: string;
    resultingDelta: number;
  }>;
  riskMetrics: {
    directionalRisk: 'HIGH' | 'MEDIUM' | 'LOW';
    volatilityRisk: 'HIGH' | 'MEDIUM' | 'LOW';
    timeDecayPerDay: number;
    gammaRisk: 'HIGH' | 'MEDIUM' | 'LOW';
  };
}

export async function GET() {
  try {
    // ============================================================
    // 1. GET SCHWAB ACCESS TOKEN
    // ============================================================
    const tokenResult = await getSchwabAccessToken('options');
    if (!tokenResult.token) {
      throw new Error('Failed to get Schwab access token');
    }
    const accessToken = tokenResult.token;
    
    // ============================================================
    // 2. FETCH ACCOUNT POSITIONS
    // ============================================================
    const accountRes = await fetch(
      'https://api.schwabapi.com/trader/v1/accounts?fields=positions',
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json'
        }
      }
    );
    
    if (!accountRes.ok) {
      throw new Error(`Schwab API error: ${accountRes.status}`);
    }
    
    const accounts = await accountRes.json();
    const account = accounts[0];
    const positions = account.securitiesAccount.positions || [];

    // ============================================================
    // 3. CALCULATE GREEKS FOR EACH POSITION
    // ============================================================
    let totalDelta = 0;
    let totalGamma = 0;
    let totalTheta = 0;
    let totalVega = 0;
    
    const positionBreakdown = [];

    for (const position of positions) {
      const instrument = position.instrument;
      const quantity = position.longQuantity - position.shortQuantity;
      
      // Skip if no quantity
      if (quantity === 0) continue;

      let delta = 0, gamma = 0, theta = 0, vega = 0;

      // Stock positions have delta of 1 per share
      if (instrument.assetType === 'EQUITY') {
        delta = quantity; // 100 shares = +100 delta
      }
      
      // Option positions - fetch Greeks from Schwab
      else if (instrument.assetType === 'OPTION') {
        try {
          // Get option chain to fetch Greeks
          const symbol = instrument.underlyingSymbol;
          const optionRes = await fetch(
            `https://api.schwabapi.com/marketdata/v1/chains?symbol=${symbol}&contractType=ALL`,
            {
              headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Accept': 'application/json'
              }
            }
          );
          
          if (optionRes.ok) {
            const optionData = await optionRes.json();
            
            // Find this specific option contract in the chain
            const optionSymbol = instrument.symbol;
            let foundOption = null;
            
            // Search calls
            if (optionData.callExpDateMap) {
              for (const [expDate, strikes] of Object.entries(optionData.callExpDateMap)) {
                for (const [strike, options] of Object.entries(strikes as any)) {
                  const optArray = Array.isArray(options) ? options : [options];
                  foundOption = optArray.find((opt: any) => opt.symbol === optionSymbol);
                  if (foundOption) break;
                }
                if (foundOption) break;
              }
            }
            
            // Search puts if not found
            if (!foundOption && optionData.putExpDateMap) {
              for (const [expDate, strikes] of Object.entries(optionData.putExpDateMap)) {
                for (const [strike, options] of Object.entries(strikes as any)) {
                  const optArray = Array.isArray(options) ? options : [options];
                  foundOption = optArray.find((opt: any) => opt.symbol === optionSymbol);
                  if (foundOption) break;
                }
                if (foundOption) break;
              }
            }
            
            if (foundOption) {
              // Greeks are per contract, multiply by quantity and 100 (shares per contract)
              delta = (foundOption.delta || 0) * quantity * 100;
              gamma = (foundOption.gamma || 0) * quantity * 100;
              theta = (foundOption.theta || 0) * quantity * 100;
              vega = (foundOption.vega || 0) * quantity * 100;
            }
          }
        } catch (err) {
          console.error('Error fetching option Greeks:', err);
        }
      }

      // Add to totals
      totalDelta += delta;
      totalGamma += gamma;
      totalTheta += theta;
      totalVega += vega;

      // Add to breakdown
      positionBreakdown.push({
        symbol: instrument.symbol,
        quantity,
        delta: delta / (quantity * (instrument.assetType === 'OPTION' ? 100 : 1)) || 0,
        gamma: gamma / (quantity * (instrument.assetType === 'OPTION' ? 100 : 1)) || 0,
        theta: theta / (quantity * (instrument.assetType === 'OPTION' ? 100 : 1)) || 0,
        vega: vega / (quantity * (instrument.assetType === 'OPTION' ? 100 : 1)) || 0,
        contribution: {
          delta,
          gamma,
          theta,
          vega,
        },
      });
    }

    // ============================================================
    // 4. GENERATE HEDGING SUGGESTIONS
    // ============================================================
    const hedgingSuggestions = [];

    // Delta hedging
    if (Math.abs(totalDelta) > 100) {
      const direction = totalDelta > 0 ? 'SELL' : 'BUY';
      const contracts = Math.ceil(Math.abs(totalDelta) / 100);
      
      hedgingSuggestions.push({
        action: `${direction} ${contracts} SPY calls`,
        symbol: 'SPY',
        quantity: contracts,
        reasoning: `Your portfolio delta is ${totalDelta.toFixed(0)}. ${direction === 'SELL' ? 'Reduce bullish exposure' : 'Reduce bearish exposure'} by ${direction === 'SELL' ? 'selling' : 'buying'} SPY calls to neutralize.`,
        resultingDelta: totalDelta - (direction === 'SELL' ? contracts * 50 : -contracts * 50),
      });
    }

    // Gamma hedging
    if (Math.abs(totalGamma) > 50) {
      hedgingSuggestions.push({
        action: totalGamma > 0 ? 'SELL ATM straddle' : 'BUY ATM straddle',
        symbol: 'SPY',
        quantity: 1,
        reasoning: `High gamma (${totalGamma.toFixed(0)}) means delta changes rapidly. ${totalGamma > 0 ? 'Sell' : 'Buy'} ATM straddle to reduce gamma risk.`,
        resultingDelta: totalDelta,
      });
    }

    // Vega hedging
    if (Math.abs(totalVega) > 100) {
      hedgingSuggestions.push({
        action: totalVega > 0 ? 'SELL OTM options' : 'BUY OTM options',
        symbol: 'VIX',
        quantity: 1,
        reasoning: `High vega (${totalVega.toFixed(0)}) means portfolio sensitive to IV changes. ${totalVega > 0 ? 'Sell' : 'Buy'} volatility to hedge.`,
        resultingDelta: totalDelta,
      });
    }

    // ============================================================
    // 5. CALCULATE RISK METRICS
    // ============================================================
    const riskMetrics = {
      directionalRisk: 
        Math.abs(totalDelta) > 200 ? 'HIGH' :
        Math.abs(totalDelta) > 100 ? 'MEDIUM' : 'LOW',
      volatilityRisk:
        Math.abs(totalVega) > 200 ? 'HIGH' :
        Math.abs(totalVega) > 100 ? 'MEDIUM' : 'LOW',
      timeDecayPerDay: totalTheta,
      gammaRisk:
        Math.abs(totalGamma) > 100 ? 'HIGH' :
        Math.abs(totalGamma) > 50 ? 'MEDIUM' : 'LOW',
    } as const;

    // ============================================================
    // 6. RETURN PORTFOLIO GREEKS
    // ============================================================
    const result: PortfolioGreeks = {
      totalDelta,
      totalGamma,
      totalTheta,
      totalVega,
      positionBreakdown,
      hedgingSuggestions,
      riskMetrics,
    };

    return NextResponse.json(result);

  } catch (error: any) {
    console.error('Portfolio Greeks error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to calculate portfolio Greeks' },
      { status: 500 }
    );
  }
}
