"""
Options Trading Strategies
Specialized strategies for options trading on Schwab
"""

import logging
from typing import Dict, Optional, List
from datetime import datetime, timedelta
from strategies.strategies import BaseStrategy, Signal, TechnicalIndicators

logger = logging.getLogger(__name__)


class OptionsScalper(BaseStrategy):
    """
    Options scalping strategy for short-term directional trades
    
    Features:
    - Focuses on 0-7 DTE options for high gamma
    - Targets 30-70 delta range for liquidity
    - Uses IV percentile filtering
    - Quick exits (target 20-30% profit)
    """
    
    def __init__(self, config, risk_manager):
        super().__init__("OptionsScalper", config, risk_manager)
        self.min_dte = config.strategy.option_min_dte
        self.max_dte = config.strategy.option_max_dte
        self.delta_range = config.strategy.option_delta_range
        self.max_iv_percentile = config.strategy.option_max_iv_percentile
        
        # Options-specific parameters
        self.target_profit_pct = 0.25  # 25% profit target
        self.stop_loss_pct = 0.50  # 50% stop loss
    
    def analyze(self, symbol: str, market_data: Dict,
                indicators: TechnicalIndicators) -> Optional[Signal]:
        """
        Analyze for options scalping opportunities
        
        Note: This requires option chain data from market_data
        """
        if not indicators or not indicators.rsi or not indicators.ema8:
            return None
        
        # Get option chain from market_data
        option_chain = market_data.get('option_chain')
        if not option_chain:
            logger.debug(f"No option chain data for {symbol}")
            return None
        
        # Determine direction based on technicals
        bullish_signal = (
            indicators.rsi < 40 and
            indicators.ema8 > indicators.ema21 and
            indicators.volume_ratio and indicators.volume_ratio > 1.5
        )
        
        bearish_signal = (
            indicators.rsi > 60 and
            indicators.ema8 < indicators.ema21 and
            indicators.volume_ratio and indicators.volume_ratio > 1.5
        )
        
        if bullish_signal:
            # Find suitable call option
            option = self._find_suitable_option(
                option_chain, 'CALL', indicators.close
            )
            
            if option:
                return self._create_option_signal(
                    symbol, option, 'LONG', indicators
                )
        
        elif bearish_signal:
            # Find suitable put option
            option = self._find_suitable_option(
                option_chain, 'PUT', indicators.close
            )
            
            if option:
                return self._create_option_signal(
                    symbol, option, 'SHORT', indicators
                )
        
        return None
    
    def _find_suitable_option(self, option_chain: Dict, 
                             option_type: str,
                             current_price: float) -> Optional[Dict]:
        """
        Find a suitable option contract
        
        Criteria:
        - DTE within range
        - Delta within range
        - Sufficient liquidity (volume > 10, open interest > 100)
        - IV percentile not excessive
        """
        contracts = option_chain.get(option_type.lower() + 'ExpDateMap', {})
        
        suitable_options = []
        
        for expiration, strikes in contracts.items():
            # Calculate DTE
            exp_date = datetime.strptime(expiration.split(':')[0], '%Y-%m-%d')
            dte = (exp_date - datetime.now()).days
            
            if dte < self.min_dte or dte > self.max_dte:
                continue
            
            for strike, contracts_list in strikes.items():
                for contract in contracts_list:
                    # Check delta
                    delta = abs(contract.get('delta', 0))
                    if delta < self.delta_range[0] or delta > self.delta_range[1]:
                        continue
                    
                    # Check liquidity
                    volume = contract.get('totalVolume', 0)
                    open_interest = contract.get('openInterest', 0)
                    if volume < 10 or open_interest < 100:
                        continue
                    
                    # Check IV percentile (if available)
                    iv_percentile = contract.get('theoreticalOptionValue', 0)
                    if iv_percentile > self.max_iv_percentile:
                        continue
                    
                    suitable_options.append({
                        'symbol': contract.get('symbol'),
                        'strike': float(strike),
                        'expiration': expiration,
                        'dte': dte,
                        'delta': delta,
                        'bid': contract.get('bid', 0),
                        'ask': contract.get('ask', 0),
                        'mark': contract.get('mark', 0),
                        'volume': volume,
                        'open_interest': open_interest,
                        'iv': contract.get('volatility', 0)
                    })
        
        # Return option closest to target delta (0.50)
        if suitable_options:
            suitable_options.sort(key=lambda x: abs(x['delta'] - 0.50))
            return suitable_options[0]
        
        return None
    
    def _create_option_signal(self, underlying: str, option: Dict,
                             direction: str, indicators: TechnicalIndicators) -> Signal:
        """Create trading signal for option"""
        entry_price = option['mark']
        
        # Calculate stop and target based on percentages
        stop_loss = entry_price * (1 - self.stop_loss_pct)
        take_profit = entry_price * (1 + self.target_profit_pct)
        
        signal = Signal(
            symbol=option['symbol'],  # Full option symbol
            direction=direction,
            strength=0.7,  # Options have inherent risk, moderate strength
            entry_price=entry_price,
            stop_loss=stop_loss,
            take_profit=take_profit,
            strategy_name=self.name,
            timestamp=datetime.now(),
            metadata={
                'underlying': underlying,
                'strike': option['strike'],
                'expiration': option['expiration'],
                'dte': option['dte'],
                'delta': option['delta'],
                'iv': option['iv'],
                'bid_ask_spread': option['ask'] - option['bid'],
                'volume': option['volume'],
                'open_interest': option['open_interest']
            }
        )
        
        self.total_signals += 1
        logger.info(
            f"{self.name} signal: {direction} {underlying} "
            f"{option['strike']} {option['expiration'][:10]} "
            f"(DTE: {option['dte']}, Delta: {option['delta']:.2f})"
        )
        
        return signal


class CreditSpread(BaseStrategy):
    """
    Credit spread strategy for options
    
    Sells vertical spreads to collect premium:
    - Bull put spreads in uptrends
    - Bear call spreads in downtrends
    - Targets 30-45 DTE
    - Collects 1/3 of max profit at entry
    """
    
    def __init__(self, config, risk_manager):
        super().__init__("CreditSpread", config, risk_manager)
        self.target_dte_min = 30
        self.target_dte_max = 45
        self.target_credit_pct = 0.33  # 33% of spread width
        self.target_delta_short = 0.30  # Sell 30 delta
        self.spread_width = 5  # $5 wide spreads
    
    def analyze(self, symbol: str, market_data: Dict,
                indicators: TechnicalIndicators) -> Optional[Signal]:
        """
        Analyze for credit spread opportunities
        
        Requires option chain data
        """
        if not indicators:
            return None
        
        option_chain = market_data.get('option_chain')
        if not option_chain:
            return None
        
        # Determine market direction
        bullish = (
            indicators.ema8 and indicators.ema21 and
            indicators.ema8 > indicators.ema21 and
            indicators.rsi and indicators.rsi < 60
        )
        
        bearish = (
            indicators.ema8 and indicators.ema21 and
            indicators.ema8 < indicators.ema21 and
            indicators.rsi and indicators.rsi > 40
        )
        
        if bullish:
            # Look for bull put spread
            spread = self._find_put_spread(option_chain, indicators.close)
            if spread:
                return self._create_spread_signal(
                    symbol, spread, 'BULL_PUT', indicators
                )
        
        elif bearish:
            # Look for bear call spread
            spread = self._find_call_spread(option_chain, indicators.close)
            if spread:
                return self._create_spread_signal(
                    symbol, spread, 'BEAR_CALL', indicators
                )
        
        return None
    
    def _find_put_spread(self, option_chain: Dict, 
                        current_price: float) -> Optional[Dict]:
        """Find suitable bull put spread"""
        # Implementation would find:
        # 1. Short put around 30 delta
        # 2. Long put $5 below
        # 3. Credit = ~33% of spread width
        # Placeholder for brevity
        return None
    
    def _find_call_spread(self, option_chain: Dict,
                         current_price: float) -> Optional[Dict]:
        """Find suitable bear call spread"""
        # Implementation would find:
        # 1. Short call around 30 delta
        # 2. Long call $5 above
        # 3. Credit = ~33% of spread width
        # Placeholder for brevity
        return None
    
    def _create_spread_signal(self, underlying: str, spread: Dict,
                             spread_type: str, indicators: TechnicalIndicators) -> Signal:
        """Create signal for credit spread"""
        # Placeholder implementation
        return None


class IronCondor(BaseStrategy):
    """
    Iron Condor strategy for range-bound markets
    
    Features:
    - Sells both call and put spreads
    - Profits from time decay and low volatility
    - Targets 30-45 DTE
    - Delta range: 0.15-0.25 for short strikes
    - Manages at 50% profit or 21 DTE
    """
    
    def __init__(self, config, risk_manager):
        super().__init__("IronCondor", config, risk_manager)
        self.target_dte_min = 30
        self.target_dte_max = 45
        self.short_delta_target = 0.20
        self.wing_width = 5
        self.exit_profit_pct = 0.50
        self.exit_dte = 21
    
    def analyze(self, symbol: str, market_data: Dict,
                indicators: TechnicalIndicators) -> Optional[Signal]:
        """
        Analyze for iron condor opportunities
        
        Conditions:
        - Low volatility environment
        - Range-bound price action
        - Sufficient credit collected
        """
        if not indicators or not indicators.bollinger_upper:
            return None
        
        # Check for range-bound conditions
        bb_width = (indicators.bollinger_upper - indicators.bollinger_lower) / indicators.close
        
        # Want narrow Bollinger Bands (low volatility)
        if bb_width > 0.08:  # 8% bandwidth
            return None
        
        # Check RSI is neutral
        if not indicators.rsi or indicators.rsi < 40 or indicators.rsi > 60:
            return None
        
        option_chain = market_data.get('option_chain')
        if not option_chain:
            return None
        
        # Find suitable iron condor
        ic = self._find_iron_condor(option_chain, indicators.close)
        
        if ic:
            return self._create_ic_signal(symbol, ic, indicators)
        
        return None
    
    def _find_iron_condor(self, option_chain: Dict,
                         current_price: float) -> Optional[Dict]:
        """Find suitable iron condor strikes"""
        # Would find:
        # 1. Short put at 20 delta below
        # 2. Long put $5 below short put
        # 3. Short call at 20 delta above
        # 4. Long call $5 above short call
        # Placeholder for brevity
        return None
    
    def _create_ic_signal(self, underlying: str, ic: Dict,
                         indicators: TechnicalIndicators) -> Signal:
        """Create iron condor signal"""
        # Placeholder implementation
        return None
