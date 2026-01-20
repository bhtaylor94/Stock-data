"""
Risk Management Module
Implements QuantVue-inspired risk management strategies
"""

import logging
from typing import Dict, Optional, List, Tuple
from datetime import datetime, timedelta
from dataclasses import dataclass
import pandas as pd
import numpy as np

logger = logging.getLogger(__name__)


@dataclass
class PositionRisk:
    """Position risk metrics"""
    symbol: str
    quantity: int
    entry_price: float
    current_price: float
    unrealized_pnl: float
    unrealized_pnl_pct: float
    position_value: float
    stop_loss_price: Optional[float] = None
    take_profit_price: Optional[float] = None
    trailing_stop_price: Optional[float] = None


@dataclass
class AccountRisk:
    """Account-level risk metrics"""
    total_value: float
    buying_power: float
    total_exposure: float
    exposure_pct: float
    daily_pnl: float
    daily_pnl_pct: float
    num_positions: int
    num_trades_today: int
    largest_position_pct: float


class RiskManager:
    """
    Risk Management System
    Based on QuantVue's dynamic risk management approach
    """
    
    def __init__(self, config):
        self.config = config
        self.risk_config = config.risk_management
        
        # Track daily statistics
        self.daily_pnl = 0.0
        self.daily_trades = 0
        self.daily_reset_time = datetime.now().replace(hour=0, minute=0, second=0)
        
        # Track positions
        self.position_stops = {}  # symbol -> stop price
        self.position_targets = {}  # symbol -> target price
        self.trailing_stops = {}  # symbol -> trailing stop info
        
        # Martingale tracking
        self.consecutive_losses = {}  # symbol -> count
        
        logger.info("Risk Manager initialized")
    
    def reset_daily_stats(self):
        """Reset daily statistics"""
        now = datetime.now()
        if now.date() > self.daily_reset_time.date():
            self.daily_pnl = 0.0
            self.daily_trades = 0
            self.daily_reset_time = now.replace(hour=0, minute=0, second=0)
            logger.info("Daily statistics reset")
    
    def can_trade(self, account_value: float) -> Tuple[bool, str]:
        """
        Check if trading is allowed based on risk limits
        
        Returns:
            (can_trade, reason)
        """
        self.reset_daily_stats()
        
        # Check daily loss limit
        daily_loss_limit = account_value * self.risk_config.max_daily_loss_pct
        if self.daily_pnl < -daily_loss_limit:
            return False, f"Daily loss limit reached: ${abs(self.daily_pnl):.2f}"
        
        # Check daily trade limit
        if self.daily_trades >= self.risk_config.max_daily_trades:
            return False, f"Daily trade limit reached: {self.daily_trades}"
        
        return True, "OK"
    
    def calculate_position_size(
        self,
        symbol: str,
        entry_price: float,
        stop_loss_price: float,
        account_value: float,
        current_positions_value: float = 0.0,
        win_rate: Optional[float] = None
    ) -> int:
        """
        Calculate optimal position size using various methods
        
        Args:
            symbol: Trading symbol
            entry_price: Entry price
            stop_loss_price: Stop loss price
            account_value: Total account value
            current_positions_value: Value of current positions
            win_rate: Strategy win rate (for Kelly Criterion)
        
        Returns:
            Position size in shares/contracts
        """
        method = self.risk_config.position_sizing_method
        
        if method == "fixed_fractional":
            return self._fixed_fractional_size(
                entry_price, stop_loss_price, account_value, current_positions_value
            )
        
        elif method == "kelly_criterion" and win_rate:
            return self._kelly_criterion_size(
                entry_price, stop_loss_price, account_value, 
                current_positions_value, win_rate
            )
        
        elif method == "volatility_adjusted":
            return self._volatility_adjusted_size(
                symbol, entry_price, stop_loss_price, 
                account_value, current_positions_value
            )
        
        else:
            # Default to fixed fractional
            return self._fixed_fractional_size(
                entry_price, stop_loss_price, account_value, current_positions_value
            )
    
    def _fixed_fractional_size(
        self,
        entry_price: float,
        stop_loss_price: float,
        account_value: float,
        current_positions_value: float
    ) -> int:
        """Fixed fractional position sizing"""
        # Calculate risk per share
        risk_per_share = abs(entry_price - stop_loss_price)
        
        # Maximum position value
        max_position_value = account_value * self.risk_config.max_position_size_pct
        
        # Check total exposure limit
        remaining_exposure = (account_value * self.risk_config.max_total_exposure_pct) - current_positions_value
        max_position_value = min(max_position_value, remaining_exposure)
        
        if max_position_value <= 0:
            return 0
        
        # Calculate position size
        position_size = int(max_position_value / entry_price)
        
        return max(0, position_size)
    
    def _kelly_criterion_size(
        self,
        entry_price: float,
        stop_loss_price: float,
        account_value: float,
        current_positions_value: float,
        win_rate: float
    ) -> int:
        """
        Kelly Criterion position sizing
        Kelly % = W - (1-W)/R
        Where W = win rate, R = average win/loss ratio
        """
        # Assume conservative 1:2 risk/reward
        avg_win_loss_ratio = 2.0
        
        # Kelly percentage (fractional)
        kelly_pct = win_rate - ((1 - win_rate) / avg_win_loss_ratio)
        
        # Use half-Kelly for safety
        kelly_pct = max(0, kelly_pct * 0.5)
        
        # Apply maximum position size constraint
        kelly_pct = min(kelly_pct, self.risk_config.max_position_size_pct)
        
        # Calculate position value
        max_position_value = account_value * kelly_pct
        
        # Check total exposure
        remaining_exposure = (account_value * self.risk_config.max_total_exposure_pct) - current_positions_value
        max_position_value = min(max_position_value, remaining_exposure)
        
        if max_position_value <= 0:
            return 0
        
        position_size = int(max_position_value / entry_price)
        
        return max(0, position_size)
    
    def _volatility_adjusted_size(
        self,
        symbol: str,
        entry_price: float,
        stop_loss_price: float,
        account_value: float,
        current_positions_value: float
    ) -> int:
        """Volatility-adjusted position sizing (would need ATR data)"""
        # Placeholder - would integrate with market data for actual ATR
        return self._fixed_fractional_size(
            entry_price, stop_loss_price, account_value, current_positions_value
        )
    
    def calculate_stop_loss(
        self,
        symbol: str,
        entry_price: float,
        is_long: bool,
        atr: Optional[float] = None
    ) -> float:
        """
        Calculate stop loss price
        
        Args:
            symbol: Trading symbol
            entry_price: Entry price
            is_long: True for long position
            atr: Average True Range (for dynamic stops)
        
        Returns:
            Stop loss price
        """
        if self.risk_config.stop_loss_type == "static":
            # Static percentage stop
            stop_pct = self.risk_config.static_stop_loss_pct
            if is_long:
                return entry_price * (1 - stop_pct)
            else:
                return entry_price * (1 + stop_pct)
        
        elif self.risk_config.stop_loss_type == "dynamic" and atr:
            # ATR-based dynamic stop
            multiplier = self.risk_config.dynamic_stop_loss_atr_multiplier
            stop_distance = atr * multiplier
            
            if is_long:
                return entry_price - stop_distance
            else:
                return entry_price + stop_distance
        
        else:
            # Default to static
            stop_pct = self.risk_config.static_stop_loss_pct
            if is_long:
                return entry_price * (1 - stop_pct)
            else:
                return entry_price * (1 + stop_pct)
    
    def calculate_take_profit(
        self,
        symbol: str,
        entry_price: float,
        is_long: bool,
        atr: Optional[float] = None
    ) -> float:
        """
        Calculate take profit price
        
        Args:
            symbol: Trading symbol
            entry_price: Entry price
            is_long: True for long position
            atr: Average True Range
        
        Returns:
            Take profit price
        """
        if self.risk_config.take_profit_type == "static":
            tp_pct = self.risk_config.static_take_profit_pct
            if is_long:
                return entry_price * (1 + tp_pct)
            else:
                return entry_price * (1 - tp_pct)
        
        elif self.risk_config.take_profit_type == "dynamic" and atr:
            multiplier = self.risk_config.dynamic_tp_volatility_multiplier
            tp_distance = atr * multiplier
            
            if is_long:
                return entry_price + tp_distance
            else:
                return entry_price - tp_distance
        
        else:
            tp_pct = self.risk_config.static_take_profit_pct
            if is_long:
                return entry_price * (1 + tp_pct)
            else:
                return entry_price * (1 - tp_pct)
    
    def get_tiered_exit_levels(
        self,
        entry_price: float,
        is_long: bool
    ) -> List[Dict]:
        """
        Get tiered exit levels based on configuration
        
        Returns:
            List of dicts with 'percentage' and 'price' keys
        """
        exits = []
        
        for tier in self.risk_config.tiered_exits:
            profit_pct = tier['profit_target_pct']
            
            if is_long:
                exit_price = entry_price * (1 + profit_pct)
            else:
                exit_price = entry_price * (1 - profit_pct)
            
            exits.append({
                'percentage': tier['percentage'],
                'price': exit_price
            })
        
        return exits
    
    def update_trailing_stop(
        self,
        symbol: str,
        current_price: float,
        entry_price: float,
        is_long: bool
    ) -> Optional[float]:
        """
        Update trailing stop for a position
        
        Returns:
            New trailing stop price, or None if not activated
        """
        if not self.risk_config.trailing_stop_enabled:
            return None
        
        # Check if trailing stop should activate
        activation_pct = self.risk_config.trailing_stop_activation_pct
        
        if is_long:
            profit_pct = (current_price - entry_price) / entry_price
            if profit_pct >= activation_pct:
                # Calculate trailing stop
                trail_distance = current_price * self.risk_config.trailing_stop_distance_pct
                new_stop = current_price - trail_distance
                
                # Update if higher than existing stop
                if symbol in self.trailing_stops:
                    existing_stop = self.trailing_stops[symbol]
                    new_stop = max(new_stop, existing_stop)
                
                self.trailing_stops[symbol] = new_stop
                return new_stop
        else:
            profit_pct = (entry_price - current_price) / entry_price
            if profit_pct >= activation_pct:
                trail_distance = current_price * self.risk_config.trailing_stop_distance_pct
                new_stop = current_price + trail_distance
                
                if symbol in self.trailing_stops:
                    existing_stop = self.trailing_stops[symbol]
                    new_stop = min(new_stop, existing_stop)
                
                self.trailing_stops[symbol] = new_stop
                return new_stop
        
        return None
    
    def apply_martingale(
        self,
        symbol: str,
        base_size: int,
        lost_previous_trade: bool
    ) -> int:
        """
        Apply martingale position sizing (USE WITH CAUTION)
        
        Args:
            symbol: Trading symbol
            base_size: Base position size
            lost_previous_trade: True if previous trade was a loss
        
        Returns:
            Adjusted position size
        """
        if not self.risk_config.enable_martingale:
            return base_size
        
        if lost_previous_trade:
            # Increment loss counter
            self.consecutive_losses[symbol] = self.consecutive_losses.get(symbol, 0) + 1
        else:
            # Reset on win
            self.consecutive_losses[symbol] = 0
        
        # Calculate multiplier (2^losses)
        losses = min(
            self.consecutive_losses.get(symbol, 0),
            self.risk_config.martingale_max_doublings
        )
        
        multiplier = 2 ** losses
        adjusted_size = base_size * multiplier
        
        logger.warning(f"Martingale applied to {symbol}: {multiplier}x size = {adjusted_size}")
        
        return adjusted_size
    
    def calculate_position_risk(
        self,
        symbol: str,
        quantity: int,
        entry_price: float,
        current_price: float,
        stop_loss: Optional[float] = None,
        take_profit: Optional[float] = None
    ) -> PositionRisk:
        """Calculate risk metrics for a position"""
        position_value = quantity * current_price
        unrealized_pnl = quantity * (current_price - entry_price)
        unrealized_pnl_pct = ((current_price - entry_price) / entry_price) * 100
        
        return PositionRisk(
            symbol=symbol,
            quantity=quantity,
            entry_price=entry_price,
            current_price=current_price,
            unrealized_pnl=unrealized_pnl,
            unrealized_pnl_pct=unrealized_pnl_pct,
            position_value=position_value,
            stop_loss_price=stop_loss,
            take_profit_price=take_profit,
            trailing_stop_price=self.trailing_stops.get(symbol)
        )
    
    def calculate_account_risk(
        self,
        account_value: float,
        buying_power: float,
        positions: List[PositionRisk],
        daily_pnl: float
    ) -> AccountRisk:
        """Calculate account-level risk metrics"""
        total_exposure = sum(p.position_value for p in positions)
        exposure_pct = (total_exposure / account_value) * 100 if account_value > 0 else 0
        
        daily_pnl_pct = (daily_pnl / account_value) * 100 if account_value > 0 else 0
        
        largest_position = max(
            [p.position_value / account_value * 100 for p in positions] + [0]
        )
        
        return AccountRisk(
            total_value=account_value,
            buying_power=buying_power,
            total_exposure=total_exposure,
            exposure_pct=exposure_pct,
            daily_pnl=daily_pnl,
            daily_pnl_pct=daily_pnl_pct,
            num_positions=len(positions),
            num_trades_today=self.daily_trades,
            largest_position_pct=largest_position
        )
    
    def record_trade(self, pnl: float):
        """Record a completed trade"""
        self.daily_pnl += pnl
        self.daily_trades += 1
        logger.info(f"Trade recorded: PnL ${pnl:.2f}, Daily total: ${self.daily_pnl:.2f}")
