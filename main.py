#!/usr/bin/env python3
"""
Schwab Automated Trading System
Main entry point

Based on QuantVue's automated trading methodology
"""

import os
import sys
import logging
import argparse
from pathlib import Path
import time
from datetime import datetime

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent))

from config.config import Config, TradingMode
from core.trading_engine import TradingEngine


def setup_logging(config):
    """Setup logging configuration"""
    log_dir = Path(config.general.log_file).parent
    log_dir.mkdir(parents=True, exist_ok=True)
    
    logging.basicConfig(
        level=getattr(logging, config.general.log_level),
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        handlers=[
            logging.FileHandler(config.general.log_file),
            logging.StreamHandler(sys.stdout)
        ]
    )
    
    return logging.getLogger(__name__)


def print_banner():
    """Print application banner"""
    banner = """
╔══════════════════════════════════════════════════════════════════════╗
║                                                                      ║
║     Schwab Automated Trading System                                 ║
║     Powered by QuantVue-Inspired Strategies                         ║
║                                                                      ║
║     WARNING: Automated trading involves significant risk            ║
║     Only use capital you can afford to lose                         ║
║                                                                      ║
╚══════════════════════════════════════════════════════════════════════╝
    """
    print(banner)


def main():
    parser = argparse.ArgumentParser(
        description='Schwab Automated Trading System'
    )
    parser.add_argument(
        '--mode',
        choices=['paper', 'live', 'backtest'],
        default='paper',
        help='Trading mode (default: paper)'
    )
    parser.add_argument(
        '--auth',
        action='store_true',
        help='Run interactive authentication setup'
    )
    parser.add_argument(
        '--status',
        action='store_true',
        help='Show current status and exit'
    )
    
    args = parser.parse_args()
    
    print_banner()
    
    # Load configuration
    config = Config()
    
    # Set trading mode
    if args.mode == 'paper':
        config.general.trading_mode = TradingMode.PAPER
    elif args.mode == 'live':
        config.general.trading_mode = TradingMode.LIVE
    elif args.mode == 'backtest':
        config.general.trading_mode = TradingMode.BACKTEST
    
    # Setup logging
    logger = setup_logging(config)
    logger.info(f"Starting in {config.general.trading_mode.value.upper()} mode")
    
    # Validate configuration
    if not config.validate():
        logger.error("Configuration validation failed")
        logger.error("Make sure to set environment variables:")
        logger.error("  - SCHWAB_APP_KEY")
        logger.error("  - SCHWAB_APP_SECRET")
        logger.error("  - SCHWAB_ACCOUNT_NUMBER")
        sys.exit(1)
    
    try:
        # Initialize trading engine
        engine = TradingEngine(config)
        
        # Handle authentication
        if args.auth:
            logger.info("Starting interactive authentication...")
            if engine.authenticate_interactive():
                logger.info("Authentication successful! You can now run the trading system.")
                sys.exit(0)
            else:
                logger.error("Authentication failed")
                sys.exit(1)
        
        # Show status
        if args.status:
            status = engine.get_status()
            print("\n" + "="*70)
            print("CURRENT STATUS")
            print("="*70)
            print(f"Running: {status['running']}")
            print(f"Account Value: ${status['account_value']:,.2f}")
            print(f"Buying Power: ${status['buying_power']:,.2f}")
            print(f"Active Positions: {status['active_positions']}")
            print(f"Daily P&L: ${status['daily_pnl']:,.2f}")
            print(f"Daily Trades: {status['daily_trades']}")
            print(f"Total Trades: {status['total_trades']}")
            print(f"Total P&L: ${status['total_pnl']:,.2f}")
            
            # Scanner stats if available
            if 'scanner' in status and status['scanner']:
                print("\nMARKET SCANNER:")
                scanner = status['scanner']
                print(f"  Symbols Scanned: {scanner.get('total_symbols', 0)}")
                print(f"  Last Scan: {scanner.get('last_scan', 'Never')}")
                print(f"  Avg Volume: {scanner.get('avg_volume', 0):,.0f}")
                print(f"  Avg Price: ${scanner.get('avg_price', 0):.2f}")
                print(f"  Avg Change: {scanner.get('avg_change', 0):.2f}%")
            
            print("\nSTRATEGY PERFORMANCE:")
            for strat in status['strategies']:
                print(f"\n{strat['name']}:")
                print(f"  Signals: {strat['total_signals']}")
                print(f"  Trades: {strat['total_trades']}")
                print(f"  Win Rate: {strat['win_rate']*100:.1f}%")
                print(f"  Total P&L: ${strat['total_pnl']:,.2f}")
            print("="*70)
            sys.exit(0)
        
        # Display trading mode warning
        if config.general.trading_mode == TradingMode.LIVE:
            print("\n" + "!"*70)
            print("! WARNING: LIVE TRADING MODE ENABLED")
            print("! Real money will be used for trading")
            print("! Press Ctrl+C within 10 seconds to cancel")
            print("!"*70 + "\n")
            
            for i in range(10, 0, -1):
                print(f"Starting in {i} seconds...", end='\r')
                time.sleep(1)
            print("\nStarting live trading...                ")
        else:
            print(f"\nRunning in {config.general.trading_mode.value.upper()} mode")
            print("No real money will be used\n")
        
        # Display configuration
        print("\nCONFIGURATION:")
        print(f"  Account: {config.schwab.account_number}")
        print(f"  Risk Profile: {config.risk_management.risk_profile.value}")
        print(f"  Max Position Size: {config.risk_management.max_position_size_pct*100:.1f}%")
        print(f"  Max Daily Loss: {config.risk_management.max_daily_loss_pct*100:.1f}%")
        print(f"  Active Strategies: {', '.join([s.value for s in config.strategy.active_strategies])}")
        
        if config.data.use_market_scanner:
            print(f"  Market Scanner: ENABLED")
            print(f"  - Scanning top 100 S&P 500 + ETFs")
            print(f"  - Max symbols to trade: {config.data.max_scan_symbols}")
            print(f"  - Min volume filter: {config.data.min_volume:,}")
        else:
            print(f"  Watchlist: {', '.join(config.data.stream_symbols[:5])}{'...' if len(config.data.stream_symbols) > 5 else ''}")
        print()
        
        # Start trading engine
        logger.info("Starting trading engine...")
        engine.start()
        
        print("Trading engine started successfully!")
        print("Press Ctrl+C to stop\n")
        
        # Main loop - keep running
        try:
            while True:
                time.sleep(60)
                
                # Periodic status update
                status = engine.get_status()
                logger.info(
                    f"Status: Positions={status['active_positions']}, "
                    f"Daily P&L=${status['daily_pnl']:.2f}, "
                    f"Trades={status['daily_trades']}"
                )
        
        except KeyboardInterrupt:
            print("\n\nShutting down gracefully...")
            logger.info("Shutdown signal received")
        
        finally:
            engine.stop()
            logger.info("Trading engine stopped")
            print("Goodbye!")
    
    except Exception as e:
        logger.error(f"Fatal error: {e}", exc_info=True)
        sys.exit(1)


if __name__ == "__main__":
    main()
