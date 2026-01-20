"""
Schwab API Client with OAuth2 Authentication
Handles all interactions with Schwab's Trading and Market Data APIs
"""

import json
import time
import base64
import requests
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
from pathlib import Path
import threading
import logging

logger = logging.getLogger(__name__)


class SchwabAuth:
    """Handles Schwab OAuth2 authentication"""
    
    def __init__(self, app_key: str, app_secret: str, callback_url: str, token_path: str):
        self.app_key = app_key
        self.app_secret = app_secret
        self.callback_url = callback_url
        self.token_path = Path(token_path)
        self.token_path.parent.mkdir(parents=True, exist_ok=True)
        
        self.access_token = None
        self.refresh_token = None
        self.token_expiry = None
        self.refresh_lock = threading.Lock()
        
        # Auto-refresh thread
        self.refresh_thread = None
        self.stop_refresh = threading.Event()
    
    def get_authorization_url(self) -> str:
        """Generate authorization URL for initial login"""
        base_url = "https://api.schwabapi.com/v1/oauth/authorize"
        params = {
            "client_id": self.app_key,
            "redirect_uri": self.callback_url
        }
        url = f"{base_url}?client_id={params['client_id']}&redirect_uri={params['redirect_uri']}"
        return url
    
    def exchange_code_for_token(self, authorization_code: str) -> bool:
        """Exchange authorization code for access and refresh tokens"""
        url = "https://api.schwabapi.com/v1/oauth/token"
        
        # Create authorization header
        auth_string = f"{self.app_key}:{self.app_secret}"
        auth_bytes = auth_string.encode('ascii')
        auth_b64 = base64.b64encode(auth_bytes).decode('ascii')
        
        headers = {
            "Authorization": f"Basic {auth_b64}",
            "Content-Type": "application/x-www-form-urlencoded"
        }
        
        data = {
            "grant_type": "authorization_code",
            "code": authorization_code,
            "redirect_uri": self.callback_url
        }
        
        try:
            response = requests.post(url, headers=headers, data=data)
            response.raise_for_status()
            
            token_data = response.json()
            self._save_tokens(token_data)
            return True
            
        except requests.exceptions.RequestException as e:
            logger.error(f"Failed to exchange code for token: {e}")
            return False
    
    def refresh_access_token(self) -> bool:
        """Refresh the access token using refresh token"""
        with self.refresh_lock:
            if not self.refresh_token:
                logger.error("No refresh token available")
                return False
            
            url = "https://api.schwabapi.com/v1/oauth/token"
            
            auth_string = f"{self.app_key}:{self.app_secret}"
            auth_bytes = auth_string.encode('ascii')
            auth_b64 = base64.b64encode(auth_bytes).decode('ascii')
            
            headers = {
                "Authorization": f"Basic {auth_b64}",
                "Content-Type": "application/x-www-form-urlencoded"
            }
            
            data = {
                "grant_type": "refresh_token",
                "refresh_token": self.refresh_token
            }
            
            try:
                response = requests.post(url, headers=headers, data=data)
                response.raise_for_status()
                
                token_data = response.json()
                self._save_tokens(token_data)
                logger.info("Access token refreshed successfully")
                return True
                
            except requests.exceptions.RequestException as e:
                logger.error(f"Failed to refresh access token: {e}")
                return False
    
    def _save_tokens(self, token_data: Dict):
        """Save tokens to file and update instance variables"""
        self.access_token = token_data.get('access_token')
        self.refresh_token = token_data.get('refresh_token', self.refresh_token)
        
        # Access token expires in 30 minutes
        expires_in = token_data.get('expires_in', 1800)
        self.token_expiry = datetime.now() + timedelta(seconds=expires_in)
        
        # Save to file
        save_data = {
            'access_token': self.access_token,
            'refresh_token': self.refresh_token,
            'token_expiry': self.token_expiry.isoformat(),
            'created_at': datetime.now().isoformat()
        }
        
        with open(self.token_path, 'w') as f:
            json.dump(save_data, f, indent=2)
        
        logger.info(f"Tokens saved to {self.token_path}")
    
    def load_tokens(self) -> bool:
        """Load tokens from file"""
        if not self.token_path.exists():
            logger.warning(f"Token file not found: {self.token_path}")
            return False
        
        try:
            with open(self.token_path, 'r') as f:
                token_data = json.load(f)
            
            self.access_token = token_data.get('access_token')
            self.refresh_token = token_data.get('refresh_token')
            
            expiry_str = token_data.get('token_expiry')
            if expiry_str:
                self.token_expiry = datetime.fromisoformat(expiry_str)
            
            # Check if token is expired
            if self.token_expiry and datetime.now() >= self.token_expiry:
                logger.info("Access token expired, refreshing...")
                return self.refresh_access_token()
            
            logger.info("Tokens loaded successfully")
            return True
            
        except Exception as e:
            logger.error(f"Failed to load tokens: {e}")
            return False
    
    def start_auto_refresh(self):
        """Start automatic token refresh (every 25 minutes)"""
        def refresh_loop():
            while not self.stop_refresh.is_set():
                # Wait 25 minutes (token expires in 30)
                if self.stop_refresh.wait(timeout=1500):
                    break
                self.refresh_access_token()
        
        self.refresh_thread = threading.Thread(target=refresh_loop, daemon=True)
        self.refresh_thread.start()
        logger.info("Auto-refresh thread started")
    
    def stop_auto_refresh(self):
        """Stop automatic token refresh"""
        self.stop_refresh.set()
        if self.refresh_thread:
            self.refresh_thread.join(timeout=5)
        logger.info("Auto-refresh thread stopped")
    
    def get_access_token(self) -> Optional[str]:
        """Get current valid access token"""
        if not self.access_token:
            if not self.load_tokens():
                return None
        
        # Check if token is about to expire (within 5 minutes)
        if self.token_expiry and datetime.now() >= self.token_expiry - timedelta(minutes=5):
            self.refresh_access_token()
        
        return self.access_token


class SchwabClient:
    """Schwab API Client for trading and market data"""
    
    def __init__(self, auth: SchwabAuth):
        self.auth = auth
        self.base_url = "https://api.schwabapi.com/trader/v1"
        self.market_data_url = "https://api.schwabapi.com/marketdata/v1"
        
        self.account_hash = None
        self.session = requests.Session()
        
        # Rate limiting
        self.last_request_time = 0
        self.request_count = 0
        self.request_window_start = time.time()
        self.max_requests_per_minute = 120
    
    def _get_headers(self) -> Dict[str, str]:
        """Get headers with current access token"""
        token = self.auth.get_access_token()
        return {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }
    
    def _rate_limit(self):
        """Implement rate limiting"""
        current_time = time.time()
        
        # Reset counter if minute has passed
        if current_time - self.request_window_start >= 60:
            self.request_count = 0
            self.request_window_start = current_time
        
        # Check if we're at the limit
        if self.request_count >= self.max_requests_per_minute:
            sleep_time = 60 - (current_time - self.request_window_start)
            if sleep_time > 0:
                logger.warning(f"Rate limit reached, sleeping for {sleep_time:.2f}s")
                time.sleep(sleep_time)
                self.request_count = 0
                self.request_window_start = time.time()
        
        self.request_count += 1
    
    def _make_request(self, method: str, endpoint: str, **kwargs) -> requests.Response:
        """Make API request with rate limiting"""
        self._rate_limit()
        
        url = f"{self.base_url}{endpoint}"
        headers = self._get_headers()
        
        if 'headers' in kwargs:
            headers.update(kwargs.pop('headers'))
        
        response = self.session.request(method, url, headers=headers, **kwargs)
        response.raise_for_status()
        
        return response
    
    # Account Methods
    
    def get_account_numbers(self) -> List[Dict]:
        """Get account numbers and hashes"""
        response = self._make_request('GET', '/accounts/accountNumbers')
        return response.json()
    
    def get_account_hash(self, account_number: str) -> Optional[str]:
        """Get account hash for given account number"""
        accounts = self.get_account_numbers()
        for account in accounts:
            if account.get('accountNumber') == account_number:
                return account.get('hashValue')
        return None
    
    def set_account(self, account_number: str):
        """Set the account to use for trading"""
        self.account_hash = self.get_account_hash(account_number)
        if not self.account_hash:
            raise ValueError(f"Account {account_number} not found")
        logger.info(f"Account set: {account_number}")
    
    def get_account_info(self, fields: str = "positions") -> Dict:
        """Get account information"""
        if not self.account_hash:
            raise ValueError("Account not set. Call set_account() first")
        
        endpoint = f"/accounts/{self.account_hash}"
        params = {"fields": fields}
        response = self._make_request('GET', endpoint, params=params)
        return response.json()
    
    def get_positions(self) -> List[Dict]:
        """Get current positions"""
        account_info = self.get_account_info(fields="positions")
        return account_info.get('securitiesAccount', {}).get('positions', [])
    
    def get_buying_power(self) -> float:
        """Get available buying power"""
        account_info = self.get_account_info()
        balance = account_info.get('securitiesAccount', {}).get('currentBalances', {})
        return balance.get('buyingPower', 0.0)
    
    # Market Data Methods
    
    def get_quote(self, symbol: str) -> Dict:
        """Get real-time quote for a symbol"""
        url = f"{self.market_data_url}/quotes/{symbol}"
        headers = self._get_headers()
        response = self.session.get(url, headers=headers)
        response.raise_for_status()
        return response.json()
    
    def get_quotes(self, symbols: List[str]) -> Dict:
        """Get quotes for multiple symbols"""
        url = f"{self.market_data_url}/quotes"
        headers = self._get_headers()
        params = {"symbols": ",".join(symbols)}
        response = self.session.get(url, headers=headers, params=params)
        response.raise_for_status()
        return response.json()
    
    def get_price_history(self, symbol: str, period_type: str = "day", 
                         period: int = 10, frequency_type: str = "minute",
                         frequency: int = 5) -> Dict:
        """Get historical price data"""
        url = f"{self.market_data_url}/pricehistory"
        headers = self._get_headers()
        params = {
            "symbol": symbol,
            "periodType": period_type,
            "period": period,
            "frequencyType": frequency_type,
            "frequency": frequency
        }
        response = self.session.get(url, headers=headers, params=params)
        response.raise_for_status()
        return response.json()
    
    def get_option_chain(self, symbol: str, contract_type: str = "ALL",
                        strike_count: int = 10, include_quotes: bool = True) -> Dict:
        """Get option chain for a symbol"""
        url = f"{self.market_data_url}/chains"
        headers = self._get_headers()
        params = {
            "symbol": symbol,
            "contractType": contract_type,
            "strikeCount": strike_count,
            "includeQuotes": str(include_quotes).lower()
        }
        response = self.session.get(url, headers=headers, params=params)
        response.raise_for_status()
        return response.json()
    
    # Trading Methods
    
    def place_order(self, order_payload: Dict) -> str:
        """Place an order"""
        if not self.account_hash:
            raise ValueError("Account not set. Call set_account() first")
        
        endpoint = f"/accounts/{self.account_hash}/orders"
        response = self._make_request('POST', endpoint, json=order_payload)
        
        # Extract order ID from Location header
        location = response.headers.get('Location', '')
        if location:
            order_id = location.split('/')[-1]
            return order_id
        return ""
    
    def cancel_order(self, order_id: str) -> bool:
        """Cancel an order"""
        if not self.account_hash:
            raise ValueError("Account not set")
        
        endpoint = f"/accounts/{self.account_hash}/orders/{order_id}"
        try:
            self._make_request('DELETE', endpoint)
            return True
        except requests.exceptions.RequestException:
            return False
    
    def get_order(self, order_id: str) -> Dict:
        """Get order details"""
        if not self.account_hash:
            raise ValueError("Account not set")
        
        endpoint = f"/accounts/{self.account_hash}/orders/{order_id}"
        response = self._make_request('GET', endpoint)
        return response.json()
    
    def get_orders(self, from_date: Optional[str] = None, 
                   to_date: Optional[str] = None) -> List[Dict]:
        """Get orders for date range"""
        if not self.account_hash:
            raise ValueError("Account not set")
        
        endpoint = f"/accounts/{self.account_hash}/orders"
        params = {}
        if from_date:
            params['fromEnteredTime'] = from_date
        if to_date:
            params['toEnteredTime'] = to_date
        
        response = self._make_request('GET', endpoint, params=params)
        return response.json()
