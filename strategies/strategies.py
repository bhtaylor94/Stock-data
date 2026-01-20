"""
Trading Strategies - QuantVue Inspired
Base strategy class and specific implementations
"""

import logging
from abc import ABC, abstractmethod
from typing import Dict, Optional, List, Tuple
from dataclasses import dataclass
from datetime import datetime
import pandas as pd
import numpy as np

logger = logging.getLogger(__name__)


@dataclass
class Signal:
    """Trading signal"""
    symbol: str
    direction: str  # "LONG" or "SHORT"
    strength: float  # 0-1
    entry_price: float
    stop_loss: float
    take_profit: float
    strategy_name: str
    timestamp: datetime
    metadata: Dict = None


@dataclass
class TechnicalIndicators:
    """Container for technical indicators"""
    symbol: str
    close: float
    volume: int
    
    # Moving averages
    ema8: Optional[float] = None
    ema21: Optional[float] = None
    ema50: Optional[float] = None
    ema200: Optional[float] = None
    
    # Volatility
    atr: Optional[float] = None
    bollinger_upper: Optional[float] = None
    bollinger_lower: Optional[float] = None
    
    # Momentum
    rsi: Optional[float] = None
    macd: Optional[float] = None
    macd_signal: Optional[float] = None
    
    # Volume
    volume_sma: Optional[float] = None
    volume_ratio: Optional[float] = None


class BaseStrategy(ABC):
    """Base class for all trading strategies"""
    
    def __init__(self, name: str, config, risk_manager):
        self.name = name
        self.config = config
        self.risk_manager = risk_manager
        self.strategy_config = config.strategy
        
        # Performance tracking
        self.total_signals = 0
        self.total_trades = 0
        self.winning_trades = 0
        self.losing_trades = 0
        self.total_pnl = 0.0
        
        logger.info(f"Strategy '{name}' initialized")
    
    @abstractmethod
    def analyze(self, symbol: str, market_data: Dict, 
                indicators: TechnicalIndicators) -> Optional[Signal]:
        """
        Analyze market data and generate signal
        
        Args:
            symbol: Trading symbol
            market_data: Market data dictionary
            indicators: Calculated technical indicators
            
        Returns:
            Signal object if conditions met, None otherwise
        """
        pass
    
    def calculate_indicators(self, df: pd.DataFrame) -> TechnicalIndicators:
        """Calculate technical indicators from price data"""
        if df.empty:
            return None
        
        close = df['close'].iloc[-1]
        volume = df['volume'].iloc[-1]
        
        indicators = TechnicalIndicators(
            symbol=df.get('symbol', 'UNKNOWN'),
            close=close,
            volume=volume
        )
        
        # EMAs
        if len(df) >= 8:
            indicators.ema8 = df['close'].ewm(span=8, adjust=False).mean().iloc[-1]
        if len(df) >= 21:
            indicators.ema21 = df['close'].ewm(span=21, adjust=False).mean().iloc[-1]
        if len(df) >= 50:
            indicators.ema50 = df['close'].ewm(span=50, adjust=False).mean().iloc[-1]
        if len(df) >= 200:
            indicators.ema200 = df['close'].ewm(span=200, adjust=False).mean().iloc[-1]
        
        # ATR
        if len(df) >= 14:
            high_low = df['high'] - df['low']
            high_close = abs(df['high'] - df['close'].shift())
            low_close = abs(df['low'] - df['close'].shift())
            
            true_range = pd.concat([high_low, high_close, low_close], axis=1).max(axis=1)
            indicators.atr = true_range.rolling(window=14).mean().iloc[-1]
        
        # RSI
        if len(df) >= 14:
            delta = df['close'].diff()
            gain = (delta.where(delta > 0, 0)).rolling(window=14).mean()
            loss = (-delta.where(delta < 0, 0)).rolling(window=14).mean()
            rs = gain / loss
            indicators.rsi = 100 - (100 / (1 + rs.iloc[-1]))
        
        # Bollinger Bands
        if len(df) >= 20:
            sma20 = df['close'].rolling(window=20).mean()
            std20 = df['close'].rolling(window=20).std()
            indicators.bollinger_upper = (sma20 + 2 * std20).iloc[-1]
            indicators.bollinger_lower = (sma20 - 2 * std20).iloc[-1]
        
        # Volume
        if len(df) >= 20:
            indicators.volume_sma = df['volume'].rolling(window=20).mean().iloc[-1]
            if indicators.volume_sma > 0:
                indicators.volume_ratio = volume / indicators.volume_sma
        
        # MACD
        if len(df) >= 26:
            ema12 = df['close'].ewm(span=12, adjust=False).mean()
            ema26 = df['close'].ewm(span=26, adjust=False).mean()
            indicators.macd = (ema12 - ema26).iloc[-1]
            
            if len(df) >= 35:
                macd_line = ema12 - ema26
                indicators.macd_signal = macd_line.ewm(span=9, adjust=False).mean().iloc[-1]
        
        return indicators
    
    def record_trade_result(self, pnl: float):
        """Record trade result for performance tracking"""
        self.total_trades += 1
        self.total_pnl += pnl
        
        if pnl > 0:
            self.winning_trades += 1
        else:
            self.losing_trades += 1
    
    def get_win_rate(self) -> float:
        """Get strategy win rate"""
        if self.total_trades == 0:
            return 0.0
        return self.winning_trades / self.total_trades
    
    def get_stats(self) -> Dict:
        """Get strategy statistics"""
        return {
            'name': self.name,
            'total_signals': self.total_signals,
            'total_trades': self.total_trades,
            'winning_trades': self.winning_trades,
            'losing_trades': self.losing_trades,
            'win_rate': self.get_win_rate(),
            'total_pnl': self.total_pnl,
            'avg_pnl_per_trade': self.total_pnl / self.total_trades if self.total_trades > 0 else 0
        }


class MomentumScalper(BaseStrategy):
    """
    Momentum Scalping Strategy (Similar to QuantVue's Qscalper)
    
    - Short-term momentum entries
    - Quick profits (scalping)
    - Volume confirmation
    - Dynamic exits based on volatility
    """
    
    def __init__(self, config, risk_manager):
        super().__init__("MomentumScalper", config, risk_manager)
        self.min_rsi = 30
        self.max_rsi = 70
        self.min_volume_ratio = 1.5  # 1.5x average volume
    
    def analyze(self, symbol: str, market_data: Dict, 
                indicators: TechnicalIndicators) -> Optional[Signal]:
        """Analyze for momentum scalping opportunities"""
        
        if not indicators or not indicators.rsi or not indicators.atr:
            return None
        
        # Volume filter
        if indicators.volume_ratio and indicators.volume_ratio < self.min_volume_ratio:
            return None
        
        # Momentum conditions
        is_oversold = indicators.rsi < self.min_rsi
        is_overbought = indicators.rsi > self.max_rsi
        
        # Trend filter using EMAs
        if not indicators.ema8 or not indicators.ema21:
            return None
        
        bullish_trend = indicators.ema8 > indicators.ema21
        bearish_trend = indicators.ema8 < indicators.ema21
        
        signal = None
        
        # Long signal: Oversold + bullish short-term trend
        if is_oversold and bullish_trend:
            # Calculate levels using ATR
            stop_loss = indicators.close - (indicators.atr * 1.5)
            take_profit = indicators.close + (indicators.atr * 3.0)  # 1:2 R:R
            
            signal = Signal(
                symbol=symbol,
                direction="LONG",
                strength=min(1.0, (self.max_rsi - indicators.rsi) / (self.max_rsi - self.min_rsi)),
                entry_price=indicators.close,
                stop_loss=stop_loss,
                take_profit=take_profit,
                strategy_name=self.name,
                timestamp=datetime.now(),
                metadata={
                    'rsi': indicators.rsi,
                    'volume_ratio': indicators.volume_ratio,
                    'atr': indicators.atr
                }
            )
        
        # Short signal: Overbought + bearish short-term trend
        elif is_overbought and bearish_trend:
            stop_loss = indicators.close + (indicators.atr * 1.5)
            take_profit = indicators.close - (indicators.atr * 3.0)
            
            signal = Signal(
                symbol=symbol,
                direction="SHORT",
                strength=min(1.0, (indicators.rsi - self.min_rsi) / (self.max_rsi - self.min_rsi)),
                entry_price=indicators.close,
                stop_loss=stop_loss,
                take_profit=take_profit,
                strategy_name=self.name,
                timestamp=datetime.now(),
                metadata={
                    'rsi': indicators.rsi,
                    'volume_ratio': indicators.volume_ratio,
                    'atr': indicators.atr
                }
            )
        
        if signal:
            self.total_signals += 1
            logger.info(f"{self.name} signal generated for {symbol}: {signal.direction}")
        
        return signal


class TrendFollower(BaseStrategy):
    """
    Trend Following Strategy (Similar to QuantVue's Qzeus)
    
    - Follows established trends
    - Multiple timeframe confirmation
    - Uses EMAs and MACD
    - Longer hold times than scalper
    """
    
    def __init__(self, config, risk_manager):
        super().__init__("TrendFollower", config, risk_manager)
        self.min_trend_strength = config.strategy.trend_follower_min_trend_strength
    
    def analyze(self, symbol: str, market_data: Dict,
                indicators: TechnicalIndicators) -> Optional[Signal]:
        """Analyze for trend following opportunities"""
        
        if not indicators or not indicators.ema8 or not indicators.ema21 or not indicators.ema50:
            return None
        
        if not indicators.macd or not indicators.macd_signal or not indicators.atr:
            return None
        
        # Trend identification
        strong_uptrend = (
            indicators.ema8 > indicators.ema21 > indicators.ema50 and
            indicators.close > indicators.ema8
        )
        
        strong_downtrend = (
            indicators.ema8 < indicators.ema21 < indicators.ema50 and
            indicators.close < indicators.ema8
        )
        
        # MACD confirmation
        macd_bullish = indicators.macd > indicators.macd_signal
        macd_bearish = indicators.macd < indicators.macd_signal
        
        signal = None
        
        # Long signal
        if strong_uptrend and macd_bullish:
            # Use EMA21 as support for stop
            stop_loss = indicators.ema21 * 0.98  # 2% below EMA21
            # Target based on ATR
            take_profit = indicators.close + (indicators.atr * 4.0)
            
            # Calculate trend strength
            ema_spread = (indicators.ema8 - indicators.ema50) / indicators.ema50
            strength = min(1.0, abs(ema_spread) / 0.05)  # Normalize to 0-1
            
            signal = Signal(
                symbol=symbol,
                direction="LONG",
                strength=strength,
                entry_price=indicators.close,
                stop_loss=stop_loss,
                take_profit=take_profit,
                strategy_name=self.name,
                timestamp=datetime.now(),
                metadata={
                    'ema8': indicators.ema8,
                    'ema21': indicators.ema21,
                    'ema50': indicators.ema50,
                    'macd': indicators.macd,
                    'trend_strength': strength
                }
            )
        
        # Short signal
        elif strong_downtrend and macd_bearish:
            stop_loss = indicators.ema21 * 1.02  # 2% above EMA21
            take_profit = indicators.close - (indicators.atr * 4.0)
            
            ema_spread = (indicators.ema50 - indicators.ema8) / indicators.ema50
            strength = min(1.0, abs(ema_spread) / 0.05)
            
            signal = Signal(
                symbol=symbol,
                direction="SHORT",
                strength=strength,
                entry_price=indicators.close,
                stop_loss=stop_loss,
                take_profit=take_profit,
                strategy_name=self.name,
                timestamp=datetime.now(),
                metadata={
                    'ema8': indicators.ema8,
                    'ema21': indicators.ema21,
                    'ema50': indicators.ema50,
                    'macd': indicators.macd,
                    'trend_strength': strength
                }
            )
        
        if signal and signal.strength >= self.min_trend_strength:
            self.total_signals += 1
            logger.info(f"{self.name} signal generated for {symbol}: {signal.direction} (strength: {signal.strength:.2f})")
            return signal
        
        return None


class VolatilityBreakout(BaseStrategy):
    """
    Volatility Breakout Strategy (Similar to QuantVue's Qkronos_EVO)
    
    - Trades volatility expansions
    - Bollinger Band breakouts
    - ATR-based position sizing
    - Dynamic profit targets
    """
    
    def __init__(self, config, risk_manager):
        super().__init__("VolatilityBreakout", config, risk_manager)
        self.breakout_multiplier = config.strategy.volatility_breakout_multiplier
    
    def analyze(self, symbol: str, market_data: Dict,
                indicators: TechnicalIndicators) -> Optional[Signal]:
        """Analyze for volatility breakout opportunities"""
        
        if not indicators or not indicators.bollinger_upper or not indicators.bollinger_lower:
            return None
        
        if not indicators.atr or not indicators.volume_ratio:
            return None
        
        # Volume confirmation
        if indicators.volume_ratio < 1.5:
            return None
        
        close = indicators.close
        bb_upper = indicators.bollinger_upper
        bb_lower = indicators.bollinger_lower
        bb_mid = (bb_upper + bb_lower) / 2
        
        signal = None
        
        # Breakout above upper band
        if close > bb_upper:
            # Momentum breakout - go long
            stop_loss = bb_mid
            take_profit = close + (indicators.atr * self.breakout_multiplier)
            
            # Calculate breakout strength
            breakout_distance = (close - bb_upper) / bb_upper
            strength = min(1.0, breakout_distance / 0.02)  # 2% breakout = max strength
            
            signal = Signal(
                symbol=symbol,
                direction="LONG",
                strength=strength,
                entry_price=close,
                stop_loss=stop_loss,
                take_profit=take_profit,
                strategy_name=self.name,
                timestamp=datetime.now(),
                metadata={
                    'bollinger_upper': bb_upper,
                    'bollinger_lower': bb_lower,
                    'atr': indicators.atr,
                    'volume_ratio': indicators.volume_ratio
                }
            )
        
        # Breakout below lower band
        elif close < bb_lower:
            stop_loss = bb_mid
            take_profit = close - (indicators.atr * self.breakout_multiplier)
            
            breakout_distance = (bb_lower - close) / bb_lower
            strength = min(1.0, breakout_distance / 0.02)
            
            signal = Signal(
                symbol=symbol,
                direction="SHORT",
                strength=strength,
                entry_price=close,
                stop_loss=stop_loss,
                take_profit=take_profit,
                strategy_name=self.name,
                timestamp=datetime.now(),
                metadata={
                    'bollinger_upper': bb_upper,
                    'bollinger_lower': bb_lower,
                    'atr': indicators.atr,
                    'volume_ratio': indicators.volume_ratio
                }
            )
        
        if signal:
            self.total_signals += 1
            logger.info(f"{self.name} signal generated for {symbol}: {signal.direction}")
        
        return signal
