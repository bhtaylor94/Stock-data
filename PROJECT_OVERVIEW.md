# Schwab Automated Trading System - Complete Overview

## 📦 What You've Received

A complete, production-ready automated trading system for stocks and options using Charles Schwab's APIs, inspired by QuantVue's proven methodologies.

### Package Contents

```
schwab_trading_app/
├── main.py                      # Main entry point
├── requirements.txt             # Python dependencies
├── README.md                    # Complete documentation
├── QUICKSTART.md               # Quick start guide
├── .env.example                # Environment variables template
├── .gitignore                  # Git ignore rules
│
├── config/
│   ├── __init__.py
│   └── config.py               # All configuration settings
│
├── core/
│   ├── __init__.py
│   ├── schwab_client.py        # Schwab API client
│   ├── order_builder.py        # Order construction
│   ├── risk_manager.py         # Risk management engine
│   └── trading_engine.py       # Main trading orchestration
│
├── strategies/
│   ├── __init__.py
│   ├── strategies.py           # Stock strategies
│   └── options_strategies.py  # Options strategies
│
├── data/                       # Token and data storage
└── logs/                       # Application logs
```

## 🎯 Key Features Implemented

### 1. Schwab API Integration
✅ OAuth2 authentication with auto-refresh
✅ Account management (balances, positions, orders)
✅ Real-time market data (quotes, historical prices)
✅ Options chain data retrieval
✅ Order execution (market, limit, stop, bracket orders)
✅ Rate limiting to comply with Schwab's API limits

### 2. Trading Strategies (QuantVue-Inspired)

#### A. Momentum Scalper (like Qscalper)
- RSI-based entry signals
- EMA trend confirmation
- Volume filters
- Quick 2:1 risk/reward targets
- 15-30 minute hold times

#### B. Trend Follower (like Qzeus)
- Multiple EMA alignment
- MACD confirmation
- Trend strength filtering
- 4:1 risk/reward targets
- Multi-hour to multi-day holds

#### C. Volatility Breakout (like Qkronos_EVO)
- Bollinger Band breakouts
- ATR-based dynamic targets
- Volume confirmation
- Adapts to market volatility

#### D. Options Scalper
- 0-7 DTE options focus
- Delta-based contract selection
- IV percentile filtering
- 25% profit / 50% stop targets

### 3. Risk Management System

#### Position Sizing Methods
✅ Fixed fractional (% of account)
✅ Kelly Criterion (win-rate based)
✅ Volatility-adjusted (ATR-based)

#### Stop Loss Types
✅ Static percentage stops
✅ Dynamic ATR-based stops
✅ Trailing stops with activation threshold

#### Take Profit Strategies
✅ Static targets
✅ Dynamic ATR-based targets
✅ Tiered exits (partial profit taking)

#### Portfolio Controls
✅ Maximum position size limits
✅ Total exposure limits
✅ Daily loss limits (auto-stop)
✅ Maximum daily trade limits
✅ Martingale option (use with extreme caution)

### 4. Execution & Monitoring

#### Order Types Supported
- Market orders
- Limit orders
- Stop orders
- Stop-limit orders
- Bracket orders (entry + stop + target)
- Trailing stops
- Multi-leg option spreads

#### Real-time Monitoring
- Continuous position tracking
- Automatic stop loss management
- Trailing stop updates
- Risk limit enforcement
- Performance tracking

### 5. Trading Modes
✅ **Paper Trading**: Simulate trades with real market data
✅ **Live Trading**: Execute real trades with actual capital
⏳ **Backtesting**: Historical strategy testing (framework ready)

## 🚀 How It Works

### System Flow

```
1. INITIALIZATION
   ├── Load configuration
   ├── Authenticate with Schwab
   ├── Connect to account
   ├── Initialize strategies
   └── Start monitoring threads

2. MARKET SCANNING
   ├── Fetch real-time quotes
   ├── Get price history
   ├── Calculate indicators (RSI, EMAs, ATR, etc.)
   ├── Run strategy analysis
   └── Generate signals

3. SIGNAL PROCESSING
   ├── Validate signal
   ├── Check risk limits
   ├── Calculate position size
   ├── Build order payload
   └── Execute trade

4. POSITION MANAGEMENT
   ├── Monitor open positions
   ├── Check stop loss conditions
   ├── Check take profit conditions
   ├── Update trailing stops
   └── Execute exits

5. RISK MONITORING
   ├── Track daily P&L
   ├── Check exposure limits
   ├── Enforce daily loss limit
   ├── Count daily trades
   └── Halt if limits exceeded
```

### Real-World Example

**Scenario**: System detects momentum opportunity in AAPL

1. **Signal Generation** (10:35 AM)
   - Price: $150.25
   - RSI: 28 (oversold)
   - EMA8 > EMA21 (bullish trend)
   - Volume: 2.1x average
   - Signal: **LONG**

2. **Risk Calculation**
   - Account value: $50,000
   - Max position size: 10% = $5,000
   - Stop loss (2% below): $147.25
   - Risk per share: $3.00
   - Position size: $5,000 / $150.25 = 33 shares
   - Take profit (4% above): $156.25

3. **Order Execution**
   - Place bracket order:
     * Entry: Buy 33 AAPL @ $150.25
     * Stop: Sell 33 AAPL @ $147.25
     * Target: Sell 33 AAPL @ $156.25

4. **Monitoring** (Continuous)
   - Price rises to $155.50
   - Trailing stop activates (1.5% profit)
   - Trailing stop set at $153.65

5. **Exit** (11:45 AM)
   - Price peaks at $156.80
   - Pulls back to $154.00
   - Trailing stop hit at $154.00
   - **Profit**: 33 × ($154.00 - $150.25) = **$123.75**

6. **Risk Recording**
   - Daily P&L: +$123.75
   - Daily trades: 1
   - Strategy win rate updated

## 🔧 Configuration Examples

### Conservative Setup
```python
risk_profile = RiskProfile.CONSERVATIVE
max_position_size_pct = 0.05      # 5% per position
max_total_exposure_pct = 0.30     # 30% total
stop_loss_pct = 0.015             # 1.5% stop
take_profit_pct = 0.03            # 3% target
max_daily_loss_pct = 0.03         # 3% daily max loss
```

### Moderate Setup (Default)
```python
risk_profile = RiskProfile.MODERATE
max_position_size_pct = 0.10      # 10% per position
max_total_exposure_pct = 0.50     # 50% total
stop_loss_pct = 0.02              # 2% stop
take_profit_pct = 0.04            # 4% target
max_daily_loss_pct = 0.05         # 5% daily max loss
```

### Aggressive Setup
```python
risk_profile = RiskProfile.AGGRESSIVE
max_position_size_pct = 0.15      # 15% per position
max_total_exposure_pct = 0.70     # 70% total
stop_loss_pct = 0.03              # 3% stop
take_profit_pct = 0.06            # 6% target
max_daily_loss_pct = 0.08         # 8% daily max loss
enable_martingale = True          # ⚠️ High risk!
```

## 📊 Performance Metrics

The system tracks:

### Strategy-Level Metrics
- Total signals generated
- Total trades executed
- Winning trades
- Losing trades
- Win rate (%)
- Total P&L
- Average P&L per trade

### Account-Level Metrics
- Account value
- Buying power
- Total exposure (%)
- Daily P&L ($)
- Daily P&L (%)
- Number of active positions
- Number of daily trades
- Largest position size (%)

## 🛡️ Safety Features

### Built-in Protection
1. **Daily Loss Limits**: Auto-stop trading if daily loss exceeds limit
2. **Trade Limits**: Prevents overtrading (max trades per day)
3. **Position Limits**: Max size per position and total exposure
4. **Rate Limiting**: Respects Schwab API limits
5. **Paper Trading**: Test without risk
6. **Error Handling**: Comprehensive exception handling
7. **Logging**: Detailed audit trail
8. **Token Security**: Encrypted token storage

### Emergency Procedures
- Ctrl+C: Graceful shutdown
- Kill process: `pkill -f main.py`
- Manual override: Schwab website/app
- Log review: `./logs/trading.log`

## 💡 Best Practices

### Before Going Live
1. ✅ Paper trade for minimum 2 weeks
2. ✅ Verify win rate > 55%
3. ✅ Test all strategies
4. ✅ Confirm risk limits work
5. ✅ Review all logs
6. ✅ Understand every parameter

### When Running Live
1. Start with 1-5% of total capital
2. Use conservative risk profile
3. Monitor very closely
4. Keep detailed records
5. Review daily performance
6. Adjust parameters gradually
7. Never override risk limits

### Ongoing Maintenance
- Review logs daily
- Check for API errors
- Monitor win rates
- Adjust strategies as needed
- Re-authenticate every 7 days (or run continuously)
- Keep Python packages updated

## 🔌 API Usage

### Schwab API Limits
- Market data: ~120 requests/minute
- Orders: 2-4 per second
- Auto-managed by the system

### Endpoints Used
```
GET  /accounts/accountNumbers
GET  /accounts/{hash}
GET  /accounts/{hash}/orders
POST /accounts/{hash}/orders
DEL  /accounts/{hash}/orders/{id}
GET  /quotes/{symbol}
GET  /pricehistory
GET  /chains
```

## 📈 Scalability

### Current Capacity
- 10+ symbols simultaneously
- 5+ concurrent positions
- 20+ trades per day
- Real-time monitoring

### Expansion Options
- Add more strategies
- Increase watchlist size
- Deploy to cloud (AWS, GCP)
- Add web dashboard
- Integrate ML predictions
- Multi-account support

## 🤝 Support & Resources

### Documentation
- README.md: Complete system documentation
- QUICKSTART.md: 5-minute setup guide
- Code comments: Inline documentation
- Schwab API docs: developer.schwab.com

### Getting Help
- Review logs first
- Check configuration
- Test in paper mode
- Contact Schwab API support: traderapi@schwab.com

## ⚖️ Legal & Compliance

### Disclaimers
- Not financial advice
- No profit guarantees
- Past performance ≠ future results
- Significant risk of loss
- Use at your own risk
- Educational purposes only

### Responsibilities
- You are solely responsible for:
  * All trading decisions
  * Risk management
  * Tax obligations
  * Regulatory compliance
  * Account security

## 🎓 Learning Resources

### Recommended Reading
- QuantVue documentation
- Schwab API documentation
- Technical Analysis books
- Risk Management principles
- Options trading guides

### Practice Path
1. Week 1-2: Paper trade + learn
2. Week 3-4: Optimize parameters
3. Week 5-6: Verify consistency
4. Week 7+: Consider live with minimal capital

## 🚨 Important Reminders

1. **Start Small**: Use paper trading extensively
2. **Risk Management**: More important than strategy
3. **Discipline**: Follow the system's signals
4. **Patience**: Good setups take time
5. **Learning**: Continuous improvement
6. **Reality**: Most traders lose money
7. **Capital**: Only use what you can afford to lose

## ✅ Final Checklist

Before going live, ensure:
- [ ] Paper traded for 2+ weeks
- [ ] Win rate > 55%
- [ ] Positive total P&L
- [ ] Understand all strategies
- [ ] Comfortable with risk settings
- [ ] Have emergency plan
- [ ] Adequate capital
- [ ] Time to monitor
- [ ] Emotional readiness
- [ ] Acceptance of potential losses

---

**This is a powerful tool. Use it responsibly. Trade safely. Good luck!** 🚀

For questions or issues, review the code, check logs, and test thoroughly in paper mode.
