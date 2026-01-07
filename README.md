# AI Hedge Fund 🧠📈

A real-time multi-agent investment analysis platform featuring 12 legendary investor personalities, live market data, and options chains.

![AI Hedge Fund](https://img.shields.io/badge/Next.js-14-black) ![TypeScript](https://img.shields.io/badge/TypeScript-5-blue) ![Tailwind](https://img.shields.io/badge/Tailwind-3.4-cyan)

## Features

- **12 Legendary Investor Agents** - Buffett, Munger, Damodaran, Graham, Ackman, Cathie Wood, Burry, Lynch, Fisher, Pabrai, Druckenmiller, Jhunjhunwala
- **Real-Time Stock Data** - Live prices, fundamentals, and analyst targets via Finnhub
- **Live Options Chains** - Calls, puts, Greeks, IV, and volume data via Polygon.io
- **Risk Management** - VaR, Sharpe ratio, beta, position sizing
- **Portfolio Decisions** - Aggregated BUY/HOLD/SELL recommendations

## Data Sources

| Provider | Data | Free Tier |
|----------|------|-----------|
| **Finnhub** | Real-time quotes, fundamentals, analyst targets | 60 calls/min |
| **Polygon.io** | Options chains, ticker details, historical data | 5 calls/min (delayed) |

## Quick Start

### 1. Clone & Install

```bash
git clone <your-repo>
cd ai-hedge-fund
npm install
```

### 2. Get API Keys (Free)

1. **Finnhub**: Sign up at [finnhub.io](https://finnhub.io/register)
2. **Polygon.io**: Sign up at [polygon.io](https://polygon.io/dashboard/signup)

### 3. Configure Environment

```bash
cp .env.local.example .env.local
```

Edit `.env.local`:
```
POLYGON_API_KEY=your_polygon_key_here
FINNHUB_API_KEY=your_finnhub_key_here
```

### 4. Run Locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Deploy to Vercel (Recommended)

### One-Click Deploy

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/YOUR_USERNAME/ai-hedge-fund&env=POLYGON_API_KEY,FINNHUB_API_KEY)

### Manual Deploy

1. Push to GitHub
2. Import to [Vercel](https://vercel.com/new)
3. Add environment variables:
   - `POLYGON_API_KEY`
   - `FINNHUB_API_KEY`
4. Deploy!

## Project Structure

```
ai-hedge-fund/
├── app/
│   ├── api/
│   │   ├── stock/[ticker]/route.ts   # Stock data API
│   │   └── options/[ticker]/route.ts # Options data API
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx                      # Main UI
├── .env.local.example
├── package.json
├── tailwind.config.js
└── tsconfig.json
```

## API Endpoints

### GET /api/stock/[ticker]
Returns real-time stock data including:
- Price, change, volume
- P/E, EPS, beta, market cap
- ROE, profit margins, growth rates
- Analyst price targets

### GET /api/options/[ticker]
Returns options chain data including:
- Calls and puts with strikes
- Bid/ask, last price, volume, OI
- Implied volatility, Greeks
- Put/call ratio

## Investor Agents

| Agent | Philosophy | Focus |
|-------|------------|-------|
| Aswath Damodaran | Story + Numbers + Discipline | DCF valuation |
| Ben Graham | Margin of Safety | Deep value |
| Warren Buffett | Wonderful Companies | Economic moats |
| Charlie Munger | Wonderful at Fair Price | Quality |
| Bill Ackman | Bold Positions & Change | Activism |
| Cathie Wood | Innovation & Disruption | Growth |
| Michael Burry | Deep Value Hunting | Contrarian |
| Peter Lynch | Ten-Baggers Everywhere | PEG ratio |
| Phil Fisher | Scuttlebutt Method | Research |
| Mohnish Pabrai | Dhandho Investor | Risk/reward |
| Stanley Druckenmiller | Asymmetric Opportunities | Macro |
| Rakesh Jhunjhunwala | India Growth Story | Momentum |

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Data**: Polygon.io + Finnhub APIs
- **Deployment**: Vercel

## Rate Limits

Be aware of API rate limits on free tiers:
- **Finnhub**: 60 API calls/minute
- **Polygon.io**: 5 API calls/minute (free), unlimited (paid)

For heavy usage, consider upgrading to paid tiers.

## Disclaimer

⚠️ **This is for educational purposes only. Not financial advice.**

The analysis provided by this application is simulated and should not be used for actual investment decisions. Always do your own research and consult with qualified financial advisors.

## License

MIT
