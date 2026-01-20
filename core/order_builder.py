"""
Order Builder for Schwab API
Constructs proper order payloads for stocks and options
"""

from typing import Dict, Optional, List
from enum import Enum
from datetime import datetime


class OrderType(Enum):
    """Order types"""
    MARKET = "MARKET"
    LIMIT = "LIMIT"
    STOP = "STOP"
    STOP_LIMIT = "STOP_LIMIT"
    TRAILING_STOP = "TRAILING_STOP"


class OrderDuration(Enum):
    """Order duration"""
    DAY = "DAY"
    GOOD_TILL_CANCEL = "GOOD_TILL_CANCEL"
    FILL_OR_KILL = "FILL_OR_KILL"


class OrderInstruction(Enum):
    """Order instructions"""
    BUY = "BUY"
    SELL = "SELL"
    BUY_TO_COVER = "BUY_TO_COVER"
    SELL_SHORT = "SELL_SHORT"
    BUY_TO_OPEN = "BUY_TO_OPEN"
    BUY_TO_CLOSE = "BUY_TO_CLOSE"
    SELL_TO_OPEN = "SELL_TO_OPEN"
    SELL_TO_CLOSE = "SELL_TO_CLOSE"


class AssetType(Enum):
    """Asset types"""
    EQUITY = "EQUITY"
    OPTION = "OPTION"


class OptionType(Enum):
    """Option types"""
    CALL = "CALL"
    PUT = "PUT"


class OrderBuilder:
    """Build order payloads for Schwab API"""
    
    @staticmethod
    def build_equity_order(
        symbol: str,
        quantity: int,
        instruction: OrderInstruction,
        order_type: OrderType = OrderType.MARKET,
        duration: OrderDuration = OrderDuration.DAY,
        price: Optional[float] = None,
        stop_price: Optional[float] = None
    ) -> Dict:
        """
        Build equity order payload
        
        Args:
            symbol: Stock symbol
            quantity: Number of shares
            instruction: BUY, SELL, etc.
            order_type: MARKET, LIMIT, etc.
            duration: Order duration
            price: Limit price (for LIMIT orders)
            stop_price: Stop price (for STOP orders)
        """
        order = {
            "orderType": order_type.value,
            "session": "NORMAL",
            "duration": duration.value,
            "orderStrategyType": "SINGLE",
            "orderLegCollection": [
                {
                    "instruction": instruction.value,
                    "quantity": quantity,
                    "instrument": {
                        "symbol": symbol,
                        "assetType": AssetType.EQUITY.value
                    }
                }
            ]
        }
        
        # Add price for limit orders
        if order_type == OrderType.LIMIT and price:
            order["price"] = round(price, 2)
        
        # Add stop price for stop orders
        if order_type in [OrderType.STOP, OrderType.STOP_LIMIT] and stop_price:
            order["stopPrice"] = round(stop_price, 2)
            if order_type == OrderType.STOP_LIMIT and price:
                order["price"] = round(price, 2)
        
        return order
    
    @staticmethod
    def build_option_order(
        option_symbol: str,
        quantity: int,
        instruction: OrderInstruction,
        order_type: OrderType = OrderType.MARKET,
        duration: OrderDuration = OrderDuration.DAY,
        price: Optional[float] = None,
        stop_price: Optional[float] = None
    ) -> Dict:
        """
        Build option order payload
        
        Args:
            option_symbol: Full option symbol (e.g., "AAPL  210115C00050000")
            quantity: Number of contracts
            instruction: BUY_TO_OPEN, SELL_TO_CLOSE, etc.
            order_type: MARKET, LIMIT, etc.
            duration: Order duration
            price: Limit price (for LIMIT orders)
            stop_price: Stop price (for STOP orders)
        """
        order = {
            "orderType": order_type.value,
            "session": "NORMAL",
            "duration": duration.value,
            "orderStrategyType": "SINGLE",
            "orderLegCollection": [
                {
                    "instruction": instruction.value,
                    "quantity": quantity,
                    "instrument": {
                        "symbol": option_symbol,
                        "assetType": AssetType.OPTION.value
                    }
                }
            ]
        }
        
        if order_type == OrderType.LIMIT and price:
            order["price"] = round(price, 2)
        
        if order_type in [OrderType.STOP, OrderType.STOP_LIMIT] and stop_price:
            order["stopPrice"] = round(stop_price, 2)
            if order_type == OrderType.STOP_LIMIT and price:
                order["price"] = round(price, 2)
        
        return order
    
    @staticmethod
    def build_bracket_order(
        symbol: str,
        quantity: int,
        entry_price: float,
        stop_loss_price: float,
        take_profit_price: float,
        asset_type: AssetType = AssetType.EQUITY,
        is_long: bool = True
    ) -> Dict:
        """
        Build bracket order (entry + stop loss + take profit)
        
        Args:
            symbol: Symbol to trade
            quantity: Quantity
            entry_price: Entry limit price
            stop_loss_price: Stop loss price
            take_profit_price: Take profit price
            asset_type: EQUITY or OPTION
            is_long: True for long position, False for short
        """
        # Determine instructions
        if asset_type == AssetType.EQUITY:
            entry_instruction = OrderInstruction.BUY if is_long else OrderInstruction.SELL_SHORT
            exit_instruction = OrderInstruction.SELL if is_long else OrderInstruction.BUY_TO_COVER
        else:
            entry_instruction = OrderInstruction.BUY_TO_OPEN if is_long else OrderInstruction.SELL_TO_OPEN
            exit_instruction = OrderInstruction.SELL_TO_CLOSE if is_long else OrderInstruction.BUY_TO_CLOSE
        
        order = {
            "orderType": "LIMIT",
            "session": "NORMAL",
            "duration": "DAY",
            "orderStrategyType": "TRIGGER",
            "price": round(entry_price, 2),
            "orderLegCollection": [
                {
                    "instruction": entry_instruction.value,
                    "quantity": quantity,
                    "instrument": {
                        "symbol": symbol,
                        "assetType": asset_type.value
                    }
                }
            ],
            "childOrderStrategies": [
                {
                    # Stop loss
                    "orderType": "STOP",
                    "session": "NORMAL",
                    "duration": "GOOD_TILL_CANCEL",
                    "stopPrice": round(stop_loss_price, 2),
                    "orderStrategyType": "SINGLE",
                    "orderLegCollection": [
                        {
                            "instruction": exit_instruction.value,
                            "quantity": quantity,
                            "instrument": {
                                "symbol": symbol,
                                "assetType": asset_type.value
                            }
                        }
                    ]
                },
                {
                    # Take profit
                    "orderType": "LIMIT",
                    "session": "NORMAL",
                    "duration": "GOOD_TILL_CANCEL",
                    "price": round(take_profit_price, 2),
                    "orderStrategyType": "SINGLE",
                    "orderLegCollection": [
                        {
                            "instruction": exit_instruction.value,
                            "quantity": quantity,
                            "instrument": {
                                "symbol": symbol,
                                "assetType": asset_type.value
                            }
                        }
                    ]
                }
            ]
        }
        
        return order
    
    @staticmethod
    def build_trailing_stop_order(
        symbol: str,
        quantity: int,
        instruction: OrderInstruction,
        trail_type: str = "PERCENTAGE",
        trail_value: float = 2.0,
        asset_type: AssetType = AssetType.EQUITY
    ) -> Dict:
        """
        Build trailing stop order
        
        Args:
            symbol: Symbol to trade
            quantity: Quantity
            instruction: SELL or BUY_TO_COVER
            trail_type: "PERCENTAGE" or "AMOUNT"
            trail_value: Trail percentage (e.g., 2.0 for 2%) or dollar amount
            asset_type: EQUITY or OPTION
        """
        order = {
            "orderType": "TRAILING_STOP",
            "session": "NORMAL",
            "duration": "GOOD_TILL_CANCEL",
            "orderStrategyType": "SINGLE",
            "orderLegCollection": [
                {
                    "instruction": instruction.value,
                    "quantity": quantity,
                    "instrument": {
                        "symbol": symbol,
                        "assetType": asset_type.value
                    }
                }
            ]
        }
        
        if trail_type == "PERCENTAGE":
            order["stopPriceLinkBasis"] = "BID"
            order["stopPriceLinkType"] = "PERCENT"
            order["stopPriceOffset"] = trail_value
        else:
            order["stopPriceLinkBasis"] = "BID"
            order["stopPriceLinkType"] = "VALUE"
            order["stopPriceOffset"] = trail_value
        
        return order
    
    @staticmethod
    def build_option_spread(
        legs: List[Dict],
        order_type: OrderType = OrderType.MARKET,
        duration: OrderDuration = OrderDuration.DAY,
        net_debit_credit: Optional[float] = None
    ) -> Dict:
        """
        Build multi-leg option spread order
        
        Args:
            legs: List of leg dictionaries with keys:
                  - symbol: Option symbol
                  - quantity: Number of contracts
                  - instruction: BUY_TO_OPEN, SELL_TO_OPEN, etc.
            order_type: MARKET or LIMIT
            duration: Order duration
            net_debit_credit: Net price for spread (positive for debit, negative for credit)
        """
        order = {
            "orderType": order_type.value,
            "session": "NORMAL",
            "duration": duration.value,
            "orderStrategyType": "SINGLE",
            "orderLegCollection": []
        }
        
        for leg in legs:
            order["orderLegCollection"].append({
                "instruction": leg["instruction"],
                "quantity": leg["quantity"],
                "instrument": {
                    "symbol": leg["symbol"],
                    "assetType": AssetType.OPTION.value
                }
            })
        
        if order_type == OrderType.LIMIT and net_debit_credit is not None:
            order["price"] = round(abs(net_debit_credit), 2)
        
        return order
    
    @staticmethod
    def parse_option_symbol(underlying: str, expiration: str, 
                          option_type: OptionType, strike: float) -> str:
        """
        Create option symbol in Schwab format
        
        Format: SYMBOL(6) YYMMDD C/P STRIKE(8)
        Example: "AAPL  210115C00050000"
        
        Args:
            underlying: Underlying symbol (e.g., "AAPL")
            expiration: Expiration date "YYMMDD" (e.g., "210115")
            option_type: CALL or PUT
            strike: Strike price (e.g., 50.0)
        """
        # Pad symbol to 6 characters
        symbol_part = underlying.ljust(6)
        
        # Option type: C or P
        type_part = option_type.value[0]
        
        # Strike price: 5 digits before decimal, 3 after (e.g., 00050000 for $50)
        strike_int = int(strike * 1000)
        strike_part = f"{strike_int:08d}"
        
        return f"{symbol_part}{expiration}{type_part}{strike_part}"
    
    @staticmethod
    def validate_order(order: Dict) -> bool:
        """
        Validate order structure
        
        Args:
            order: Order payload dictionary
            
        Returns:
            True if valid, raises ValueError if not
        """
        required_fields = ["orderType", "session", "duration", 
                         "orderStrategyType", "orderLegCollection"]
        
        for field in required_fields:
            if field not in order:
                raise ValueError(f"Missing required field: {field}")
        
        if not order["orderLegCollection"]:
            raise ValueError("orderLegCollection cannot be empty")
        
        for leg in order["orderLegCollection"]:
            if "instruction" not in leg:
                raise ValueError("Order leg missing instruction")
            if "quantity" not in leg:
                raise ValueError("Order leg missing quantity")
            if "instrument" not in leg:
                raise ValueError("Order leg missing instrument")
            if "symbol" not in leg["instrument"]:
                raise ValueError("Order leg instrument missing symbol")
            if "assetType" not in leg["instrument"]:
                raise ValueError("Order leg instrument missing assetType")
        
        return True
