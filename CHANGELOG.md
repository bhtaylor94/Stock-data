# Changelog

All notable changes to the Schwab Automated Trading System.

## [1.1.0] - 2026-01-20

### Added
- **Market Scanner** - Automatic scanning of top 100 S&P 500 stocks + ETFs
  - Dynamic symbol selection based on liquidity, volatility, and momentum
  - Intelligent filtering (volume, price range, bid-ask spread)
  - Scoring system (0-100 points) to rank best candidates
  - Re-scans market every 5 minutes
  - Configurable via `config.py`
  - See `MARKET_SCANNER.md` for full documentation

### Changed
- Default mode now uses Market Scanner instead of static watchlist
- Updated `config.py` with scanner configuration options
- Enhanced `main.py` status display to show scanner statistics
- Modified `trading_engine.py` to support both scanner and watchlist modes

### Features
- Scans 125+ symbols (top S&P 500 + popular ETFs)
- Filters for minimum volume (500k+), price range ($5-$1000), tight spreads
- Automatically selects top 50 symbols for active trading
- Provides utility methods: get_top_movers(), get_high_volume_symbols(), etc.
- Full statistics tracking and logging

## [1.0.0] - 2026-01-20

### Initial Release

#### Core Features
- OAuth2 authentication with Schwab API
- Automatic token refresh (every 25 minutes)
- Real-time market data integration
- Historical price data retrieval
- Options chain data support

#### Trading Strategies
- **Momentum Scalper** (Qscalper-inspired)
  - RSI-based entries
  - EMA trend confirmation
  - Volume filters
  - 2:1 risk/reward

- **Trend Follower** (Qzeus-inspired)
  - Multiple timeframe confirmation
  - EMA crossover entries
  - MACD confirmation
  - 4:1 risk/reward

- **Volatility Breakout** (Qkronos_EVO-inspired)
  - Bollinger Band breakouts
  - ATR-based targets
  - Volume confirmation
  - Dynamic exits

- **Options Scalper**
  - 0-7 DTE focus
  - Delta-based selection
  - IV percentile filtering
  - 25% profit / 50% stop targets

#### Risk Management
- Position sizing methods:
  - Fixed fractional
  - Kelly Criterion
  - Volatility-adjusted
- Stop loss types:
  - Static percentage
  - Dynamic ATR-based
  - Trailing stops
- Take profit strategies:
  - Static targets
  - Dynamic ATR-based
  - Tiered exits (partial profits)
- Portfolio controls:
  - Maximum position size limits
  - Total exposure limits
  - Daily loss limits (auto-stop)
  - Daily trade limits
  - Martingale option (optional)

#### Order Execution
- Market orders
- Limit orders
- Stop orders
- Stop-limit orders
- Bracket orders (entry + stop + target)
- Trailing stops
- Multi-leg option spreads

#### Trading Modes
- Paper trading (simulation)
- Live trading (real money)
- Backtesting framework (ready for implementation)

#### Monitoring & Logging
- Real-time position tracking
- Automatic stop loss management
- Trailing stop updates
- Risk limit enforcement
- Performance tracking
- Comprehensive logging
- Status command for quick overview

#### Configuration
- Environment variable support (.env)
- Risk profiles (Conservative/Moderate/Aggressive)
- Strategy selection and customization
- Watchlist configuration
- Market hours settings
- Rate limiting controls

#### Documentation
- Complete README.md
- Quick start guide (QUICKSTART.md)
- Project overview (PROJECT_OVERVIEW.md)
- Inline code documentation
- Configuration examples
- Emergency procedures

#### Safety Features
- Daily loss limits (auto-stop)
- Position size limits
- Exposure limits
- Rate limiting (respects Schwab API limits)
- Paper trading mode for testing
- Comprehensive error handling
- Secure token storage
- Graceful shutdown (Ctrl+C)

---

## Roadmap

### Future Features
- [ ] Web dashboard for monitoring
- [ ] Mobile notifications (SMS/push)
- [ ] Advanced backtesting engine
- [ ] Machine learning signal enhancement
- [ ] Multi-account support
- [ ] Portfolio optimization
- [ ] Custom indicator builder
- [ ] Alert system for manual review
- [ ] Strategy performance analytics
- [ ] Auto-optimization of parameters
- [ ] Integration with TradingView charts
- [ ] Discord/Slack bot integration
- [ ] Cloud deployment templates (AWS/GCP)
- [ ] Database storage for trades
- [ ] Tax reporting export
- [ ] Broker comparison tools

### Planned Improvements
- [ ] Additional strategy templates
- [ ] Enhanced options strategies (spreads, iron condors)
- [ ] Volatility regime detection
- [ ] Market regime classification
- [ ] Correlation analysis
- [ ] Portfolio rebalancing
- [ ] Risk parity position sizing
- [ ] Sector rotation strategy
- [ ] Pairs trading
- [ ] Mean reversion strategies

---

## Version History

- **v1.1.0** - Added Market Scanner (2026-01-20)
- **v1.0.0** - Initial Release (2026-01-20)
