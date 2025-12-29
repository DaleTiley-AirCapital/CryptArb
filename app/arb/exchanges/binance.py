import httpx
import hmac
import hashlib
import time
import logging
from typing import Optional
from app.arb.exchanges.base import ExchangeClient, PriceData, OrderResult, Balance
from app.config import config

logger = logging.getLogger(__name__)

class BinanceClient(ExchangeClient):
    FALLBACK_URLS = [
        "https://api1.binance.com/api/v3",
        "https://api2.binance.com/api/v3",
        "https://api3.binance.com/api/v3",
        "https://api4.binance.com/api/v3",
    ]
    
    def __init__(self):
        self.api_key = config.BINANCE_API_KEY
        self.api_secret = config.BINANCE_API_SECRET
        self.base_url = config.BINANCE_BASE_URL
        self._working_url = None
    
    async def _get_working_url(self) -> str:
        if self._working_url:
            return self._working_url
        
        urls_to_try = [self.base_url] + self.FALLBACK_URLS
        async with httpx.AsyncClient(timeout=5.0) as client:
            for url in urls_to_try:
                try:
                    response = await client.get(f"{url}/ping")
                    if response.status_code == 200:
                        self._working_url = url
                        logger.info(f"Using Binance API endpoint: {url}")
                        return url
                except Exception:
                    continue
        logger.warning("No working Binance API endpoint found, using default")
        return self.base_url
    
    def _sign(self, params: dict) -> str:
        query_string = "&".join([f"{k}={v}" for k, v in params.items()])
        signature = hmac.new(
            self.api_secret.encode(),
            query_string.encode(),
            hashlib.sha256
        ).hexdigest()
        return signature
    
    def _get_headers(self) -> dict:
        if not self.api_key:
            return {}
        return {"X-MBX-APIKEY": self.api_key}
    
    async def get_price(self, pair: str = "BTCUSDT") -> PriceData:
        base_url = await self._get_working_url()
        async with httpx.AsyncClient() as client:
            response = await client.get(f"{base_url}/ticker/bookTicker?symbol={pair}")
            data = response.json()
            
            ticker_response = await client.get(f"{base_url}/ticker/price?symbol={pair}")
            ticker_data = ticker_response.json()
            
            return PriceData(
                bid=float(data.get("bidPrice", 0)),
                ask=float(data.get("askPrice", 0)),
                last=float(ticker_data.get("price", 0)),
                exchange="binance",
                pair=pair
            )
    
    async def get_balance(self, currency: str = "BTC") -> Balance:
        if not self.api_key:
            return Balance(currency=currency, available=0, reserved=0, total=0)
        
        base_url = await self._get_working_url()
        async with httpx.AsyncClient() as client:
            timestamp = int(time.time() * 1000)
            params = {"timestamp": timestamp}
            params["signature"] = self._sign(params)
            
            response = await client.get(
                f"{base_url}/account",
                headers=self._get_headers(),
                params=params
            )
            data = response.json()
            
            for bal in data.get("balances", []):
                if bal.get("asset") == currency:
                    free = float(bal.get("free", 0))
                    locked = float(bal.get("locked", 0))
                    return Balance(
                        currency=currency,
                        available=free,
                        reserved=locked,
                        total=free + locked
                    )
            return Balance(currency=currency, available=0, reserved=0, total=0)
    
    async def place_market_buy(self, pair: str, amount: float) -> OrderResult:
        if not self.api_key:
            return OrderResult(success=False, error="API key not configured")
        
        base_url = await self._get_working_url()
        async with httpx.AsyncClient() as client:
            timestamp = int(time.time() * 1000)
            params = {
                "symbol": pair,
                "side": "BUY",
                "type": "MARKET",
                "quantity": str(amount),
                "timestamp": timestamp
            }
            params["signature"] = self._sign(params)
            
            response = await client.post(
                f"{base_url}/order",
                headers=self._get_headers(),
                params=params
            )
            data = response.json()
            
            if "orderId" in data:
                return OrderResult(
                    success=True,
                    order_id=str(data["orderId"]),
                    filled_amount=float(data.get("executedQty", 0)),
                    filled_price=float(data.get("fills", [{}])[0].get("price", 0)) if data.get("fills") else None
                )
            return OrderResult(success=False, error=data.get("msg", "Unknown error"))
    
    async def place_market_sell(self, pair: str, amount: float) -> OrderResult:
        if not self.api_key:
            return OrderResult(success=False, error="API key not configured")
        
        base_url = await self._get_working_url()
        async with httpx.AsyncClient() as client:
            timestamp = int(time.time() * 1000)
            params = {
                "symbol": pair,
                "side": "SELL",
                "type": "MARKET",
                "quantity": str(amount),
                "timestamp": timestamp
            }
            params["signature"] = self._sign(params)
            
            response = await client.post(
                f"{base_url}/order",
                headers=self._get_headers(),
                params=params
            )
            data = response.json()
            
            if "orderId" in data:
                return OrderResult(
                    success=True,
                    order_id=str(data["orderId"]),
                    filled_amount=float(data.get("executedQty", 0)),
                    filled_price=float(data.get("fills", [{}])[0].get("price", 0)) if data.get("fills") else None
                )
            return OrderResult(success=False, error=data.get("msg", "Unknown error"))

binance_client = BinanceClient()
