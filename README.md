# Schwab Automated Trading System

[![Python Version](https://img.shields.io/badge/python-3.8%2B-blue)](https://www.python.org/downloads/)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)
[![Code Style](https://img.shields.io/badge/code%20style-black-000000.svg)](https://github.com/psf/black)
[![Trading](https://img.shields.io/badge/trading-automated-brightgreen)](https://github.com)
[![Status](https://img.shields.io/badge/status-active-success)](https://github.com)

A professional-grade automated trading system for stocks and options using Charles Schwab's APIs, inspired by QuantVue's proven automated trading methodologies.

**⭐ Star this repo if you find it useful!**

---

## ⚠️ **CRITICAL DISCLAIMER**

**THIS SOFTWARE IS PROVIDED FOR EDUCATIONAL PURPOSES ONLY. AUTOMATED TRADING INVOLVES SIGNIFICANT FINANCIAL RISK AND MAY NOT BE SUITABLE FOR ALL INVESTORS. YOU COULD LOSE ALL OF YOUR INVESTED CAPITAL.**

- Past performance is not indicative of future results
- No strategy guarantees profits
- Only trade with capital you can afford to lose
- Test extensively in paper trading mode before going live
- The authors assume no liability for any financial losses

## 🚀 Features

### Intelligent Market Scanner

**Automatically scans the top 100 S&P 500 stocks + 25 ETFs** to find the best trading opportunities!

- ✅ Dynamic symbol selection (not a static watchlist)
- ✅ Ranks by liquidity, volatility, and momentum
- ✅ Filters for quality execution (volume, spread, price)
- ✅ Re-scans every 5 minutes
- ✅ Always trading the most active stocks
- ✅ See [MARKET_SCANNER.md](MARKET_SCANNER.md) for details

### Trading Strategies (QuantVue-Inspired)

1. **Momentum Scalper** (Similar to Qscalper)
   - Short-term momentum entries
   - Volume-confirmed breakouts
   - Quick profit taking
   - RSI and EMA-based signals

2. **Trend Follower** (Similar to Qzeus)
   - Multiple timeframe trend confirmation
   - EMA crossover entries
   - MACD confirmation
   - Longer hold times for trend continuation

3. **Volatility Breakout** (Similar to Qkronos_EVO)
   - Bollinger Band breakouts
   - ATR-based position sizing
   - Dynamic profit targets
   - Volume confirmation

### Risk Management

- **Position Sizing Methods**:
  - Fixed fractional
  - Kelly Criterion
  - Volatility-adjusted (ATR-based)

- **Stop Loss Options**:
  - Static percentage stops
  - Dynamic ATR-based stops
  - Trailing stops

- **Take Profit Strategies**:
  - Static targets
  - Dynamic ATR-based targets
  - Tiered exits (partial profit taking)

- **Portfolio Controls**:
  - Maximum position size limits
  - Total exposure limits
  - Daily loss limits
  - Maximum daily trades
  - Martingale option (use with caution)

### Execution Features

- Fast order execution (modeled after QuantVue's <40ms execution)
- Bracket orders (entry + stop + target in one order)
- Trailing stop management
- Real-time position monitoring
- Automatic risk limit enforcement

### Trading Modes

1. **Paper Trading**: Simulate trades without real money
2. **Live Trading**: Execute real trades with actual capital
3. **Backtesting**: Test strategies on historical data (coming soon)

## 📋 Prerequisites

1. **Charles Schwab Account**
   - Active brokerage account
   - Account approved for API access

2. **Schwab Developer Account**
   - Register at [Schwab Developer Portal](https://developer.schwab.com)
   - Create an application
   - Get API Key and Secret

3. **Python 3.8+**

## 🛠️ Installation

### 1. Clone or Download

```bash
git clone <your-repo-url>
cd schwab_trading_app
```

### 2. Install Dependencies

```bash
pip install -r requirements.txt
```

### 3. Configure Environment Variables

Create a `.env` file in the project root:

```bash
# Schwab API Credentials
SCHWAB_APP_KEY=your_app_key_here
SCHWAB_APP_SECRET=your_app_secret_here
SCHWAB_CALLBACK_URL=https://127.0.0.1:8182
SCHWAB_ACCOUNT_NUMBER=your_account_number

# Optional: Custom token storage path
# SCHWAB_TOKEN_PATH=./data/token.json
```

**Important**: Never commit your `.env` file to version control!

### 4. Initial Authentication

Run the authentication setup (one-time process):

```bash
python main.py --auth
```

This will:
1. Generate an authorization URL
2. Open it in your browser
3. Prompt you to log in to Schwab
4. Save authentication tokens for future use

**Note**: Tokens expire after 7 days. The system auto-refreshes access tokens every 25 minutes while running. If offline for more than 7 days, re-run authentication.

## 🎯 Usage

### Paper Trading (Recommended to Start)

```bash
python main.py --mode paper
```

Test strategies without risking real money. All trades are simulated but follow real market data.

### Live Trading

```bash
python main.py --mode live
```

**⚠️ WARNING**: This uses real money! Make sure you've thoroughly tested in paper mode first.

### Check Status

```bash
python main.py --status
```

Shows:
- Account information
- Active positions
- Daily P&L
- Strategy performance
- Win rates

### Stop Trading

Press `Ctrl+C` to gracefully shut down the trading engine. All positions will remain open but monitoring will stop.

## ⚙️ Configuration

Edit `config/config.py` to customize:

### Risk Management

```python
@dataclass
class RiskManagementConfig:
    risk_profile: RiskProfile = RiskProfile.MODERATE  # CONSERVATIVE, MODERATE, AGGRESSIVE
    
    # Position sizing
    max_position_size_pct: float = 0.10  # Max 10% per position
    max_total_exposure_pct: float = 0.50  # Max 50% total
    
    # Stop loss
    enable_stop_loss: bool = True
    stop_loss_type: str = "dynamic"  # "dynamic" or "static"
    static_stop_loss_pct: float = 0.02  # 2%
    dynamic_stop_loss_atr_multiplier: float = 2.0
    
    # Take profit
    take_profit_type: str = "tiered"  # "tiered", "static", "dynamic"
    
    # Limits
    max_daily_loss_pct: float = 0.05  # Stop if down 5%
    max_daily_trades: int = 20
```

### Active Strategies

```python
@dataclass
class StrategyConfig:
    active_strategies: List[StrategyType] = [
        StrategyType.MOMENTUM_SCALPER,
        StrategyType.TREND_FOLLOWER,
        StrategyType.VOLATILITY_BREAKOUT
    ]
```

### Watchlist

```python
@dataclass
class DataConfig:
    stream_symbols: List[str] = [
        'SPY', 'QQQ', 'IWM',
        'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA',
        'TSLA', 'AMD', 'META'
    ]
```

## 📊 Architecture

```
schwab_trading_app/
├── main.py                 # Main entry point
├── config/
│   └── config.py          # Configuration classes
├── core/
│   ├── schwab_client.py   # Schwab API client
│   ├── order_builder.py   # Order construction
│   ├── risk_manager.py    # Risk management
│   └── trading_engine.py  # Main trading engine
├── strategies/
│   └── strategies.py      # Trading strategies
├── data/                  # Token and data storage
└── logs/                  # Log files
```

## 🔧 API Details

### Schwab API Endpoints Used

**Accounts & Trading Production:**
- `/accounts/accountNumbers` - Get account hashes
- `/accounts/{hash}` - Get account details
- `/accounts/{hash}/orders` - Place/manage orders
- `/accounts/{hash}/orders/{id}` - Get order status

**Market Data Production:**
- `/quotes/{symbol}` - Real-time quotes
- `/quotes` - Multiple quotes
- `/pricehistory` - Historical data
- `/chains` - Option chains

### Rate Limits

- Market data: ~120 requests/minute
- Order placement: 2-4 requests/second
- The system implements automatic rate limiting

## 📈 Strategy Details

### Momentum Scalper

**Entry Conditions:**
- RSI < 30 (oversold) OR RSI > 70 (overbought)
- EMA8 > EMA21 (uptrend) OR EMA8 < EMA21 (downtrend)
- Volume > 1.5x average

**Exit Conditions:**
- Stop: 1.5x ATR from entry
- Target: 3.0x ATR from entry (2:1 R:R)

**Typical Hold Time:** 15-30 minutes

### Trend Follower

**Entry Conditions:**
- EMA8 > EMA21 > EMA50 (strong uptrend)
- MACD > Signal (bullish momentum)
- Price above EMA8

**Exit Conditions:**
- Stop: 2% below EMA21
- Target: 4x ATR from entry

**Typical Hold Time:** Hours to days

### Volatility Breakout

**Entry Conditions:**
- Price breaks above/below Bollinger Bands
- Volume > 1.5x average
- Momentum confirmation

**Exit Conditions:**
- Stop: Bollinger midline
- Target: 2.5x ATR from entry

**Typical Hold Time:** 30 minutes to 2 hours

## 🛡️ Risk Management Best Practices

1. **Start with Paper Trading**
   - Test for at least 2 weeks
   - Verify strategy performance
   - Check risk controls are working

2. **Use Conservative Settings Initially**
   - Start with `RiskProfile.CONSERVATIVE`
   - Keep position sizes small (5% or less)
   - Use tight stop losses

3. **Monitor Daily Limits**
   - Set `max_daily_loss_pct` to 2-5%
   - Limit `max_daily_trades` to 10-20
   - The system will auto-stop if limits hit

4. **Diversify**
   - Trade multiple symbols
   - Use multiple strategies
   - Don't concentrate in one sector

5. **Regular Review**
   - Check daily performance
   - Review trade logs
   - Adjust parameters as needed

## 🔍 Monitoring & Logging

### Log Files

- Location: `./logs/trading.log`
- Includes:
  - All trades executed
  - Signals generated
  - Errors and warnings
  - Risk limit violations

### Real-time Status

```bash
# Check status while running
python main.py --status
```

### Example Log Output

```
2026-01-20 10:30:15 - MomentumScalper - INFO - Signal generated for AAPL: LONG
2026-01-20 10:30:16 - RiskManager - INFO - Position size calculated: 100 shares
2026-01-20 10:30:17 - TradingEngine - INFO - [PAPER] BUY 100 AAPL @ $150.25
2026-01-20 10:30:17 - TradingEngine - INFO - [PAPER] Stop: $147.50, Target: $156.75
```

## 🐛 Troubleshooting

### Authentication Errors

**Problem**: "No valid tokens found"

**Solution**: 
```bash
python main.py --auth
```

**Problem**: "Refresh token expired"

**Solution**: Re-authenticate (tokens expire after 7 days of inactivity)

### API Rate Limiting

**Problem**: "Rate limit reached"

**Solution**: The system auto-handles this. If you see frequent rate limit warnings, reduce:
- Number of symbols in watchlist
- Frequency of data requests
- Number of active strategies

### Order Rejections

**Problem**: Orders being rejected

**Check**:
1. Sufficient buying power
2. Symbol is tradable
3. Market hours (extended hours if enabled)
4. Order size within limits

### No Signals Generated

**Problem**: System running but no trades

**Possible Reasons**:
1. Market conditions don't meet strategy criteria
2. Already holding maximum positions
3. Daily loss limit reached
4. Risk limits preventing new trades

**Solution**: Check logs and reduce strategy entry filters

## 📚 Additional Resources

- [Schwab API Documentation](https://developer.schwab.com)
- [QuantVue Documentation](https://docs.quantvue.io)
- [Risk Management Principles](https://www.investopedia.com/terms/r/riskmanagement.asp)

## 🤝 Contributing

This is a personal trading system. Modify and adapt to your needs. Share improvements with proper risk disclaimers.

## 📄 License

Use at your own risk. No warranty provided. Not financial advice.

## 💬 Support

For Schwab API issues: traderapi@schwab.com

For trading questions: Consult a licensed financial advisor

---

## 🎓 Learning & Development

### Recommended Learning Path

1. **Week 1-2**: Paper trading with conservative settings
2. **Week 3-4**: Test different strategies and risk profiles
3. **Week 5-6**: Optimize parameters based on results
4. **Week 7+**: Consider live trading with minimal capital

### Performance Metrics to Track

- Win rate (target: 55%+)
- Average R:R ratio (target: 2:1 or better)
- Maximum drawdown
- Sharpe ratio
- Daily/weekly P&L

### Strategy Optimization

Modify strategy parameters in `strategies/strategies.py`:

```python
class MomentumScalper(BaseStrategy):
    def __init__(self, config, risk_manager):
        super().__init__("MomentumScalper", config, risk_manager)
        # Customize these
        self.min_rsi = 30
        self.max_rsi = 70
        self.min_volume_ratio = 1.5
```

## 🔐 Security Best Practices

1. **Never** share your API keys or tokens
2. **Never** commit `.env` file to version control
3. Store tokens securely
4. Use strong passwords for Schwab account
5. Enable two-factor authentication
6. Regularly rotate API keys
7. Monitor account activity daily

## 📞 Emergency Procedures

### If System Malfunctions

1. Press `Ctrl+C` to stop the engine
2. Log in to Schwab website
3. Manually close positions if needed
4. Review logs to identify issue

### If Unable to Stop

1. Kill the process: `pkill -f main.py`
2. Access Schwab website directly
3. Use mobile app as backup

### Position Management

Even with the system stopped, positions remain open. Manage them via:
- Schwab website
- Schwab mobile app
- Schwab customer service

---

**Remember**: This is a powerful tool that can make or lose money quickly. Always practice proper risk management and never trade more than you can afford to lose.

**Questions?** Review the code, check logs, and test thoroughly in paper mode before going live.

Happy Trading! 🚀
