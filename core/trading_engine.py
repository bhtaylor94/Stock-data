"""
Main Trading Engine
Coordinates all components for automated trading
"""

import logging
import time
import threading
from typing import Dict, List, Optional
from datetime import datetime, timedelta
from collections import defaultdict
import pandas as pd

from core.schwab_client import SchwabClient, SchwabAuth
from core.order_builder import OrderBuilder, OrderType, OrderInstruction, AssetType, OrderDuration
from core.risk_manager import RiskManager
from core.market_scanner import MarketScanner
from strategies.strategies import (
    BaseStrategy, MomentumScalper, TrendFollower, VolatilityBreakout, Signal
)
from config.config import StrategyType

logger = logging.getLogger(__name__)


class TradingEngine:
    """
    Main trading engine that orchestrates all components
    """
    
    def __init__(self, config):
        self.config = config
        self.running = False
        
        # Initialize components
        logger.info("Initializing Trading Engine...")
        
        # Auth and client
        self.auth = SchwabAuth(
            app_key=config.schwab.app_key,
            app_secret=config.schwab.app_secret,
            callback_url=config.schwab.callback_url,
            token_path=config.schwab.token_path
        )
        
        # Load or authenticate
        if not self.auth.load_tokens():
            logger.error("No valid tokens found. Please authenticate first.")
            raise ValueError("Authentication required")
        
        self.auth.start_auto_refresh()
        
        self.client = SchwabClient(self.auth)
        self.client.set_account(config.schwab.account_number)
        
        # Risk manager
        self.risk_manager = RiskManager(config)
        
        # Market scanner (if enabled)
        if config.data.use_market_scanner:
            self.market_scanner = MarketScanner(self.client, config)
            logger.info("Market Scanner enabled - will scan top S&P 500 stocks")
        else:
            self.market_scanner = None
            logger.info(f"Using static watchlist: {len(config.data.stream_symbols)} symbols")
        
        # Initialize strategies
        self.strategies: List[BaseStrategy] = []
        self._init_strategies()
        
        # Trading state
        self.active_positions = {}  # symbol -> position info
        self.pending_orders = {}  # order_id -> order info
        self.market_data_cache = defaultdict(lambda: {"data": None, "timestamp": None})
        
        # Performance tracking
        self.total_trades = 0
        self.winning_trades = 0
        self.losing_trades = 0
        self.total_pnl = 0.0
        
        # Threads
        self.market_monitor_thread = None
        self.position_monitor_thread = None
        self.stop_event = threading.Event()
        
        logger.info("Trading Engine initialized successfully")
    
    def _init_strategies(self):
        """Initialize active strategies"""
        for strategy_type in self.config.strategy.active_strategies:
            if strategy_type == StrategyType.MOMENTUM_SCALPER:
                self.strategies.append(MomentumScalper(self.config, self.risk_manager))
            elif strategy_type == StrategyType.TREND_FOLLOWER:
                self.strategies.append(TrendFollower(self.config, self.risk_manager))
            elif strategy_type == StrategyType.VOLATILITY_BREAKOUT:
                self.strategies.append(VolatilityBreakout(self.config, self.risk_manager))
        
        logger.info(f"Initialized {len(self.strategies)} strategies")
    
    def authenticate_interactive(self):
        """
        Interactive authentication process
        Run this once to get initial tokens
        """
        url = self.auth.get_authorization_url()
        print("\n" + "="*80)
        print("SCHWAB AUTHENTICATION")
        print("="*80)
        print("\n1. Open this URL in your browser:")
        print(f"\n{url}\n")
        print("2. Log in to your Schwab account and approve access")
        print("3. After approval, you'll be redirected to a page")
        print("4. Copy the ENTIRE URL from your browser's address bar")
        print("\nPaste the URL here:")
        
        callback_url = input().strip()
        
        # Extract authorization code
        if "code=" in callback_url:
            code = callback_url.split("code=")[1].split("&")[0]
            
            if self.auth.exchange_code_for_token(code):
                print("\n✓ Authentication successful!")
                print(f"Tokens saved to: {self.auth.token_path}")
                return True
            else:
                print("\n✗ Authentication failed")
                return False
        else:
            print("\n✗ Invalid URL - no authorization code found")
            return False
    
    def start(self):
        """Start the trading engine"""
        if self.running:
            logger.warning("Trading engine already running")
            return
        
        logger.info("Starting Trading Engine...")
        self.running = True
        
        # Start monitoring threads
        self.market_monitor_thread = threading.Thread(
            target=self._market_monitor_loop,
            daemon=True
        )
        self.market_monitor_thread.start()
        
        self.position_monitor_thread = threading.Thread(
            target=self._position_monitor_loop,
            daemon=True
        )
        self.position_monitor_thread.start()
        
        logger.info("Trading Engine started")
    
    def stop(self):
        """Stop the trading engine"""
        if not self.running:
            return
        
        logger.info("Stopping Trading Engine...")
        self.running = False
        self.stop_event.set()
        
        # Wait for threads
        if self.market_monitor_thread:
            self.market_monitor_thread.join(timeout=10)
        if self.position_monitor_thread:
            self.position_monitor_thread.join(timeout=10)
        
        # Stop auth auto-refresh
        self.auth.stop_auto_refresh()
        
        logger.info("Trading Engine stopped")
    
    def _market_monitor_loop(self):
        """Monitor market and generate signals"""
        logger.info("Market monitor thread started")
        
        while self.running and not self.stop_event.is_set():
            try:
                # Check if we can trade
                account_info = self.client.get_account_info()
                account_value = account_info.get('securitiesAccount', {}).get(
                    'currentBalances', {}
                ).get('liquidationValue', 0)
                
                can_trade, reason = self.risk_manager.can_trade(account_value)
                
                if not can_trade:
                    logger.warning(f"Trading halted: {reason}")
                    time.sleep(60)
                    continue
                
                # Get symbols to scan
                if self.market_scanner:
                    # Use dynamic market scanner
                    symbols_to_scan = self.market_scanner.get_tradeable_symbols(
                        max_symbols=self.config.data.max_scan_symbols
                    )
                    
                    # Log scanner stats periodically
                    if hasattr(self, '_last_stats_log'):
                        if (datetime.now() - self._last_stats_log).total_seconds() > 300:
                            stats = self.market_scanner.get_stats()
                            logger.info(f"Scanner stats: {stats}")
                            self._last_stats_log = datetime.now()
                    else:
                        self._last_stats_log = datetime.now()
                else:
                    # Use static watchlist
                    symbols_to_scan = self.config.data.stream_symbols
                
                # Scan watchlist for signals
                for symbol in symbols_to_scan:
                    if symbol in self.active_positions:
                        continue  # Skip symbols we already have positions in
                    
                    # Get market data
                    market_data = self._get_market_data(symbol)
                    if not market_data:
                        continue
                    
                    # Get price history for indicators
                    price_history = self._get_price_history(symbol)
                    if price_history is None or price_history.empty:
                        continue
                    
                    # Run strategies
                    for strategy in self.strategies:
                        # Calculate indicators
                        indicators = strategy.calculate_indicators(price_history)
                        if not indicators:
                            continue
                        
                        # Generate signal
                        signal = strategy.analyze(symbol, market_data, indicators)
                        
                        if signal:
                            # Execute trade
                            self._execute_signal(signal, account_value, indicators.atr)
                
                # Sleep between scans
                time.sleep(10)
                
            except Exception as e:
                logger.error(f"Error in market monitor loop: {e}", exc_info=True)
                time.sleep(30)
        
        logger.info("Market monitor thread stopped")
    
    def _position_monitor_loop(self):
        """Monitor open positions and manage exits"""
        logger.info("Position monitor thread started")
        
        while self.running and not self.stop_event.is_set():
            try:
                # Get current positions
                positions = self.client.get_positions()
                
                for position in positions:
                    symbol = position.get('instrument', {}).get('symbol')
                    quantity = position.get('longQuantity', 0) - position.get('shortQuantity', 0)
                    
                    if quantity == 0:
                        continue
                    
                    # Get current price
                    quote = self.client.get_quote(symbol)
                    current_price = quote.get(symbol, {}).get('quote', {}).get('lastPrice', 0)
                    
                    if symbol in self.active_positions:
                        pos_info = self.active_positions[symbol]
                        entry_price = pos_info['entry_price']
                        is_long = quantity > 0
                        
                        # Check stop loss
                        if 'stop_order_id' in pos_info:
                            # Stop already placed
                            pass
                        else:
                            # Check if we should exit
                            stop_loss = pos_info.get('stop_loss')
                            if stop_loss:
                                if (is_long and current_price <= stop_loss) or \
                                   (not is_long and current_price >= stop_loss):
                                    self._close_position(symbol, "Stop Loss Hit")
                        
                        # Check take profit
                        take_profit = pos_info.get('take_profit')
                        if take_profit:
                            if (is_long and current_price >= take_profit) or \
                               (not is_long and current_price <= take_profit):
                                self._close_position(symbol, "Take Profit Hit")
                        
                        # Update trailing stop
                        if self.risk_manager.risk_config.trailing_stop_enabled:
                            new_stop = self.risk_manager.update_trailing_stop(
                                symbol, current_price, entry_price, is_long
                            )
                            if new_stop:
                                logger.info(f"Trailing stop updated for {symbol}: {new_stop:.2f}")
                
                time.sleep(5)
                
            except Exception as e:
                logger.error(f"Error in position monitor loop: {e}", exc_info=True)
                time.sleep(10)
        
        logger.info("Position monitor thread stopped")
    
    def _get_market_data(self, symbol: str) -> Optional[Dict]:
        """Get market data for symbol (with caching)"""
        cache = self.market_data_cache[symbol]
        
        # Check cache (1 second freshness)
        if cache["data"] and cache["timestamp"]:
            if (datetime.now() - cache["timestamp"]).total_seconds() < 1:
                return cache["data"]
        
        try:
            data = self.client.get_quote(symbol)
            cache["data"] = data
            cache["timestamp"] = datetime.now()
            return data
        except Exception as e:
            logger.error(f"Failed to get market data for {symbol}: {e}")
            return None
    
    def _get_price_history(self, symbol: str) -> Optional[pd.DataFrame]:
        """Get historical price data"""
        try:
            response = self.client.get_price_history(
                symbol=symbol,
                period_type="day",
                period=10,
                frequency_type="minute",
                frequency=5
            )
            
            candles = response.get('candles', [])
            if not candles:
                return None
            
            df = pd.DataFrame(candles)
            df['symbol'] = symbol
            return df
            
        except Exception as e:
            logger.error(f"Failed to get price history for {symbol}: {e}")
            return None
    
    def _execute_signal(self, signal: Signal, account_value: float, atr: Optional[float] = None):
        """Execute trading signal"""
        try:
            symbol = signal.symbol
            
            # Get current positions value
            positions = self.client.get_positions()
            current_exposure = sum(
                abs(p.get('longQuantity', 0) - p.get('shortQuantity', 0)) * 
                p.get('averagePrice', 0)
                for p in positions
            )
            
            # Calculate position size
            position_size = self.risk_manager.calculate_position_size(
                symbol=symbol,
                entry_price=signal.entry_price,
                stop_loss_price=signal.stop_loss,
                account_value=account_value,
                current_positions_value=current_exposure
            )
            
            if position_size == 0:
                logger.info(f"Position size = 0 for {symbol}, skipping trade")
                return
            
            # Determine order instruction
            if signal.direction == "LONG":
                instruction = OrderInstruction.BUY
            else:
                instruction = OrderInstruction.SELL_SHORT
            
            # Build order
            if self.config.general.trading_mode.value == "paper":
                # Paper trading - just log
                logger.info(
                    f"[PAPER] {instruction.value} {position_size} {symbol} @ ${signal.entry_price:.2f}"
                )
                logger.info(f"[PAPER] Stop: ${signal.stop_loss:.2f}, Target: ${signal.take_profit:.2f}")
                
                # Record simulated position
                self.active_positions[symbol] = {
                    'quantity': position_size if signal.direction == "LONG" else -position_size,
                    'entry_price': signal.entry_price,
                    'stop_loss': signal.stop_loss,
                    'take_profit': signal.take_profit,
                    'strategy': signal.strategy_name,
                    'entry_time': datetime.now()
                }
                
            else:
                # Live trading
                order = OrderBuilder.build_bracket_order(
                    symbol=symbol,
                    quantity=position_size,
                    entry_price=signal.entry_price,
                    stop_loss_price=signal.stop_loss,
                    take_profit_price=signal.take_profit,
                    is_long=(signal.direction == "LONG")
                )
                
                order_id = self.client.place_order(order)
                
                logger.info(
                    f"[LIVE] Order placed: {instruction.value} {position_size} {symbol} "
                    f"@ ${signal.entry_price:.2f} (Order ID: {order_id})"
                )
                
                self.active_positions[symbol] = {
                    'order_id': order_id,
                    'quantity': position_size if signal.direction == "LONG" else -position_size,
                    'entry_price': signal.entry_price,
                    'stop_loss': signal.stop_loss,
                    'take_profit': signal.take_profit,
                    'strategy': signal.strategy_name,
                    'entry_time': datetime.now()
                }
            
        except Exception as e:
            logger.error(f"Failed to execute signal for {signal.symbol}: {e}", exc_info=True)
    
    def _close_position(self, symbol: str, reason: str):
        """Close a position"""
        try:
            if symbol not in self.active_positions:
                return
            
            pos_info = self.active_positions[symbol]
            quantity = abs(pos_info['quantity'])
            is_long = pos_info['quantity'] > 0
            
            # Get current price
            quote = self.client.get_quote(symbol)
            exit_price = quote.get(symbol, {}).get('quote', {}).get('lastPrice', 0)
            
            if self.config.general.trading_mode.value == "paper":
                # Paper trading
                entry_price = pos_info['entry_price']
                if is_long:
                    pnl = quantity * (exit_price - entry_price)
                else:
                    pnl = quantity * (entry_price - exit_price)
                
                logger.info(
                    f"[PAPER] Closed {symbol}: {reason} | "
                    f"Entry: ${entry_price:.2f}, Exit: ${exit_price:.2f}, "
                    f"PnL: ${pnl:.2f}"
                )
                
                # Record trade
                self.risk_manager.record_trade(pnl)
                self.total_pnl += pnl
                
            else:
                # Live trading - place market order
                instruction = OrderInstruction.SELL if is_long else OrderInstruction.BUY_TO_COVER
                
                order = OrderBuilder.build_equity_order(
                    symbol=symbol,
                    quantity=quantity,
                    instruction=instruction,
                    order_type=OrderType.MARKET
                )
                
                order_id = self.client.place_order(order)
                logger.info(f"[LIVE] Closed {symbol}: {reason} (Order ID: {order_id})")
            
            # Remove from active positions
            del self.active_positions[symbol]
            
        except Exception as e:
            logger.error(f"Failed to close position for {symbol}: {e}", exc_info=True)
    
    def get_status(self) -> Dict:
        """Get current status"""
        account_info = self.client.get_account_info()
        balance = account_info.get('securitiesAccount', {}).get('currentBalances', {})
        
        status = {
            'running': self.running,
            'account_value': balance.get('liquidationValue', 0),
            'buying_power': balance.get('buyingPower', 0),
            'active_positions': len(self.active_positions),
            'daily_pnl': self.risk_manager.daily_pnl,
            'daily_trades': self.risk_manager.daily_trades,
            'total_trades': self.total_trades,
            'total_pnl': self.total_pnl,
            'strategies': [s.get_stats() for s in self.strategies]
        }
        
        # Add scanner info if enabled
        if self.market_scanner:
            status['scanner'] = self.market_scanner.get_stats()
        
        return status
