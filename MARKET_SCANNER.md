# Market Scanner Feature

## Overview

The Market Scanner automatically analyzes the **top 100 S&P 500 stocks** and **25+ popular ETFs** to identify the best trading opportunities in real-time.

Instead of watching a static list, the scanner dynamically:
- Ranks symbols by liquidity, volatility, and momentum
- Filters out low-quality candidates
- Focuses on the top 50 most tradeable symbols
- Re-scans every 5 minutes

## How It Works

### 1. Universe Coverage

**S&P 500 Stocks (Top 100 by Market Cap)**
- Technology: AAPL, MSFT, GOOGL, NVDA, META, etc.
- Financials: JPM, V, MA, BAC, WFC, etc.
- Healthcare: UNH, JNJ, LLY, ABBV, etc.
- Consumer: WMT, HD, PG, COST, etc.
- Industrials & Energy: XOM, CVX, CAT, etc.

**Popular ETFs (25+)**
- Index: SPY, QQQ, IWM, DIA
- Sector: XLF, XLK, XLE, XLV, XLY, etc.
- Volatility: VXX, UVXY
- Leveraged: TQQQ, SQQQ, SPXL, SPXS

### 2. Filtering Criteria

The scanner applies these filters:

**Volume Filter**
- Minimum: 500,000 shares/day
- Ensures sufficient liquidity

**Price Filter**
- Minimum: $5.00
- Maximum: $1,000.00
- Avoids penny stocks and overly expensive stocks

**Spread Filter**
- Maximum: 0.5% bid-ask spread
- Ensures good execution quality

### 3. Scoring System (0-100 points)

Each symbol is scored on:

**Volume Score (0-30 points)**
- 10M+ volume: 30 points
- 5M+ volume: 25 points
- 1M+ volume: 20 points

**Volatility Score (0-25 points)**
- Ideal: 2-8% intraday range
- Too tight or too wide gets penalized

**Momentum Score (0-25 points)**
- Sweet spot: 0.5-5% daily change
- Trending = bonus points

**Spread Score (0-20 points)**
- Tighter spread = more points
- 0.1% or less: 20 points

### 4. Symbol Selection

The top 50 highest-scoring symbols are selected for trading.

These are the symbols your strategies will analyze for entry signals.

## Configuration

### Enable/Disable Scanner

In `config/config.py`:

```python
@dataclass
class DataConfig:
    # Enable dynamic scanner (default: True)
    use_market_scanner: bool = True
    
    # Or use static watchlist
    use_market_scanner: bool = False
    stream_symbols: List[str] = ['SPY', 'AAPL', 'MSFT', ...]
```

### Adjust Scanner Settings

```python
@dataclass
class DataConfig:
    # Max symbols to actively monitor
    max_scan_symbols: int = 50  # Increase for more coverage
    
    # Re-scan interval (seconds)
    scanner_update_interval: int = 300  # 5 minutes
    
    # Filters
    min_volume: int = 500000  # Minimum daily volume
    min_price: float = 5.0
    max_price: float = 1000.0
```

## Viewing Scanner Stats

Check scanner performance:

```bash
python main.py --status
```

Output includes:
```
MARKET SCANNER:
  Symbols Scanned: 125
  Last Scan: 2026-01-20 14:35:22
  Avg Volume: 8,234,567
  Avg Price: $142.35
  Avg Change: +0.78%
```

## Advantages vs Static Watchlist

### Dynamic Scanner
✅ Always trading the most liquid stocks  
✅ Adapts to market conditions  
✅ Catches new opportunities automatically  
✅ Focuses on best setups  
✅ No manual updates needed  

### Static Watchlist
❌ Can miss opportunities  
❌ Requires manual updates  
❌ May include dead periods  
❌ Fixed universe  

## Performance Tips

### For More Opportunities
```python
max_scan_symbols: int = 75  # Monitor more symbols
min_volume: int = 250000     # Lower volume threshold
```

### For Higher Quality Only
```python
max_scan_symbols: int = 25   # Top 25 only
min_volume: int = 1000000    # 1M+ volume required
```

### For Specific Markets
```python
# Focus on tech stocks
# Modify market_scanner.py SP500_TOP_100 list
# Keep only: AAPL, MSFT, GOOGL, NVDA, AMD, etc.
```

## Scanner Methods

The scanner provides several utility methods:

```python
# Get top movers
top_gainers = scanner.get_top_movers(count=10, direction='up')
top_losers = scanner.get_top_movers(count=10, direction='down')

# Get high volume symbols
active = scanner.get_high_volume_symbols(count=20)

# Custom filters
volatile_stocks = scanner.filter_by_criteria(
    min_change_pct=2.0,  # 2%+ move today
    min_volume=1000000   # 1M+ volume
)
```

## Logs

Scanner activity appears in logs:

```
2026-01-20 14:30:00 - MarketScanner - INFO - Scanning market universe...
2026-01-20 14:30:15 - MarketScanner - INFO - Scan complete: 125 symbols cached
2026-01-20 14:30:16 - MarketScanner - INFO - Selected 50 symbols for trading
```

## FAQ

**Q: How often does it scan?**  
A: Every 5 minutes by default (configurable)

**Q: Does it use extra API calls?**  
A: Yes, but it batches requests and respects rate limits

**Q: Can I customize the universe?**  
A: Yes! Edit `SP500_TOP_100` and `ETFS` lists in `core/market_scanner.py`

**Q: Will it trade penny stocks?**  
A: No, minimum $5 price filter prevents this

**Q: Does it scan after hours?**  
A: Yes, but only executes during market hours (unless configured otherwise)

**Q: Can I see what it's scanning in real-time?**  
A: Yes, check logs or use `scanner.get_stats()` in code

## Technical Details

### Scan Process
1. Request quotes for all symbols (batched)
2. Cache data with timestamp
3. Apply filters (volume, price, spread)
4. Calculate scores for each symbol
5. Rank by score (highest first)
6. Return top N symbols

### Rate Limiting
- Batches 20 symbols per request
- 0.5 second pause between batches
- ~6 requests for full scan
- Well within Schwab's 120/min limit

### Caching
- Data cached for 5 minutes
- Prevents redundant API calls
- Ensures fresh data for strategies

---

**The Market Scanner is ON by default. It will automatically find the best trading opportunities from the top S&P 500 stocks!** 🎯
