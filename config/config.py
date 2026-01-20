"""
Configuration file for Schwab Automated Trading System
Based on QuantVue's automated trading methodology
"""

import os
from dataclasses import dataclass
from typing import Dict, List, Optional
from enum import Enum


class TradingMode(Enum):
    """Trading modes"""
    PAPER = "paper"
    LIVE = "live"
    BACKTEST = "backtest"


class StrategyType(Enum):
    """Available strategy types (based on QuantVue methodology)"""
    MOMENTUM_SCALPER = "momentum_scalper"  # Similar to Qscalper
    TREND_FOLLOWER = "trend_follower"  # Similar to Qzeus
    RANGE_TRADER = "range_trader"  # Similar to Qkronos
    VOLATILITY_BREAKOUT = "volatility_breakout"  # Similar to Qkronos_EVO
    OPTION_SCALPER = "option_scalper"  # Options-specific


class RiskProfile(Enum):
    """Risk management profiles"""
    CONSERVATIVE = "conservative"
    MODERATE = "moderate"
    AGGRESSIVE = "aggressive"


@dataclass
class SchwabCredentials:
    """Schwab API credentials"""
    app_key: str = os.getenv('SCHWAB_APP_KEY', '')
    app_secret: str = os.getenv('SCHWAB_APP_SECRET', '')
    callback_url: str = os.getenv('SCHWAB_CALLBACK_URL', 'https://127.0.0.1:8182')
    token_path: str = os.getenv('SCHWAB_TOKEN_PATH', './data/token.json')
    account_number: str = os.getenv('SCHWAB_ACCOUNT_NUMBER', '')


@dataclass
class GeneralConfig:
    """General application configuration"""
    trading_mode: TradingMode = TradingMode.PAPER
    log_level: str = "INFO"
    log_file: str = "./logs/trading.log"
    data_directory: str = "./data"
    max_concurrent_orders: int = 5
    
    # Schwab API rate limits
    max_requests_per_minute: int = 120
    max_order_requests_per_second: int = 2
    
    # Market hours (Eastern Time)
    market_open_hour: int = 9
    market_open_minute: int = 30
    market_close_hour: int = 16
    market_close_minute: int = 0
    
    # Pre-market and after-hours trading
    allow_pre_market: bool = False
    allow_after_hours: bool = False


@dataclass
class RiskManagementConfig:
    """Risk management configuration (QuantVue-inspired)"""
    # Profile
    risk_profile: RiskProfile = RiskProfile.MODERATE
    
    # Position sizing
    max_position_size_pct: float = 0.10  # Max 10% of portfolio per position
    max_total_exposure_pct: float = 0.50  # Max 50% total exposure
    position_sizing_method: str = "kelly_criterion"  # or "fixed_fractional", "volatility_adjusted"
    
    # Stop loss settings
    enable_stop_loss: bool = True
    stop_loss_type: str = "dynamic"  # "dynamic" or "static"
    static_stop_loss_pct: float = 0.02  # 2% for static
    dynamic_stop_loss_atr_multiplier: float = 2.0  # ATR multiplier for dynamic
    trailing_stop_enabled: bool = True
    trailing_stop_activation_pct: float = 0.015  # Activate after 1.5% profit
    trailing_stop_distance_pct: float = 0.01  # Trail by 1%
    
    # Take profit settings
    take_profit_type: str = "tiered"  # "tiered", "static", or "dynamic"
    static_take_profit_pct: float = 0.04  # 4% for static
    tiered_exits: List[Dict] = None  # Will be set in __post_init__
    dynamic_tp_volatility_multiplier: float = 3.0
    
    # Options-specific risk
    max_option_contracts: int = 10
    max_option_premium_per_trade: float = 5000.0
    options_stop_loss_pct: float = 0.50  # 50% loss on options
    
    # Daily/weekly limits
    max_daily_loss_pct: float = 0.05  # Stop trading if down 5% in a day
    max_daily_trades: int = 20
    max_weekly_loss_pct: float = 0.10
    
    # Martingale (use with caution)
    enable_martingale: bool = False
    martingale_max_doublings: int = 2
    martingale_min_win_rate: float = 0.70  # Only use if strategy has 70%+ win rate
    
    def __post_init__(self):
        if self.tiered_exits is None:
            # Default tiered exit strategy
            self.tiered_exits = [
                {"percentage": 0.33, "profit_target_pct": 0.02},  # Take 33% at 2%
                {"percentage": 0.33, "profit_target_pct": 0.03},  # Take 33% at 3%
                {"percentage": 0.34, "profit_target_pct": 0.05},  # Take 34% at 5%
            ]


@dataclass
class StrategyConfig:
    """Strategy-specific configuration"""
    # Strategy selection
    active_strategies: List[StrategyType] = None
    
    # Technical indicators (common across QuantVue strategies)
    use_volume_analysis: bool = True
    use_price_action: bool = True
    use_volatility_filters: bool = True
    
    # Timeframes
    primary_timeframe: str = "5min"  # Main trading timeframe
    higher_timeframe: str = "1hour"  # Trend confirmation
    
    # Entry filters
    min_volume: int = 100000  # Minimum daily volume
    min_price: float = 5.0  # Minimum stock price
    max_price: float = 1000.0  # Maximum stock price
    min_atr_percent: float = 0.01  # Minimum 1% ATR
    
    # Momentum Scalper settings (like Qscalper)
    scalper_risk_reward_ratio: float = 2.0
    scalper_use_dynamic_exits: bool = True
    scalper_max_hold_time_minutes: int = 30
    
    # Trend Follower settings (like Qzeus)
    trend_follower_ema_fast: int = 8
    trend_follower_ema_slow: int = 21
    trend_follower_min_trend_strength: float = 0.6
    
    # Range Trader settings (like Qkronos)
    range_trader_lookback_periods: int = 20
    range_trader_support_resistance_tolerance: float = 0.002
    
    # Volatility Breakout settings (like Qkronos_EVO)
    volatility_atr_period: int = 14
    volatility_breakout_multiplier: float = 2.5
    volatility_use_machine_learning: bool = True
    
    # Options strategy settings
    option_strategy_type: str = "directional"  # "directional", "spreads", "iron_condor"
    option_min_dte: int = 7  # Minimum days to expiration
    option_max_dte: int = 45  # Maximum days to expiration
    option_delta_range: tuple = (0.30, 0.70)  # Delta range for options
    option_max_iv_percentile: float = 0.75  # Max IV percentile
    
    def __post_init__(self):
        if self.active_strategies is None:
            self.active_strategies = [
                StrategyType.MOMENTUM_SCALPER,
                StrategyType.TREND_FOLLOWER
            ]


@dataclass
class DataConfig:
    """Market data configuration"""
    # Real-time data
    enable_streaming: bool = True
    
    # Market Scanner Configuration
    use_market_scanner: bool = True  # Use dynamic scanner vs static watchlist
    max_scan_symbols: int = 50  # Max symbols to actively monitor
    scanner_update_interval: int = 300  # Re-scan market every 5 minutes
    
    # Static watchlist (only used if use_market_scanner = False)
    stream_symbols: List[str] = None
    
    # Scanner filters
    min_volume: int = 500000  # Minimum daily volume (500k)
    min_price: float = 5.0  # Minimum stock price
    max_price: float = 1000.0  # Maximum stock price
    min_atr_percent: float = 0.01  # Minimum 1% ATR
    
    # Historical data
    historical_data_days: int = 90
    cache_historical_data: bool = True
    cache_duration_hours: int = 24
    
    # Technical indicators calculation
    calculate_indicators_realtime: bool = True
    indicator_update_frequency_seconds: int = 1
    
    # Options data
    fetch_option_chains: bool = True
    option_chain_range: str = "ALL"  # "ALL", "ITM", "OTM", "NTM"
    
    def __post_init__(self):
        if self.stream_symbols is None:
            # Fallback watchlist (only used if scanner disabled)
            self.stream_symbols = [
                'SPY', 'QQQ', 'IWM',  # Market ETFs
                'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA',  # Mega caps
                'TSLA', 'AMD', 'META'  # High volatility stocks
            ]


@dataclass
class NotificationConfig:
    """Notification and alerting configuration"""
    enable_trade_alerts: bool = True
    enable_error_alerts: bool = True
    enable_daily_summary: bool = True
    
    # Alert channels
    use_email: bool = False
    email_address: str = ""
    use_webhook: bool = False
    webhook_url: str = ""
    use_terminal: bool = True


class Config:
    """Main configuration class"""
    
    def __init__(self):
        self.schwab = SchwabCredentials()
        self.general = GeneralConfig()
        self.risk_management = RiskManagementConfig()
        self.strategy = StrategyConfig()
        self.data = DataConfig()
        self.notifications = NotificationConfig()
    
    def validate(self) -> bool:
        """Validate configuration"""
        errors = []
        
        # Validate Schwab credentials
        if not self.schwab.app_key:
            errors.append("SCHWAB_APP_KEY not set")
        if not self.schwab.app_secret:
            errors.append("SCHWAB_APP_SECRET not set")
        if not self.schwab.account_number:
            errors.append("SCHWAB_ACCOUNT_NUMBER not set")
        
        # Validate risk management
        if self.risk_management.max_position_size_pct > 0.25:
            errors.append("max_position_size_pct too high (max 25%)")
        
        if self.risk_management.max_total_exposure_pct > 1.0:
            errors.append("max_total_exposure_pct cannot exceed 100%")
        
        if errors:
            for error in errors:
                print(f"Configuration Error: {error}")
            return False
        
        return True
    
    def get_risk_parameters_for_profile(self) -> Dict:
        """Get risk parameters based on selected profile"""
        profiles = {
            RiskProfile.CONSERVATIVE: {
                "max_position_size_pct": 0.05,
                "max_total_exposure_pct": 0.30,
                "stop_loss_pct": 0.015,
                "take_profit_pct": 0.03,
                "enable_martingale": False,
                "max_daily_loss_pct": 0.03,
            },
            RiskProfile.MODERATE: {
                "max_position_size_pct": 0.10,
                "max_total_exposure_pct": 0.50,
                "stop_loss_pct": 0.02,
                "take_profit_pct": 0.04,
                "enable_martingale": False,
                "max_daily_loss_pct": 0.05,
            },
            RiskProfile.AGGRESSIVE: {
                "max_position_size_pct": 0.15,
                "max_total_exposure_pct": 0.70,
                "stop_loss_pct": 0.03,
                "take_profit_pct": 0.06,
                "enable_martingale": True,
                "max_daily_loss_pct": 0.08,
            }
        }
        return profiles.get(self.risk_management.risk_profile, profiles[RiskProfile.MODERATE])


# Global config instance
config = Config()
