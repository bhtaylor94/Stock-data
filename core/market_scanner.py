"""
Market Scanner for S&P 500 Stocks and ETFs
Dynamically scans and filters top candidates for trading
"""

import logging
from typing import List, Dict, Optional
from datetime import datetime
import time

logger = logging.getLogger(__name__)


class MarketScanner:
    """
    Scans S&P 500 stocks and ETFs to find best trading candidates
    """
    
    # Top S&P 500 stocks by market cap (updated periodically)
    SP500_TOP_100 = [
        # Mega Cap Tech
        'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA', 'AVGO', 'ORCL', 'ADBE',
        'CRM', 'AMD', 'CSCO', 'INTC', 'QCOM', 'TXN', 'AMAT', 'INTU', 'NFLX', 'PYPL',
        
        # Financials
        'BRK.B', 'JPM', 'V', 'MA', 'BAC', 'WFC', 'GS', 'MS', 'AXP', 'SPGI',
        'BLK', 'C', 'SCHW', 'CB', 'PGR', 'MMC', 'USB', 'TFC', 'PNC', 'AFL',
        
        # Healthcare
        'UNH', 'JNJ', 'LLY', 'ABBV', 'MRK', 'TMO', 'ABT', 'DHR', 'PFE', 'BMY',
        'AMGN', 'GILD', 'CVS', 'CI', 'REGN', 'VRTX', 'ZTS', 'ISRG', 'BSX', 'SYK',
        
        # Consumer
        'WMT', 'HD', 'PG', 'COST', 'KO', 'PEP', 'MCD', 'NKE', 'SBUX', 'TGT',
        'LOW', 'DIS', 'CMCSA', 'VZ', 'T', 'TMUS', 'PM', 'MO', 'EL', 'CL',
        
        # Industrials & Energy
        'XOM', 'CVX', 'CAT', 'RTX', 'UNP', 'HON', 'BA', 'UPS', 'GE', 'LMT',
        'DE', 'MMM', 'ADP', 'SLB', 'EOG', 'PXD', 'COP', 'WM', 'NSC', 'EMR',
    ]
    
    # Popular ETFs for trading
    ETFS = [
        # Major Index ETFs
        'SPY',   # S&P 500
        'QQQ',   # Nasdaq 100
        'IWM',   # Russell 2000
        'DIA',   # Dow Jones
        
        # Sector ETFs
        'XLF',   # Financials
        'XLK',   # Technology
        'XLE',   # Energy
        'XLV',   # Healthcare
        'XLY',   # Consumer Discretionary
        'XLP',   # Consumer Staples
        'XLI',   # Industrials
        'XLU',   # Utilities
        'XLB',   # Materials
        'XLRE',  # Real Estate
        'XLC',   # Communication Services
        
        # Volatility & Trading ETFs
        'VXX',   # Volatility
        'UVXY',  # 2x VIX
        'SQQQ',  # 3x Inverse Nasdaq
        'TQQQ',  # 3x Nasdaq
        'SPXL',  # 3x S&P 500
        'SPXS',  # 3x Inverse S&P 500
    ]
    
    def __init__(self, client, config):
        """
        Initialize market scanner
        
        Args:
            client: SchwabClient instance
            config: Configuration object
        """
        self.client = client
        self.config = config
        self.scan_config = config.data
        
        # Combine stocks and ETFs
        self.universe = self.SP500_TOP_100 + self.ETFS
        
        # Cache for scanned data
        self.scan_cache = {}
        self.last_scan_time = None
        self.scan_interval = 300  # Re-scan every 5 minutes
        
        logger.info(f"Market Scanner initialized with {len(self.universe)} symbols")
    
    def get_tradeable_symbols(self, max_symbols: int = 50) -> List[str]:
        """
        Get list of symbols that meet trading criteria
        
        Args:
            max_symbols: Maximum number of symbols to return
            
        Returns:
            List of tradeable symbol strings
        """
        # Check if we need to re-scan
        if self._should_rescan():
            self._scan_universe()
        
        # Get top candidates from cache
        candidates = self._rank_candidates()
        
        # Return top N
        top_symbols = [c['symbol'] for c in candidates[:max_symbols]]
        
        logger.info(f"Selected {len(top_symbols)} symbols for trading")
        return top_symbols
    
    def _should_rescan(self) -> bool:
        """Check if we should re-scan the market"""
        if not self.last_scan_time:
            return True
        
        elapsed = (datetime.now() - self.last_scan_time).total_seconds()
        return elapsed >= self.scan_interval
    
    def _scan_universe(self):
        """Scan the entire universe and cache results"""
        logger.info("Scanning market universe...")
        
        # Split into batches to respect rate limits
        batch_size = 20
        scanned = 0
        
        for i in range(0, len(self.universe), batch_size):
            batch = self.universe[i:i + batch_size]
            
            try:
                # Get quotes for batch
                quotes_data = self.client.get_quotes(batch)
                
                for symbol in batch:
                    quote_info = quotes_data.get(symbol, {})
                    quote = quote_info.get('quote', {})
                    
                    if not quote:
                        continue
                    
                    # Extract relevant data
                    self.scan_cache[symbol] = {
                        'symbol': symbol,
                        'price': quote.get('lastPrice', 0),
                        'volume': quote.get('totalVolume', 0),
                        'bid': quote.get('bidPrice', 0),
                        'ask': quote.get('askPrice', 0),
                        'change_pct': quote.get('netPercentChangeInDouble', 0),
                        'high': quote.get('highPrice', 0),
                        'low': quote.get('lowPrice', 0),
                        '52w_high': quote.get('52WkHigh', 0),
                        '52w_low': quote.get('52WkLow', 0),
                        'volatility': quote.get('volatility', 0),
                        'timestamp': datetime.now()
                    }
                    
                    scanned += 1
                
                # Brief pause between batches
                time.sleep(0.5)
                
            except Exception as e:
                logger.error(f"Error scanning batch {i}-{i+batch_size}: {e}")
                continue
        
        self.last_scan_time = datetime.now()
        logger.info(f"Scan complete: {scanned} symbols cached")
    
    def _rank_candidates(self) -> List[Dict]:
        """
        Rank candidates based on trading criteria
        
        Criteria:
        - Sufficient volume (liquidity)
        - Acceptable price range
        - Sufficient volatility (movement)
        - Tight bid-ask spread
        """
        candidates = []
        
        for symbol, data in self.scan_cache.items():
            # Apply filters
            if not self._passes_filters(data):
                continue
            
            # Calculate score
            score = self._calculate_score(data)
            
            candidates.append({
                'symbol': symbol,
                'score': score,
                'data': data
            })
        
        # Sort by score (highest first)
        candidates.sort(key=lambda x: x['score'], reverse=True)
        
        return candidates
    
    def _passes_filters(self, data: Dict) -> bool:
        """Check if symbol passes minimum filters"""
        
        # Price filter
        price = data.get('price', 0)
        if price < self.scan_config.min_price or price > self.scan_config.max_price:
            return False
        
        # Volume filter (minimum daily volume)
        volume = data.get('volume', 0)
        if volume < self.scan_config.min_volume:
            return False
        
        # Spread filter (max 0.5% spread)
        bid = data.get('bid', 0)
        ask = data.get('ask', 0)
        if bid > 0:
            spread_pct = (ask - bid) / bid
            if spread_pct > 0.005:  # 0.5% max spread
                return False
        
        return True
    
    def _calculate_score(self, data: Dict) -> float:
        """
        Calculate trading score for a symbol
        
        Higher score = better candidate
        
        Factors:
        - Volume (liquidity)
        - Volatility (opportunity)
        - Momentum (trending)
        - Spread (execution quality)
        """
        score = 0.0
        
        # Volume score (0-30 points)
        # Higher volume = better liquidity
        volume = data.get('volume', 0)
        if volume >= 10_000_000:
            score += 30
        elif volume >= 5_000_000:
            score += 25
        elif volume >= 1_000_000:
            score += 20
        elif volume >= 500_000:
            score += 15
        else:
            score += 10
        
        # Volatility score (0-25 points)
        # Intraday range as % of price
        high = data.get('high', 0)
        low = data.get('low', 0)
        price = data.get('price', 1)
        
        if high > 0 and low > 0:
            intraday_range = (high - low) / price
            
            if 0.02 <= intraday_range <= 0.08:  # 2-8% is ideal
                score += 25
            elif 0.01 <= intraday_range <= 0.10:  # 1-10% is good
                score += 20
            elif intraday_range < 0.01:  # Too little movement
                score += 5
            else:  # Too volatile (risky)
                score += 10
        
        # Momentum score (0-25 points)
        # Trending stocks get bonus
        change_pct = abs(data.get('change_pct', 0))
        
        if 0.5 <= change_pct <= 5.0:  # 0.5-5% move
            score += 25
        elif 0.2 <= change_pct <= 7.0:  # 0.2-7% move
            score += 20
        else:
            score += 10
        
        # Spread score (0-20 points)
        # Tighter spread = better execution
        bid = data.get('bid', 0)
        ask = data.get('ask', 0)
        
        if bid > 0:
            spread_pct = (ask - bid) / bid
            
            if spread_pct <= 0.001:  # 0.1% or less
                score += 20
            elif spread_pct <= 0.002:  # 0.2% or less
                score += 15
            elif spread_pct <= 0.005:  # 0.5% or less
                score += 10
            else:
                score += 5
        
        return score
    
    def get_symbol_info(self, symbol: str) -> Optional[Dict]:
        """Get cached info for a specific symbol"""
        return self.scan_cache.get(symbol)
    
    def get_top_movers(self, count: int = 10, direction: str = 'both') -> List[Dict]:
        """
        Get top movers by percentage change
        
        Args:
            count: Number of movers to return
            direction: 'up', 'down', or 'both'
        """
        movers = []
        
        for symbol, data in self.scan_cache.items():
            change_pct = data.get('change_pct', 0)
            
            if direction == 'up' and change_pct <= 0:
                continue
            elif direction == 'down' and change_pct >= 0:
                continue
            
            movers.append({
                'symbol': symbol,
                'change_pct': change_pct,
                'price': data.get('price', 0),
                'volume': data.get('volume', 0)
            })
        
        # Sort by absolute change
        movers.sort(key=lambda x: abs(x['change_pct']), reverse=True)
        
        return movers[:count]
    
    def get_high_volume_symbols(self, count: int = 20) -> List[str]:
        """Get symbols with highest volume"""
        volume_list = [
            (symbol, data.get('volume', 0))
            for symbol, data in self.scan_cache.items()
        ]
        
        volume_list.sort(key=lambda x: x[1], reverse=True)
        
        return [symbol for symbol, _ in volume_list[:count]]
    
    def filter_by_criteria(self, 
                          min_volume: Optional[int] = None,
                          min_price: Optional[float] = None,
                          max_price: Optional[float] = None,
                          min_change_pct: Optional[float] = None,
                          max_change_pct: Optional[float] = None) -> List[str]:
        """
        Filter symbols by custom criteria
        
        Returns:
            List of symbols matching criteria
        """
        filtered = []
        
        for symbol, data in self.scan_cache.items():
            # Volume filter
            if min_volume and data.get('volume', 0) < min_volume:
                continue
            
            # Price filters
            price = data.get('price', 0)
            if min_price and price < min_price:
                continue
            if max_price and price > max_price:
                continue
            
            # Change filters
            change = abs(data.get('change_pct', 0))
            if min_change_pct and change < min_change_pct:
                continue
            if max_change_pct and change > max_change_pct:
                continue
            
            filtered.append(symbol)
        
        return filtered
    
    def get_stats(self) -> Dict:
        """Get scanner statistics"""
        if not self.scan_cache:
            return {}
        
        volumes = [d.get('volume', 0) for d in self.scan_cache.values()]
        prices = [d.get('price', 0) for d in self.scan_cache.values()]
        changes = [d.get('change_pct', 0) for d in self.scan_cache.values()]
        
        return {
            'total_symbols': len(self.scan_cache),
            'last_scan': self.last_scan_time,
            'avg_volume': sum(volumes) / len(volumes) if volumes else 0,
            'avg_price': sum(prices) / len(prices) if prices else 0,
            'avg_change': sum(changes) / len(changes) if changes else 0,
            'max_change': max(changes) if changes else 0,
            'min_change': min(changes) if changes else 0,
        }
