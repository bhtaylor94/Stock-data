# AI Hedge Fund - Deployment Guide

## What Was Fixed

### TypeScript Configuration Issue
**Problem**: The application was failing to build on Vercel with the error:
```
Type error: Function declarations are not allowed inside blocks in strict mode when targeting 'ES5'
```

**Solution**: Added explicit `"target": "ES2017"` to `tsconfig.json`. When no target is specified, TypeScript may default to ES5, which has stricter rules about function declarations inside blocks. ES2017 allows modern JavaScript features and resolves this issue.

**Files Changed**:
- `tsconfig.json` - Added `"target": "ES2017"` to compilerOptions
- Removed `tsconfig.tsbuildinfo` - Cleared build cache

## Deployment to Vercel

### Prerequisites
1. Vercel account
2. GitHub repository
3. Required API Keys:
   - Schwab API credentials (App Key, Secret, Refresh Token)
   - Finnhub API key

### Step 1: Push to GitHub
```bash
git init
git add .
git commit -m "Initial commit - AI Hedge Fund"
git branch -M main
git remote add origin https://github.com/yourusername/your-repo.git
git push -u origin main
```

### Step 2: Deploy to Vercel
1. Go to [vercel.com](https://vercel.com)
2. Click "Add New..." → "Project"
3. Import your GitHub repository
4. Configure environment variables:

**Required Environment Variables**:
```
SCHWAB_APP_KEY=your_schwab_app_key
SCHWAB_APP_SECRET=your_schwab_secret
SCHWAB_REFRESH_TOKEN=your_refresh_token
FINNHUB_API_KEY=your_finnhub_key
```

5. Click "Deploy"

### Step 3: Verify Deployment
- Once deployed, visit your Vercel URL
- Test with a stock ticker (e.g., AAPL, TSLA)
- Verify data loads correctly
- Check tracker functionality

## Environment Variables Explained

### SCHWAB_APP_KEY
Your Schwab Developer API application key. Get this from [Schwab Developer Portal](https://developer.schwab.com).

### SCHWAB_APP_SECRET  
Your Schwab Developer API application secret.

### SCHWAB_REFRESH_TOKEN
OAuth refresh token for Schwab API. This is obtained through the OAuth flow.

**How to get Schwab tokens**:
1. Register app at developer.schwab.com
2. Complete OAuth flow to get refresh token
3. Store refresh token securely

### FINNHUB_API_KEY
Free or paid API key from [Finnhub](https://finnhub.io). Used for:
- Company fundamentals
- News sentiment
- Analyst ratings
- Insider transactions
- Earnings calendar

## Local Development

### Setup
```bash
# Install dependencies
npm install

# Create .env.local file with your API keys
echo "SCHWAB_APP_KEY=your_key" > .env.local
echo "SCHWAB_APP_SECRET=your_secret" >> .env.local
echo "SCHWAB_REFRESH_TOKEN=your_token" >> .env.local
echo "FINNHUB_API_KEY=your_key" >> .env.local

# Run development server
npm run dev
```

Visit `http://localhost:3000`

### Build & Test Locally
```bash
# Test production build
npm run build

# Start production server
npm start
```

## Troubleshooting

### Build Fails with TypeScript Errors
- Ensure `"target": "ES2017"` is in tsconfig.json
- Delete `.next` folder and rebuild: `rm -rf .next && npm run build`
- Delete `tsconfig.tsbuildinfo`: `rm tsconfig.tsbuildinfo`

### API Rate Limiting
- Schwab API has rate limits on quote and chain endpoints
- The app uses built-in caching (15-20 second TTL)
- For high-frequency testing, use longer cache TTLs in code

### Missing Data
- Check that all environment variables are set correctly
- Verify API keys are active and have proper permissions
- Check Vercel deployment logs for specific API errors

### Tracker Not Working
- Tracker uses file-based storage by default (works on Vercel)
- Data persists across deployments
- For true persistence, consider migrating to a database

## Advanced Configuration

### Custom Storage Path
Set `TRACKER_STORE_PATH` environment variable to change where suggestions are stored:
```
TRACKER_STORE_PATH=/tmp/tracker-store.json
```

### Increase Cache TTL
Edit cache TTL values in:
- `/app/api/tracker/route.ts` - Lines 54, 68 (quote and chain caches)
- `/app/api/stock/[ticker]/route.ts` - Various cache implementations

## Support & Issues

If you encounter issues:
1. Check Vercel deployment logs
2. Verify all environment variables are set
3. Test API keys independently
4. Review this guide's troubleshooting section

## Next Steps

After successful deployment:
1. Test with multiple tickers
2. Track some positions using the Tracker tab
3. Review confidence calibration over time
4. Consider adding custom pattern detection rules
5. Explore options analysis features
