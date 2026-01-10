# AI Hedge Fund 🧠📈

A professional-grade stock and options analysis platform that combines real-time market data with sophisticated multi-factor analysis to generate actionable trading recommendations.

## 🚀 Quick Links

- **[Deployment Guide](./DEPLOYMENT_GUIDE.md)** - Fix deployment errors & deploy to Vercel
- **[Application Overview](./APPLICATION_OVERVIEW.md)** - What this application does
- **[Decision Logic Explained](./DECISION_LOGIC_EXPLAINED.md)** - Deep dive into AI decision-making

## ✨ Key Features

### 📊 Comprehensive Stock Analysis
- **18-Factor Scoring System**: 9 technical + 9 fundamental metrics
- **Chart Pattern Recognition**: Cup & Handle, Head & Shoulders, Double Tops/Bottoms, and more
- **News Sentiment Analysis**: Real-time sentiment scoring from headlines
- **Analyst Consensus**: Professional ratings and price targets
- **Insider Activity Tracking**: Net buying/selling detection
- **Earnings Calendar**: Upcoming earnings alerts

### 📈 Options Intelligence
- **Unusual Options Activity (UOA)**: Detect institutional-level option flow
- **Full Greeks Analysis**: Delta, Gamma, Theta, Vega
- **Specific Contract Recommendations**: Strike, expiration, and entry suggestions
- **Options Chain Data**: Real-time bid/ask spreads and open interest

### 📌 Position Tracker
- **Real-time P&L**: Track stock and options positions with live pricing
- **Auto-Status Updates**: Automatically marks positions as HIT_TARGET or STOPPED_OUT
- **Performance Analytics**: Win rate by confidence bucket and strategy type
- **Confidence Calibration**: Measures actual outcomes vs predicted confidence

## 🎯 What Makes This Different?

1. **Multi-Factor Validation**: Analyzes 18+ factors across technical, fundamental, and qualitative dimensions
2. **Conservative Confidence Calibration**: Designed for accuracy, not overconfidence (caps at 95%)
3. **Professional Pattern Recognition**: Strict mathematical criteria with volume confirmation
4. **Transparent Reasoning**: Every confidence adjustment is explained
5. **Performance Tracking**: Continuous feedback loop to improve predictions

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment Variables

Create a `.env.local` file:

```env
# Schwab API (for real-time market data)
SCHWAB_APP_KEY=your_schwab_app_key
SCHWAB_APP_SECRET=your_schwab_app_secret
SCHWAB_REFRESH_TOKEN=your_schwab_refresh_token

# Finnhub API (for fundamentals, news, analyst data)
FINNHUB_API_KEY=your_finnhub_key
```

**Get API Keys**:
- **Schwab**: [developer.schwab.com](https://developer.schwab.com) - Requires brokerage account
- **Finnhub**: [finnhub.io](https://finnhub.io) - Free tier available (60 calls/min)

### 3. Run Locally
```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000)

### 4. Deploy to Vercel

See the **[Deployment Guide](./DEPLOYMENT_GUIDE.md)** for detailed instructions.

## 📖 Documentation

### For Users
- **[Application Overview](./APPLICATION_OVERVIEW.md)** - Comprehensive guide to features and capabilities

### For Developers
- **[Decision Logic Explained](./DECISION_LOGIC_EXPLAINED.md)** - Technical deep dive into the AI decision system
- **[Deployment Guide](./DEPLOYMENT_GUIDE.md)** - Troubleshooting and deployment instructions

## 🏗️ Architecture

### Data Flow
```
User enters ticker → Parallel API calls (Schwab + Finnhub)
                    ↓
        [Technical Analysis: 9 points]
        [Fundamental Analysis: 9 points]
        [Chart Patterns]
        [News Sentiment]
        [Analyst Consensus]
        [Insider Activity]
                    ↓
        [Combined Score: 0-18]
                    ↓
        [Base Confidence Calculation]
                    ↓
        [Adjustments: news, analysts, insiders, patterns]
                    ↓
        [Regime Detection & Calibration]
                    ↓
        [Final Recommendation: BUY/SELL/HOLD with 25-95% confidence]
```

### Tech Stack
- **Frontend**: Next.js 14 with React 18 and TypeScript
- **Styling**: Tailwind CSS
- **APIs**: Schwab (market data), Finnhub (fundamentals, news)
- **Hosting**: Vercel (serverless)
- **Storage**: File-based JSON for tracker (upgradeable to database)

## 📊 API Endpoints

### `GET /api/stock/[ticker]`
Returns comprehensive stock analysis with:
- Real-time quotes
- Technical indicators (RSI, MACD, moving averages, Bollinger Bands)
- Fundamental metrics (P/E, ROE, debt ratios, growth rates)
- Chart patterns
- News sentiment
- Analyst ratings
- Insider transactions
- Trade recommendations

### `GET /api/options/[ticker]`
Returns options intelligence with:
- Options chain data
- Greeks (Delta, Gamma, Theta, Vega)
- Unusual options activity
- Specific contract recommendations

### `GET /api/tracker`
Returns all tracked positions with:
- Real-time P&L calculations
- Current prices
- Status updates (ACTIVE, HIT_TARGET, STOPPED_OUT, CLOSED, EXPIRED)
- Performance statistics

### `POST /api/tracker`
Track a new position:
```json
{
  "ticker": "AAPL",
  "type": "STOCK_BUY" | "STOCK_SELL" | "CALL" | "PUT",
  "strategy": "Strong Buy - Excellent Fundamentals & Technicals",
  "entryPrice": 180.00,
  "targetPrice": 198.00,
  "stopLoss": 171.00,
  "confidence": 85,
  "reasoning": ["Score 16/18", "Bullish news", "Insider buying"],
  "optionContract": {  // Optional, for options only
    "strike": 185.00,
    "expiration": "2026-03-20",
    "dte": 70,
    "delta": 0.45,
    "entryAsk": 8.50,
    "optionType": "CALL"
  }
}
```

### `PUT /api/tracker`
Update position status:
```json
{
  "id": "AAPL-1234567890",
  "status": "CLOSED" | "HIT_TARGET" | "STOPPED_OUT"
}
```

### `DELETE /api/tracker?id=[id]`
Remove a tracked position.

## 🎓 How the Decision Logic Works

The system uses a **multi-layered scoring approach**:

1. **Technical Analysis (0-9 points)**: Price vs SMAs, RSI, MACD, Bollinger Bands, volume, ATR
2. **Fundamental Analysis (0-9 points)**: P/E, ROE, debt ratios, margins, growth rates
3. **Combined Score (0-18)**: Determines BUY/SELL/HOLD direction
4. **Base Confidence**: Calculated from combined score (40-95%)
5. **Adjustments**: News sentiment (±5%), analysts (±5%), insiders (±3%), price targets (±5%)
6. **Pattern Bonus**: Confirmed chart patterns (±10-15%)
7. **Regime Detection**: Trend/range/high-vol adjustments (±4%)
8. **Final Calibration**: Capped at 95%, floored at 25%

**Example**: A stock with technical score 8/9, fundamental score 8/9 gets:
- Combined score: 16/18 → Base confidence 85%
- Bullish news → +5%
- 85% analyst buy rating → +5%
- Insider buying → +3%
- Cup & Handle pattern confirmed → +12%
- **Final: 95% confidence BUY**

For a detailed walkthrough, see **[Decision Logic Explained](./DECISION_LOGIC_EXPLAINED.md)**.

## 🔧 Customization

### Adjust Scoring Thresholds
Edit `/app/api/stock/[ticker]/route.ts`:
- Lines 200-350: Technical scoring rules
- Lines 400-550: Fundamental scoring rules
- Lines 1095-1303: Recommendation generation logic

### Modify Cache TTL
- Tracker API: Lines 54, 68 (15-20 second cache)
- Stock API: Various caching implementations

### Change Pattern Bonuses
Lines 1452-1497 in stock route define pattern confidence adjustments.

## ⚠️ Important Notes

### Deployment Fix
The original code had a TypeScript compilation error when targeting ES5. This has been fixed by:
- Adding `"target": "ES2017"` to `tsconfig.json`
- Removing cached build artifacts

See **[Deployment Guide](./DEPLOYMENT_GUIDE.md)** for details.

### API Rate Limits
- **Schwab**: Rate limits on quote and chain endpoints (use built-in caching)
- **Finnhub**: Free tier = 60 calls/min

### Storage
- **Current**: File-based JSON storage (works on Vercel, persists across deploys)
- **Recommended for scale**: Migrate to Vercel KV, Supabase, or PlanetScale

## 📈 Performance Metrics

The tracker measures and displays:
- **Win Rate by Confidence Bucket**: HIGH (75%+), MED (60-74%), LOW (<60%)
- **Win Rate by Strategy**: Performance breakdown by trade type
- **Total P&L**: Across all positions
- **Average P&L %**: Mean return per position

## 🛡️ Disclaimer

⚠️ **For educational and informational purposes only. Not financial advice.**

This application provides analysis based on publicly available data and technical indicators. It does not constitute investment advice, financial advice, trading advice, or any other sort of advice. You should not treat any of the application's content as such.

Always conduct your own research and consult with qualified financial advisors before making investment decisions.

## 📄 License

MIT License - See LICENSE file for details.

## 🤝 Contributing

Contributions are welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## 🆘 Support

For issues or questions:
1. Check the **[Deployment Guide](./DEPLOYMENT_GUIDE.md)** troubleshooting section
2. Review the **[Decision Logic Explained](./DECISION_LOGIC_EXPLAINED.md)** for algorithm questions
3. Open an issue on GitHub

---

Built with ❤️ for traders who want data-driven insights.
