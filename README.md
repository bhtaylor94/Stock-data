# FlowHunter

Institutional-grade options flow scanner. Monitors the 25 most liquid stocks/ETFs, detects unusual options activity, and surfaces high-conviction trade setups through a 5-layer analysis engine.

## Features

- **Live Flow Scanner** — Scans 25 tickers every 60s for unusual options activity
- **5-Layer Institutional Scoring** — Flow intent, dealer gamma positioning, volatility edge, catalyst timing, technical confirmation
- **Layer 6: Congressional/Insider Tracking** — SEC EDGAR Form 4 + congressional STOCK Act disclosures (free)
- **Net Premium Flow** — Market-wide sentiment indicator in the bottom bar
- **Trade Tracking** — "I'm In This Trade" activates OI monitoring. See if whales are still holding.
- **AI Deep Dive** — Claude-powered full institutional analysis on any card or manual contract input
- **LEAP Scanner** — Find optimal long-dated option setups across multiple tickers
- **Hard Rules** — 14-365 DTE only, 4/5 minimum confidence, liquidity validated, long-only / debit spreads

## Tech Stack

- Next.js 14 (App Router)
- Tailwind CSS
- Schwab API (OAuth) — options chains, quotes, price history
- Finnhub — fundamentals, news, earnings, recommendations
- Polygon.io — ticker details, previous close
- SEC EDGAR — insider trades, congressional activity (free)
- Claude API — AI-powered contract analysis

## Setup

1. Clone this repo
2. `npm install`
3. Copy `.env.example` to `.env.local` and fill in your keys
4. `npm run dev`

## Environment Variables

| Variable | Source | Required |
|----------|--------|----------|
| `SCHWAB_APP_KEY` | [Schwab Developer](https://developer.schwab.com) | Yes |
| `SCHWAB_APP_SECRET` | Schwab Developer | Yes |
| `SCHWAB_REFRESH_TOKEN` | Schwab OAuth flow | Yes |
| `FINNHUB_API_KEY` | [Finnhub](https://finnhub.io) | Yes |
| `POLYGON_API_KEY` | [Polygon.io](https://polygon.io) | Yes |
| `ANTHROPIC_API_KEY` | [Anthropic Console](https://console.anthropic.com) | For /analyze |
| `EDGAR_IDENTITY` | Any email (user-agent for SEC) | For insider data |

## Deploy to Vercel

Push to GitHub → connect to Vercel → add env vars → deploy. If you're replacing an existing project, your Schwab/Finnhub/Polygon keys should already be configured.

## Architecture

See `ARCHITECTURE_V2_FINAL.md` for the full system design including all scoring logic, signal detection rules, and strategy selection algorithms.
