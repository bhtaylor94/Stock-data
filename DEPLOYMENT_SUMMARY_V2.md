# AI Hedge Fund v2.0 - Deployment Package

## What's Included

### ✅ Fixed TypeScript Configuration
- Added `"target": "ES2017"` to `tsconfig.json`
- Resolves ES5 strict mode build error
- Clean build artifacts removed

### ✅ New Features (v2.0)

1. **Professional Trading Playbooks** (`/lib/setupRegistry.ts`)
   - 15+ institutional-quality setups
   - Explicit entry, stop, target rules
   - Evidence-based decision making

2. **Evidence Verification** (`/lib/evidencePacket.ts`)
   - SHA-256 cryptographic hashing
   - Tamper-proof decision trail
   - Full auditability

3. **Historical Snapshots** (`/lib/storage/snapshotStore.ts`)
   - JSONL-based persistence
   - Long-term calibration database
   - Searchable by ticker

4. **New API Endpoints**
   - `/api/calibration` - Performance metrics
   - `/api/outcomes` - Forward return tracking

5. **Enhanced Tracker**
   - Outcomes measurement
   - Evidence packet storage
   - Setup-based performance

### ✅ Comprehensive Documentation

- **README.md** - Quick start + v2.0 features overview
- **DEPLOYMENT_GUIDE.md** - Step-by-step Vercel deployment + troubleshooting
- **APPLICATION_OVERVIEW.md** - Complete feature guide with new playbooks
- **DECISION_LOGIC_EXPLAINED.md** - Deep dive into scoring system

### ✅ Complete File Structure

```
ai-hedge-fund-v2-fixed/
├── app/
│   ├── api/
│   │   ├── stock/[ticker]/route.ts       # Stock analysis
│   │   ├── options/[ticker]/route.ts     # Options analysis
│   │   ├── tracker/route.ts              # Position tracker (FIXED)
│   │   ├── calibration/route.ts          # NEW: Performance metrics
│   │   └── outcomes/route.ts             # NEW: Outcomes tracking
│   ├── page.tsx                          # Main UI
│   ├── layout.tsx
│   └── globals.css
├── lib/
│   ├── cache.ts
│   ├── httpCache.ts
│   ├── schwab.ts
│   ├── trackerStore.ts                   # Enhanced with outcomes
│   ├── evidencePacket.ts                 # NEW: Verification
│   ├── setupRegistry.ts                  # NEW: 15+ playbooks
│   └── storage/
│       └── snapshotStore.ts              # NEW: Historical tracking
├── tsconfig.json                         # FIXED: ES2017 target
├── package.json
├── next.config.js
├── tailwind.config.js
├── postcss.config.js
├── .gitignore
├── README.md                             # Updated for v2.0
├── DEPLOYMENT_GUIDE.md
├── APPLICATION_OVERVIEW.md               # Updated for v2.0
└── DECISION_LOGIC_EXPLAINED.md
```

## What Was Fixed

### The Build Error
```
Type error: Function declarations are not allowed inside blocks in strict mode when targeting 'ES5'
```

**Root Cause**: TypeScript was defaulting to ES5 target, which has stricter rules

**Fix**: Added `"target": "ES2017"` to `tsconfig.json`

**Files Modified**:
- `tsconfig.json` - Added explicit target
- Removed `tsconfig.tsbuildinfo` - Cleared build cache

## Quick Deploy Steps

### 1. Extract & Push to GitHub
```bash
# Extract zip
unzip ai-hedge-fund-v2-deployment.zip
cd ai-hedge-fund-v2-fixed

# Initialize git
git init
git add .
git commit -m "AI Hedge Fund v2.0 - Production ready"

# Add remote and push
git remote add origin https://github.com/yourusername/your-repo.git
git branch -M main
git push -u origin main
```

### 2. Deploy to Vercel
1. Visit [vercel.com](https://vercel.com)
2. Click "Add New..." → "Project"
3. Import your GitHub repository
4. Add environment variables:
   ```
   SCHWAB_APP_KEY=your_key
   SCHWAB_APP_SECRET=your_secret
   SCHWAB_REFRESH_TOKEN=your_token
   FINNHUB_API_KEY=your_key
   ```
5. Click "Deploy"

Build should succeed! ✅

### 3. Verify Deployment
- Test stock analysis: Enter "AAPL"
- Check setup recommendation (e.g., "Trend Continuation Bull")
- Verify evidence packet with hash
- Track a position
- Check calibration endpoint: `/api/calibration`

## New Features Explained

### Setup Registry

The application now uses **professional trading playbooks** instead of generic signals:

**Before (v1.0)**:
```json
{
  "type": "BUY",
  "confidence": 75,
  "reasoning": ["Score 14/18"]
}
```

**After (v2.0)**:
```json
{
  "type": "BUY",
  "setup": "Trend Continuation Bull",
  "confidence": 82,
  "entry": "$180.50",
  "stop": "$176.20 (1.5 ATR)",
  "targets": ["$186.80", "$190.10"],
  "reasoning": [
    "Trend filter: price > SMA50 > SMA200",
    "RSI in continuation zone (58)",
    "MACD histogram positive"
  ],
  "evidencePacket": {
    "hash": "a8f3c9d2...",
    "checks": [...]
  }
}
```

### Evidence Verification

Every decision is now cryptographically verifiable:
- SHA-256 hash of all inputs
- Tamper-proof audit trail
- Can verify no data was changed post-decision
- Full transparency into what drove the recommendation

### Historical Calibration

The system now tracks:
- Win rate by confidence bucket (HIGH: 75%+, MED: 60-74%, LOW: <60%)
- Win rate by setup type (Trend Continuation, Mean Reversion, etc.)
- Forward returns at 1d, 3d, 5d, 10d, 14d horizons
- Continuous improvement via outcomes measurement

## Environment Variables

**Required**:
```
SCHWAB_APP_KEY         - Schwab Developer API app key
SCHWAB_APP_SECRET      - Schwab Developer API secret
SCHWAB_REFRESH_TOKEN   - OAuth refresh token
FINNHUB_API_KEY        - Finnhub API key
```

**Optional**:
```
TRACKER_STORE_PATH     - Custom path for tracker JSON (default: .data/tracker.json)
AIHF_SNAPSHOT_PATH     - Custom path for snapshots JSONL (default: /tmp/aihf_snapshots.jsonl)
```

## API Testing

### Test Calibration
```bash
curl https://your-app.vercel.app/api/calibration
```

Expected response:
```json
{
  "totalTracked": 0,
  "realizedCount": 0,
  "byBucket": {},
  "bySetup": {},
  "horizonReturns": {},
  "note": "Calibration is computed from tracked suggestions..."
}
```

### Test Outcomes
```bash
curl https://your-app.vercel.app/api/outcomes?ticker=AAPL
```

### Test Stock Analysis
```bash
curl https://your-app.vercel.app/api/stock/AAPL
```

Look for `setup` field in the response (e.g., "Trend Continuation Bull")

## Troubleshooting

### Build Still Fails?
1. Verify `tsconfig.json` has `"target": "ES2017"`
2. Delete `.next` folder: `rm -rf .next`
3. Delete build cache: `rm tsconfig.tsbuildinfo`
4. Rebuild: `npm run build`

### Missing setupRegistry.ts?
- File should be in `/lib/setupRegistry.ts`
- Check it was included in the zip extraction
- File size should be ~31KB

### Snapshots Not Saving?
- Check write permissions on `/tmp` (Vercel) or custom path
- Verify `AIHF_SNAPSHOT_PATH` if set
- Snapshots are best-effort (won't fail requests if storage fails)

### Calibration Shows No Data?
- Normal on first deploy - no positions tracked yet
- Track some positions using the UI
- Close positions with outcomes
- Check `/api/calibration` after a few closed positions

## What's Different from v1.0?

**v1.0**:
- Generic BUY/SELL/HOLD signals
- Basic 18-factor scoring
- No setup framework
- No evidence verification
- Limited calibration

**v2.0**:
- 15+ professional trading playbooks
- Setup-based recommendations with explicit rules
- Evidence verification with cryptographic hashing
- Historical snapshot tracking
- Comprehensive calibration by setup & confidence
- Forward return measurement
- Market regime adaptation

## Next Steps

1. ✅ Deploy to Vercel
2. ✅ Test with tickers (AAPL, TSLA, etc.)
3. ✅ Track positions and monitor P&L
4. ✅ Let system build calibration data
5. ✅ Review setup performance in `/api/calibration`
6. ✅ Customize playbooks in `setupRegistry.ts` if desired

## Support

All documentation included:
- **Deployment issues?** → `DEPLOYMENT_GUIDE.md`
- **Feature questions?** → `APPLICATION_OVERVIEW.md`
- **Algorithm details?** → `DECISION_LOGIC_EXPLAINED.md`

---

**You're all set!** 🚀

AI Hedge Fund v2.0 is production-ready with:
- ✅ TypeScript build error fixed
- ✅ Professional trading playbooks
- ✅ Evidence verification
- ✅ Historical tracking
- ✅ Continuous calibration
- ✅ Comprehensive documentation
