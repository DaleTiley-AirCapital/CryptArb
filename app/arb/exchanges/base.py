from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Optional

@dataclass
class PriceData:
    bid: float
    ask: float
    last: float
    exchange: str
    pair: str
    timestamp: Optional[str] = None

@dataclass
class OrderResult:
    success: bool
    order_id: Optional[str] = None
    filled_amount: Optional[float] = None
    filled_price: Optional[float] = None
    error: Optional[str] = None

@dataclass
class Balance:
    currency: str
    available: float
    reserved: float
    total: float

class ExchangeClient(ABC):
    @abstractmethod
    async def get_price(self, pair: str) -> PriceData:
        pass
    
    @abstractmethod
    async def get_balance(self, currency: str) -> Balance:
        pass
    
    @abstractmethod
    async def place_market_buy(self, pair: str, amount: float) -> OrderResult:
        pass
    
    @abstractmethod
    async def place_market_sell(self, pair: str, amount: float) -> OrderResult:
        pass
