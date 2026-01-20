# AI Hedge Fund 🧠📈

A real-time stock and options analysis platform featuring **fundamental analysis**, **technical analysis**, **Greeks-based options suggestions**, and **suggestion performance tracking**.

## Features

### 📊 Stock Analysis Tab
- **Real-time stock prices** via Schwab/Finnhub API
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
- **Unusual Options Activity** detection

### 📌 Suggestion Tracker Tab (NEW!)
- **Track any suggestion** from Stock or Options tabs
- **Real-time P&L tracking** with current prices from your APIs
- **Performance metrics**:
  - Win Rate percentage
  - Average Return
  - Winners vs Losers count
  - Active vs Closed positions

- **Position management**:
  - Mark as Hit Target
  - Mark as Stopped Out
  - Close Position manually

- **Auto-calculated targets**:
  - 10% profit target
  - 5% stop loss

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
   - Provides real-time options chains with full Greeks
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

## Project Structure

```
ai-hedge-fund/
├── app/
│   ├── api/
│   │   ├── stock/[ticker]/route.ts   # Stock data + analysis API
│   │   ├── options/[ticker]/route.ts # Options data + suggestions API
│   │   └── tracker/route.ts          # Suggestion tracking API (NEW!)
│   ├── globals.css                   # Tailwind styles
│   ├── layout.tsx                    # Root layout
│   └── page.tsx                      # Main UI (Stock + Options + Tracker tabs)
├── .env.local.example
├── package.json
├── tailwind.config.js
├── tsconfig.json
└── README.md
```

## API Endpoints

### GET /api/stock/[ticker]
Returns comprehensive stock analysis with fundamentals, technicals, news, and suggestions.

### GET /api/options/[ticker]
Returns options intelligence with Greeks, unusual activity, and trade suggestions.

### GET /api/tracker
Returns all tracked suggestions with current prices and performance metrics.

### POST /api/tracker
Track a new suggestion. Body:
```json
{
  "ticker": "AAPL",
  "type": "STOCK_BUY" | "STOCK_SELL" | "CALL" | "PUT",
  "strategy": "Long Call (Trend Aligned)",
  "entryPrice": 150.00,
  "targetPrice": 165.00,
  "stopLoss": 142.50,
  "confidence": 75,
  "reasoning": ["RSI favorable", "Above 50 SMA"]
}
```

### PUT /api/tracker
Update suggestion status. Body:
```json
{
  "id": "suggestion-id",
  "status": "CLOSED" | "HIT_TARGET" | "STOPPED_OUT"
}
```

### DELETE /api/tracker?id=suggestion-id
Remove a tracked suggestion.

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Data Sources**:
  - **Schwab API**: Live options chains with full Greeks
  - **Finnhub API**: Stock quotes, fundamentals, news

## Tracker Storage Note

Currently, tracked suggestions are stored in-memory (server-side). In production, you should:
1. Use Vercel KV for serverless-compatible storage
2. Or connect to a database (Supabase, PlanetScale, etc.)
3. Or use localStorage for client-side only storage

## Disclaimer

⚠️ **For educational purposes only. Not financial advice.**

The analysis and tracking provided by this application is for informational purposes only. Always do your own research and consult with qualified financial advisors before making investment decisions.

## License

MIT
