# AI Hedge Fund 🧠📈

A real-time stock and options analysis platform featuring **fundamental analysis**, **technical analysis**, and **Greeks-based options suggestions**.

## Features

### 📊 Stock Analysis Tab
- **Real-time stock prices** via Finnhub API
- **Fundamental Analysis** scoring based on:
  - P/E Ratio (undervalued < 15, fairly valued < 25, overvalued > 40)
  - ROE (strong > 20%, good > 15%, weak < 10%)
  - Debt/Equity (stable < 0.5, moderate < 1, risky > 2)
  - Profit Margins (excellent > 20%, good > 10%, thin < 5%)
  - Revenue & EPS Growth trends
  - Price-to-Book ratio
  - 52-week position analysis

- **Technical Analysis** scoring based on:
  - RSI (oversold < 30, overbought > 70)
  - MACD crossovers (bullish/bearish)
  - Moving Average analysis (50 SMA, 200 SMA)
  - Golden Cross / Death Cross detection
  - Price vs moving averages position

- **Trade Suggestions** with confidence scores

### 📈 Options Intel Tab
- **Options chain data** with Greeks (Delta, Gamma, Theta, Vega)
- **Greeks-based trade suggestions**:
  - Aggressive strategies: Delta ~0.40-0.50
  - Conservative strategies: Delta ~0.25-0.35
  - Theta decay warnings
  - Gamma risk alerts
  - IV crush warnings near earnings

- **Market sentiment** analysis
- **Put/Call ratio** interpretation
- **Earnings proximity** alerts

## Scoring Logic

### Fundamental Signals

| Signal | Bullish Points | Bearish Points |
|--------|----------------|----------------|
| P/E < 15 | +2 | — |
| P/E > 40 | — | +2 |
| ROE > 20% | +2 | — |
| ROE < 10% | — | +1 |
| Debt/Equity < 0.5 | +2 | — |
| Debt/Equity > 2 | — | +2 |
| Profit Margin > 20% | +2 | — |
| Profit Margin < 5% | — | +1 |
| Revenue Growth > 20% | +2 | — |
| Revenue Declining | — | +2 |

### Technical Signals

| Signal | Bullish Points | Bearish Points |
|--------|----------------|----------------|
| Golden Cross (50 > 200 SMA) | +2 | — |
| Death Cross (50 < 200 SMA) | — | +2 |
| Price > both SMAs | +2 | — |
| Price < both SMAs | — | +2 |
| RSI < 30 (oversold) | +2 | — |
| RSI > 70 (overbought) | — | +2 |
| MACD bullish crossover | +2 | — |
| MACD bearish crossover | — | +2 |

### Options Greeks-Based Adjustments

| Signal | Effect |
|--------|--------|
| Theta > 10% of premium/day | -10 confidence |
| Gamma > 0.05 + DTE < 7 | Warning alert |
| IV > 40% | -10 confidence (expensive) |
| IV < 25% | +5 confidence (cheap) |
| Earnings < 7 days | -15 confidence |

## Quick Start

### 1. Clone & Install

```bash
git clone <your-repo>
cd ai-hedge-fund
npm install
```

### 2. Get API Keys

**Required:**
1. **Finnhub** (free): [finnhub.io/register](https://finnhub.io/register) - 60 calls/min

**For Live Options Data (Recommended):**
2. **Schwab Developer API**: [developer.schwab.com](https://developer.schwab.com)
   - Requires a Schwab brokerage account
   - Provides real-time options chains with full Greeks (Delta, Gamma, Theta, Vega)
   - OAuth refresh tokens expire every 7 days

### 3. Configure Environment

```bash
cp .env.local.example .env.local
```

Edit `.env.local`:
```
FINNHUB_API_KEY=your_finnhub_key_here

# Schwab API (for live options data)
SCHWAB_APP_KEY=your_schwab_app_key
SCHWAB_APP_SECRET=your_schwab_app_secret
SCHWAB_REFRESH_TOKEN=your_schwab_refresh_token
```

### 4. Run Locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Deploy to Vercel

### One-Click Deploy

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/YOUR_USERNAME/ai-hedge-fund&env=FINNHUB_API_KEY)

### Manual Deploy

1. Push to GitHub
2. Import to [Vercel](https://vercel.com/new)
3. Add environment variable: `FINNHUB_API_KEY`
4. Deploy!

## Project Structure

```
ai-hedge-fund/
├── app/
│   ├── api/
│   │   ├── stock/[ticker]/route.ts   # Stock data + analysis API
│   │   └── options/[ticker]/route.ts # Options data + suggestions API
│   ├── globals.css                   # Tailwind styles
│   ├── layout.tsx                    # Root layout
│   └── page.tsx                      # Main UI (Stock + Options tabs)
├── .env.local.example
├── package.json
├── tailwind.config.js
├── tsconfig.json
└── README.md
```

## API Endpoints

### GET /api/stock/[ticker]
Returns comprehensive stock analysis:
- Real-time price, change, volume
- Fundamental metrics (P/E, ROE, Debt/Equity, margins, growth)
- Technical indicators (RSI, MACD, SMAs, Golden/Death Cross)
- Fundamental analysis score & signals
- Technical analysis score & signals
- Combined rating & trade suggestions

### GET /api/options/[ticker]
Returns options intelligence:
- Current price, expiration dates
- Options chain with Greeks (calls & puts)
- Market metrics (Put/Call ratio, IV, volume)
- Greeks-based trade suggestions
- Earnings & sentiment analysis

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Data Sources**:
  - **Schwab API**: Live options chains with full Greeks (Delta, Gamma, Theta, Vega, IV)
  - **Finnhub API**: Stock quotes, fundamentals, news, earnings, analyst ratings
  - **Fallback**: Mock data when APIs unavailable

## Data Flow

1. **Options Tab**: Schwab API → Parse options chains → Generate Greeks-based suggestions
2. **Stock Tab**: Finnhub API → Analyze fundamentals + technicals → Generate trade suggestions
3. **Fallback**: If APIs fail, realistic mock data is generated for demo purposes

## Rate Limits

- **Finnhub Free**: 60 API calls/minute
- **Schwab**: Requires brokerage account, generous limits
- **Mock Data**: Falls back automatically if no API keys

## Disclaimer

⚠️ **For educational purposes only. Not financial advice.**

The analysis provided by this application is for informational purposes only and should not be used for actual investment decisions. Always do your own research and consult with qualified financial advisors before making investment decisions.

## License

MIT
