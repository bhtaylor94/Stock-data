# Quick Start Guide

## 5-Minute Setup

### 1. Prerequisites Check

- [ ] Python 3.8+ installed
- [ ] Schwab brokerage account
- [ ] Schwab Developer account created
- [ ] Application created in developer portal
- [ ] API Key and Secret obtained

### 2. Installation

```bash
# Clone/download the project
cd schwab_trading_app

# Install dependencies
pip install -r requirements.txt

# Copy environment template
cp .env.example .env

# Edit .env with your credentials
nano .env  # or use your preferred editor
```

### 3. Configure .env

```bash
SCHWAB_APP_KEY=your_app_key_from_developer_portal
SCHWAB_APP_SECRET=your_app_secret_from_developer_portal
SCHWAB_ACCOUNT_NUMBER=your_account_number
SCHWAB_CALLBACK_URL=https://127.0.0.1:8182
```

### 4. Authenticate

```bash
python main.py --auth
```

Follow the prompts:
1. Copy the URL it gives you
2. Open in browser
3. Log in to Schwab
4. Approve access
5. Copy the full redirect URL back to terminal
6. Done! Tokens saved.

### 5. Start Paper Trading

```bash
python main.py --mode paper
```

The system will:
- ✓ Connect to Schwab API
- ✓ Start monitoring your watchlist
- ✓ Generate signals when conditions are met
- ✓ Execute paper trades (no real money)
- ✓ Track performance

### 6. Monitor Performance

In another terminal:
```bash
# Check current status
python main.py --status

# View logs
tail -f logs/trading.log
```

### 7. Stop Trading

Press `Ctrl+C` in the terminal running main.py

---

## What Happens Next?

### The First Hour
- System loads configuration
- Connects to Schwab API
- Starts monitoring symbols in watchlist
- Waits for trading signals

### When a Signal is Generated
1. Strategy detects opportunity (e.g., oversold RSI + uptrend)
2. Risk manager calculates position size
3. Stop loss and take profit calculated
4. Order placed (paper or live mode)
5. Position monitored continuously

### When to Exit
- Stop loss hit (protects capital)
- Take profit hit (locks in gains)
- Trailing stop activated (maximizes profits)
- Daily loss limit reached (risk protection)

---

## Common First-Time Questions

**Q: Why am I not seeing any trades?**
A: This is normal! The system waits for high-probability setups. Could take minutes to hours depending on market conditions. Check logs to see what's happening.

**Q: Can I customize the strategies?**
A: Yes! Edit `config/config.py` to adjust risk parameters, position sizes, and strategy settings.

**Q: How do I add more symbols to watch?**
A: Edit `config/config.py` and add symbols to `stream_symbols` list.

**Q: What if I want to trade options?**
A: The system supports options! See `strategies/options_strategies.py` for examples. Enable option strategies in config.

**Q: How long should I paper trade?**
A: Minimum 2 weeks recommended. Monitor:
- Win rate (target 55%+)
- Average profit per trade
- Max drawdown
- Daily P&L consistency

**Q: Is this profitable?**
A: Past performance ≠ future results. Success depends on:
- Market conditions
- Your risk management
- Strategy parameters
- Discipline in following the system

**Q: Can I run this 24/7?**
A: You can, but:
- Market is only open certain hours
- System respects market hours in config
- Use extended hours with caution
- Tokens auto-refresh while running

**Q: What if something goes wrong?**
A: 
1. Press Ctrl+C to stop
2. Check logs/trading.log
3. Log in to Schwab website
4. Manually manage positions if needed

---

## Next Steps

### After 1 Week of Paper Trading
- [ ] Review all trades in logs
- [ ] Calculate actual win rate
- [ ] Identify best-performing strategies
- [ ] Adjust risk parameters if needed

### After 2 Weeks of Paper Trading
- [ ] Verify daily loss limits work
- [ ] Check position sizing is appropriate
- [ ] Ensure stop losses are effective
- [ ] Confirm take profits are reasonable

### Before Going Live
- [ ] Win rate > 55%
- [ ] Positive total P&L in paper mode
- [ ] No major bugs or errors
- [ ] Comfortable with risk settings
- [ ] Understand all strategies being used
- [ ] Ready to accept losses

### Going Live
1. Start with MINIMAL capital (1-5% of total account)
2. Use CONSERVATIVE risk profile
3. Monitor VERY closely first week
4. Be ready to stop and adjust
5. Keep detailed records
6. Gradually increase capital only after proven success

---

## Emergency Contacts

**Schwab API Support**: traderapi@schwab.com

**Schwab Customer Service**: 1-800-435-4000

**System Logs**: `./logs/trading.log`

---

## Remember

✓ This is a tool, not a money printer
✓ Risk management is MORE important than strategy
✓ Paper trade until you're confident
✓ Start small when going live
✓ Never risk more than you can afford to lose
✓ Keep learning and adjusting

**Happy Trading!** 🚀
