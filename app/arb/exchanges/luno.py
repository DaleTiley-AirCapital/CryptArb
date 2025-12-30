import httpx
import base64
import logging
from typing import Optional
from app.arb.exchanges.base import ExchangeClient, PriceData, OrderResult, Balance
from app.config import config

logger = logging.getLogger(__name__)

class LunoClient(ExchangeClient):
    BASE_URL = "https://api.luno.com/api/1"
    
    def __init__(self):
        self.api_key = config.LUNO_API_KEY
        self.api_secret = config.LUNO_API_SECRET
    
    def _get_auth_header(self) -> dict:
        if not self.api_key or not self.api_secret:
            return {}
        credentials = f"{self.api_key}:{self.api_secret}"
        encoded = base64.b64encode(credentials.encode()).decode()
        return {"Authorization": f"Basic {encoded}"}
    
    async def get_price(self, pair: str = "XBTZAR") -> PriceData:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(f"{self.BASE_URL}/ticker?pair={pair}")
            
            if response.status_code == 429:
                raise Exception("Luno rate limit exceeded (429)")
            elif response.status_code != 200:
                raise Exception(f"Luno API error: {response.status_code} - {response.text[:200]}")
            
            data = response.json()
            
            if "error" in data:
                raise Exception(f"Luno API error: {data['error']}")
            
            return PriceData(
                bid=float(data.get("bid", 0)),
                ask=float(data.get("ask", 0)),
                last=float(data.get("last_trade", 0)),
                exchange="luno",
                pair=pair,
                timestamp=data.get("timestamp")
            )
    
    async def get_balance(self, currency: str = "XBT") -> Balance:
        if not self.api_key:
            return Balance(currency=currency, available=0, reserved=0, total=0)
        
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.BASE_URL}/balance",
                headers=self._get_auth_header()
            )
            data = response.json()
            for bal in data.get("balance", []):
                if bal.get("asset") == currency:
                    return Balance(
                        currency=currency,
                        available=float(bal.get("balance", 0)),
                        reserved=float(bal.get("reserved", 0)),
                        total=float(bal.get("balance", 0)) + float(bal.get("reserved", 0))
                    )
            return Balance(currency=currency, available=0, reserved=0, total=0)
    
    async def place_market_buy(self, pair: str, amount: float) -> OrderResult:
        if not self.api_key:
            return OrderResult(success=False, error="API key not configured")
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.BASE_URL}/marketorder",
                headers=self._get_auth_header(),
                data={
                    "pair": pair,
                    "type": "BUY",
                    "counter_volume": str(amount)
                }
            )
            data = response.json()
            if "order_id" in data:
                return OrderResult(success=True, order_id=data["order_id"])
            return OrderResult(success=False, error=data.get("error", "Unknown error"))
    
    async def place_market_sell(self, pair: str, amount: float) -> OrderResult:
        if not self.api_key:
            return OrderResult(success=False, error="API key not configured")
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.BASE_URL}/marketorder",
                headers=self._get_auth_header(),
                data={
                    "pair": pair,
                    "type": "SELL",
                    "base_volume": str(amount)
                }
            )
            data = response.json()
            if "order_id" in data:
                return OrderResult(success=True, order_id=data["order_id"])
            return OrderResult(success=False, error=data.get("error", "Unknown error"))

luno_client = LunoClient()
