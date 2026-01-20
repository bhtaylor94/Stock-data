# AI Hedge Fund v2.0 🧠📈

Professional-grade stock analysis platform with institutional trading playbooks, evidence verification, and continuous calibration.

## 🚀 What's New in v2.0

- ✨ **15+ Professional Trading Playbooks** - Trend Continuation, Mean Reversion, Breakouts, etc.
- ✨ **Evidence Verification** - Cryptographic hashing for tamper-proof decisions
- ✨ **Historical Snapshots** - JSONL-based tracking for long-term calibration
- ✨ **Calibration APIs** - Measure forecast accuracy by confidence & setup
- ✨ **Outcomes Tracking** - Forward returns at 1d, 3d, 5d, 10d, 14d horizons
- ✨ **Market Regime Detection** - Adaptive strategies for TREND/RANGE/HIGH_VOL

## 📚 Documentation

- **[Deployment Guide](./DEPLOYMENT_GUIDE.md)** - Fix build errors & deploy to Vercel
- **[Application Overview](./APPLICATION_OVERVIEW.md)** - Complete feature guide (v2.0)
- **[Decision Logic](./DECISION_LOGIC_EXPLAINED.md)** - Deep dive into AI scoring

## ✨ Core Features

### Professional Trading Playbooks

15+ institutional-quality setups with explicit rules:

**Bullish**: Trend Continuation, Mean Reversion Bounce, Breakout Momentum, Bull Flag, Bollinger Squeeze  
**Bearish**: Trend Continuation, Mean Reversion Fade, Breakdown, Bear Flag, Distribution Failure  
**Adaptive**: Range Rotation, Volatility Spike, Dead Zone (NO_TRADE)

Each includes: Entry criteria, ATR stops, targets, invalidation levels, evidence logging

### Evidence Verification

Every recommendation includes a **cryptographic hash** of all inputs:
- Tamper-proof decision trail
- Full auditability
- Transparent datapoints
- Accountable predictions

### Multi-Factor Analysis

- **18-point scoring**: 9 technical + 9 fundamental
- **Chart patterns**: Cup & Handle, H&S, Double Tops/Bottoms
- **News sentiment**: Real-time scoring
- **Analyst consensus**: Ratings + price targets
- **Insider activity**: Net buying/selling
- **Options analysis**: UOA, Greeks, chains

### Position Tracker

- Real-time P&L tracking
- Auto-status updates (HIT_TARGET, STOPPED_OUT)
- Win rate by confidence bucket
- Win rate by setup type
- Forward return measurement

### New APIs

**GET /api/calibration** - Performance metrics by bucket & setup  
**GET /api/outcomes?ticker=AAPL** - Historical outcomes for ticker  
**POST /api/outcomes** - Record closed position with P&L

## 🚀 Quick Start

### Install
```bash
npm install
```

### Configure Environment
Create `.env.local`:
```env
SCHWAB_APP_KEY=your_schwab_app_key
SCHWAB_APP_SECRET=your_schwab_secret
SCHWAB_REFRESH_TOKEN=your_refresh_token
FINNHUB_API_KEY=your_finnhub_key
```

Get API keys:
- **Schwab**: [developer.schwab.com](https://developer.schwab.com) (requires brokerage account)
- **Finnhub**: [finnhub.io](https://finnhub.io) (free tier: 60 calls/min)

### Run
```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000)

### Deploy to Vercel

See [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) for step-by-step instructions.

## 📊 API Endpoints

### Stock Analysis
**GET /api/stock/[ticker]**  
Returns comprehensive analysis with:
- Real-time quote
- Technical indicators (18 factors)
- Fundamental metrics (9 factors)
- Chart patterns
- News sentiment
- Analyst ratings
- Setup recommendation
- Evidence packet (with hash)

### Options Analysis
**GET /api/options/[ticker]**  
Returns options intelligence with:
- Options chains
- Greeks (Delta, Gamma, Theta, Vega)
- Unusual options activity
- Specific contract recommendations

### Position Tracker
**GET /api/tracker**  
All tracked positions with real-time P&L

**POST /api/tracker**  
Track a new position

**PUT /api/tracker**  
Update position status

**DELETE /api/tracker?id=[id]**  
Remove tracked position

### Calibration & Outcomes (NEW!)
**GET /api/calibration**  
Performance metrics by confidence bucket and setup type

**GET /api/outcomes?ticker=AAPL**  
Historical outcomes for a ticker

**POST /api/outcomes**  
Record closed position with realized P&L

## 🎓 How It Works

### Setup Selection Process

1. **Market Data** - Fetch from Schwab + Finnhub
2. **Indicators** - Calculate technical + fundamental metrics
3. **Regime Detection** - Classify as TREND / RANGE / HIGH_VOL
4. **Setup Evaluation** - Score all 15+ playbooks
5. **Best Setup** - Select highest-scoring non-conflicting setup
6. **Confidence** - Calibrate based on evidence strength
7. **Evidence** - Generate packet with SHA-256 hash
8. **Snapshot** - Save to JSONL for calibration
9. **Display** - Show recommendation to user

### Confidence Calibration

```
Base Confidence (from combined score 0-18)
    + News sentiment (±5%)
    + Analyst consensus (±5%)
    + Insider activity (±3%)
    + Price target upside (±5%)
    + Chart patterns (±10-15%)
    + Regime adjustments (±4%)
    + Completeness check (±4-12%)
    + Agreement threshold (±6-10%)
    = Final Confidence (capped 25-95%)
```

### Example

**AAPL at $180**:
- Technical: 8/9
- Fundamental: 8/9
- Combined: 16/18 → Base 85%
- Bullish news → +5%
- Analysts 85% buy → +5%
- Insider buying → +3%
- Cup & Handle → +12%
- **Final: 95% (capped)**
- **Setup: Trend Continuation Bull**

## 🏗️ Architecture

```
Next.js 14 (App Router) + TypeScript
    ├── Schwab API (real-time quotes, options)
    ├── Finnhub API (fundamentals, news, analysts)
    ├── Setup Registry (15+ playbooks)
    ├── Evidence Verification (SHA-256 hashing)
    ├── Snapshot Store (JSONL persistence)
    └── Calibration Engine (outcomes measurement)
```

**Storage**:
- File-based JSON (tracker positions)
- JSONL (historical snapshots)
- TTL caches (API responses)

## 🔧 Customization

### Adjust Setup Criteria
Edit `/lib/setupRegistry.ts`:
- Modify entry/exit rules
- Change ATR multipliers
- Add custom playbooks

### Change Confidence Thresholds
Edit `/app/api/stock/[ticker]/route.ts`:
- Lines 60-84: Confidence calibration
- Lines 1095-1303: Recommendation generation

### Configure Storage
Set environment variables:
- `TRACKER_STORE_PATH` - Custom tracker storage path
- `AIHF_SNAPSHOT_PATH` - Custom snapshot storage path

## ⚠️ Deployment Fix

**Problem**: Original v1.0 failed with ES5 strict mode error

**Solution**: Added `"target": "ES2017"` to `tsconfig.json`

See [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) for details.

## 📈 Performance Metrics

Track and measure:
- Win rate by confidence bucket (HIGH/MED/LOW)
- Win rate by setup type
- Average P&L by strategy
- Forward returns at multiple horizons
- Forecast accuracy over time

## ⚠️ Disclaimers

**For educational purposes only. Not financial advice.**

This application provides analysis based on publicly available data and technical indicators. It does not constitute investment advice, financial advice, trading advice, or any other sort of advice.

Always conduct your own research and consult with qualified financial advisors before making investment decisions.

## 📄 License

MIT License - See LICENSE file for details

## 🆘 Support

- **Build errors?** → [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)
- **Feature questions?** → [APPLICATION_OVERVIEW.md](./APPLICATION_OVERVIEW.md)
- **Algorithm questions?** → [DECISION_LOGIC_EXPLAINED.md](./DECISION_LOGIC_EXPLAINED.md)

---

**v2.0** - Professional trading playbooks + Evidence verification + Continuous calibration 🚀
