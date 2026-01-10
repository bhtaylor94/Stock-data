# AI Hedge Fund v2.0 - Application Overview

## What's New in Version 2.0

🚀 **Major Enhancements**:
- ✨ **15+ Professional Trading Playbooks** - Institutional-quality setups (Trend Continuation, Mean Reversion, Breakouts, etc.)
- ✨ **Evidence Verification** - Cryptographic hashing for tamper-proof, auditable decisions
- ✨ **Historical Snapshots** - JSONL-based decision tracking for long-term calibration
- ✨ **Calibration APIs** - Measure forecast accuracy by confidence bucket and setup type
- ✨ **Outcomes Tracking** - Forward return measurement at multiple horizons
- ✨ **Market Regime Detection** - TREND / RANGE / HIGH_VOL adaptive strategies

## Core Features

### Professional Trading Playbooks (Setup Registry)

Version 2.0 introduces **15+ battle-tested trading setups** with explicit rules:

**Bullish Setups**:
1. **Trend Continuation Bull** - RSI 45-68 in established uptrends
2. **Mean Reversion Bounce** - Oversold (RSI <35) bounces from support
3. **Breakout Momentum** - 20-day high breaks with volume
4. **Bull Flag Retest** - Flag pullbacks with tight consolidation
5. **Bollinger Squeeze** - Volatility compression → expansion

**Bearish Setups**:
6. **Trend Continuation Bear** - Distribution in downtrends
7. **Mean Reversion Fade** - Overbought (RSI >65) reversals
8. **Breakdown** - 20-day low breaks with panic volume
9. **Bear Flag Retest** - Failed rallies in downtrends
10. **Distribution Failure** - Failed breakouts

**Range/Volatility Setups**:
11. **Range Rotation** - Support/resistance bounces in sideways markets
12. **Volatility Spike** - High ATR environments (wider stops)
13. **Dead Zone** - No clear patterns → NO_TRADE

Each playbook includes:
- ✅ Entry criteria
- ✅ ATR-based stop losses
- ✅ Multiple profit targets
- ✅ Invalidation levels
- ✅ Full evidence logging

###Evidence Verification System

Every recommendation includes a **cryptographically verifiable evidence packet**:

```json
{
  "version": "1.0.0",
  "ticker": "AAPL",
  "setup": "Trend Continuation Bull",
  "datapoints": {
    "indicators": { "rsi": 58, "macd": 0.45 },
    "levels": { "support": 175.20 },
    "patterns": [...],
    "fundamentals": { "pe": 28, "roe": 42 }
  },
  "checks": [
    { "name": "Data freshness", "pass": true },
    { "name": "Completeness >= 70%", "pass": true }
  ],
  "hash": "a8f3c9d2..." // SHA-256 for verification
}
```

**Benefits**: Tamper-proof, auditable, transparent, accountable

### Comprehensive Analysis (v1.0 features preserved)

- **18-factor scoring**: 9 technical + 9 fundamental metrics
- **Chart pattern recognition**: Cup & Handle, H&S, Double Tops/Bottoms
- **News sentiment**: Real-time scoring from headlines
- **Analyst consensus**: Ratings and price targets
- **Insider activity**: Net buying/selling detection
- **Options analysis**: UOA, Greeks, chains
- **Position tracker**: Real-time P&L and auto-status updates

### New API Endpoints

**GET /api/calibration**
```json
{
  "byBucket": {
    "HIGH": { "winRate": 0.80, "avgPnlPct": 8.5 },
    "MED": { "winRate": 0.65, "avgPnlPct": 4.2 }
  },
  "bySetup": {
    "Trend Continuation Bull": { "winRate": 0.70 }
  },
  "horizonReturns": {
    "d5": { "avgReturnPct": 2.3 }
  }
}
```

**GET /api/outcomes?ticker=AAPL**  
Returns all tracked suggestions with outcomes

**POST /api/outcomes**  
Updates suggestion with closed price, returns realized P&L

## Decision Flow

```
Ticker Input
    ↓
Market Data (Schwab + Finnhub)
    ↓
Technical Indicators + Fundamentals
    ↓
Regime Detection (TREND/RANGE/HIGH_VOL)
    ↓
Setup Registry: Evaluate 15+ playbooks
    ↓
Select Best Non-Conflicting Setup
    ↓
Confidence Calibration (base + adjustments)
    ↓
Evidence Packet Generation (with hash)
    ↓
Snapshot Storage (JSONL)
    ↓
Display Recommendation
    ↓
User Tracks Position
    ↓
Outcomes Measurement
    ↓
Calibration Feedback Loop
```

## Key Differentiators

1. **Professional Playbooks** - 15+ setups vs generic signals
2. **Evidence Verification** - Cryptographic hashing for auditability
3. **Multi-Factor Validation** - 18+ factors across all dimensions
4. **Conservative Calibration** - Caps at 95%, continuous measurement
5. **Regime Adaptation** - Different strategies for TREND/RANGE/HIGH_VOL
6. **Continuous Learning** - Outcomes tracking improves predictions
7. **Institutional Quality** - Explicit rules, stops, targets

## Use Cases

- **Day Traders**: Breakout/breakdown setups, real-time signals
- **Swing Traders**: Trend continuation, mean reversion, 5-14 day holds
- **Investors**: Fundamental scoring, analyst consensus, long-term
- **Options Traders**: UOA detection, specific strikes/expirations

## Tech Stack

- Next.js 14 + TypeScript
- Schwab API (real-time data)
- Finnhub API (fundamentals)
- File-based JSON (tracker)
- JSONL (snapshots)
- Vercel (hosting)

## Limitations

⚠️ Not financial advice - for analysis only  
⚠️ Equity-focused (not crypto)  
⚠️ Daily/minute data (not tick data)  
⚠️ API rate limits may apply

## Summary

v2.0 is a **professional-grade platform** with:
- Institutional trading playbooks
- Evidence verification & hashing
- Historical snapshot tracking
- Continuous calibration measurement
- Conservative confidence scoring
- Real-time multi-factor analysis

Designed for traders who want **auditable, data-driven insights** backed by professional frameworks.
