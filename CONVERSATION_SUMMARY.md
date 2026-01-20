# PROJECT CONTEXT SUMMARY

## Application Overview
AI Hedge Fund - Professional trading platform with stock & options analysis
- Next.js 14 app with dark trading terminal UI
- Integrates Finnhub, Polygon.io, Schwab APIs
- 195 stocks organized across 13 industries
- Greeks-based options analysis with unusual activity detection
- Paper trading tracker

## Recent Changes Made

### 1. Industry Organization (195 stocks)
- Top 10 liquid tickers always visible
- 13 industry categories with 15 stocks each
- Technology, Semiconductors, Finance, Healthcare, etc.
- Created `/lib/companyNames.ts` for all company names

### 2. UI Improvements
- Price reduced from text-6xl → text-4xl (better balance)
- Added daily percentage change (+2.45% green, -1.23% red)
- Auto-collapse ticker list after selection
- Smooth scroll to top after ticker click

### 3. Bug Fixes
- Fixed React #31 error: Options API sent score object instead of score.total
- Fixed Next.js build error: Moved COMPANY_NAMES export to separate module
- Fixed ticker selection UX flow

## Current Issues

### Issue 1: 401 Error on Options Tab
**Problem:** Schwab OAuth token expiring/failing
**Cause:** Serverless instances, token invalidation, 30min token TTL
**Known from memory:** This is an intermittent issue with Schwab auth

### Issue 2: Stale Data (Price Not Updating)
**Problem:** Clicking SPY multiple times shows same price
**Cause:** Likely aggressive caching - need to implement cache busting

## Key Files
- `/app/page.tsx` - Main dashboard
- `/app/api/stock/[ticker]/route.ts` - Stock data API
- `/app/api/options/[ticker]/route.ts` - Options data API
- `/lib/schwab.ts` - Schwab authentication
- `/lib/cache.ts` - TTL cache implementation
- `/lib/companyNames.ts` - 195 company names

## Deployment
- Hosted on Vercel
- Env vars: SCHWAB_APP_KEY, SCHWAB_APP_SECRET, SCHWAB_REFRESH_TOKEN, FINNHUB_API_KEY, POLYGON_API_KEY

## Next Steps
1. Fix 401 Schwab auth errors
2. Implement cache invalidation for fresh data
3. Consider Robinhood integration (documented in ROBINHOOD_INTEGRATION.md)
