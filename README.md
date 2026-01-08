# AI Hedge Fund 2.0 🧠📈

A premium real-time multi-agent investment analysis platform featuring 12 legendary investor personalities, live market data, Greeks-based options intelligence, and trade suggestions.

![Next.js](https://img.shields.io/badge/Next.js-14-black) ![TypeScript](https://img.shields.io/badge/TypeScript-5-blue) ![Tailwind](https://img.shields.io/badge/Tailwind-3.4-cyan)

## ✨ What's New in 2.0

- **🎯 Trade Suggestions** - Greeks-based call/put recommendations with confidence scores
- **📊 Options Intelligence** - Full options chain with Delta, Gamma, Theta, IV
- **📈 Trend Analysis** - 30-day price trend detection
- **📰 News Sentiment** - Bullish/bearish keyword extraction from headlines
- **📅 Earnings Alerts** - Upcoming earnings warnings with IV crush risks
- **🎨 Premium Dark Theme** - Enhanced UI with glass morphism effects

## Features

### 12 Legendary Investor Agents
- Aswath Damodaran (Valuation)
- Ben Graham (Deep Value)
- Warren Buffett (Moat Investing)
- Charlie Munger (Quality)
- Bill Ackman (Activist)
- Cathie Wood (Innovation)
- Michael Burry (Contrarian)
- Peter Lynch (Growth)
- Phil Fisher (Research)
- Mohnish Pabrai (Dhandho)
- Stanley Druckenmiller (Macro)
- Rakesh Jhunjhunwala (Momentum)

### Options Intelligence
- **Trade Suggestions**: Aggressive/Conservative calls & puts
- **Greeks Analysis**: Delta, Gamma, Theta, Vega, IV
- **Risk Metrics**: Max risk, breakeven, confidence scores
- **Market Context**: Trend, sentiment, earnings proximity

### Analysis Pipeline
1. Fetch live stock data (Finnhub/Polygon)
2. Fetch options chain (Yahoo Finance/Schwab)
3. Analyze trend, news, earnings
4. Run 12 investor agents in parallel
5. Calculate risk metrics
6. Generate portfolio decision
7. Generate trade suggestions

## Quick Start

### 1. Clone & Install

```bash
git clone <your-repo>
cd ai-hedge-fund
npm install
```

### 2. Get API Keys (Free)

1. **Finnhub** (Required): [finnhub.io](https://finnhub.io/register) - 60 calls/min free
2. **Polygon.io** (Optional): [polygon.io](https://polygon.io/dashboard/signup) - 5 calls/min free

### 3. Configure Environment

```bash
cp .env.local.example .env.local
```

Edit `.env.local`:
```
FINNHUB_API_KEY=your_finnhub_key
POLYGON_API_KEY=your_polygon_key
```

### 4. Run Locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## API Endpoints

### GET /api/stock/[ticker]
Real-time stock data:
- Price, change, volume
- P/E, EPS, beta, market cap
- ROE, profit margins, growth rates
- Analyst price targets

### GET /api/options/[ticker]
Enhanced options data:
- Full options chain (calls & puts)
- Greeks: Delta, Gamma, Theta, IV
- Put/Call ratio, volume metrics
- **NEW**: Trade suggestions with reasoning
- **NEW**: Trend analysis (30-day)
- **NEW**: News sentiment
- **NEW**: Earnings proximity
- **NEW**: Analyst ratings

## Trade Suggestion Logic

Suggestions are generated based on:

1. **Trend Score** (weight: 2)
   - 30-day price change > 5% = bullish
   - 30-day price change < -5% = bearish

2. **News Sentiment** (weight: 1)
   - Keyword analysis from recent headlines
   - Bullish: surge, beat, growth, etc.
   - Bearish: fall, miss, decline, etc.

3. **Put/Call Ratio** (weight: 1, contrarian)
   - PCR > 1.2 = contrarian bullish (fear)
   - PCR < 0.7 = contrarian bearish (greed)

4. **Analyst Consensus** (weight: 1)
   - Buy ratings > 70% = bullish
   - Sell ratings > 70% = bearish

5. **Greeks Selection**
   - Aggressive: Delta ~0.40-0.50, near ATM, short DTE
   - Conservative: Delta ~0.25-0.35, OTM, longer DTE

## Project Structure

```
ai-hedge-fund/
├── app/
│   ├── api/
│   │   ├── stock/[ticker]/route.ts   # Stock data API
│   │   └── options/[ticker]/route.ts # Enhanced options API
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx                      # Main UI
├── .env.local.example
├── package.json
├── tailwind.config.js
└── tsconfig.json
```

## Deploy to Vercel

### One-Click Deploy

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/YOUR_USERNAME/ai-hedge-fund&env=FINNHUB_API_KEY,POLYGON_API_KEY)

### Environment Variables

Add these in Vercel dashboard:
- `FINNHUB_API_KEY` (required)
- `POLYGON_API_KEY` (optional)
- `SCHWAB_APP_KEY` (optional, for live options)
- `SCHWAB_APP_SECRET` (optional)
- `SCHWAB_REFRESH_TOKEN` (optional)

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Data**: Finnhub + Yahoo Finance (+ optional Schwab/Polygon)
- **Deployment**: Vercel

## Rate Limits

| Provider | Free Tier | Paid |
|----------|-----------|------|
| Finnhub | 60/min | Higher |
| Yahoo Finance | Unlimited* | - |
| Polygon.io | 5/min | Unlimited |
| Schwab | Auth required | Real-time |

*Yahoo Finance has no official API - scraping may be rate limited

## Disclaimer

⚠️ **This is for educational purposes only. Not financial advice.**

The analysis and trade suggestions provided by this application are simulated and should not be used for actual investment decisions. Options trading involves significant risk. Always do your own research and consult with qualified financial advisors.

## License

MIT

---

Built with 🧠 by Claude
