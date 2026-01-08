# AI Hedge Fund 🧠📈

A real-time multi-agent investment analysis platform featuring options intelligence with Greeks-based trade suggestions.

## Features

- **Options Intel Tab** - Trade suggestions based on trend, news, volume, and Greeks
- **Greeks Analysis** - Delta targeting (~0.45 aggressive, ~0.30 conservative), theta decay warnings, gamma risk alerts
- **Real-Time Data** - Live prices, fundamentals, and analyst targets
- **Options Chains** - Calls, puts, Greeks, IV, and volume data

## Quick Start

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Trade Suggestion Logic

| Signal | Bullish | Bearish |
|--------|---------|---------|
| 30-day trend UP >5% | +2 | — |
| 30-day trend DOWN >5% | — | +2 |
| Positive news sentiment | +1 | — |
| Negative news sentiment | — | +1 |
| Put/Call ratio > 1.2 | +1 | — |
| Put/Call ratio < 0.7 | — | +1 |
| Analyst buy rating | +1 | — |

### Greeks-Based Adjustments

| Greek | Effect |
|-------|--------|
| Theta > 10% of premium/day | -1 confidence |
| Gamma > 0.05 + DTE < 7 | Warning |
| IV Percentile > 60% | -1 confidence |

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Data**: Finnhub + Schwab APIs

## Disclaimer

⚠️ **For educational purposes only. Not financial advice.**
