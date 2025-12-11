from sqlalchemy import Column, Integer, String, Float, DateTime, Enum
from sqlalchemy.sql import func
from app.database import Base
import enum

class TradeDirection(str, enum.Enum):
    LUNO_TO_BINANCE = "luno_to_binance"
    BINANCE_TO_LUNO = "binance_to_luno"

class Trade(Base):
    __tablename__ = "trades"
    
    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime(timezone=True), server_default=func.now())
    direction = Column(String, nullable=False)
    btc_amount = Column(Float, nullable=False)
    buy_price = Column(Float, nullable=False)
    sell_price = Column(Float, nullable=False)
    spread_percent = Column(Float, nullable=False)
    profit_usd = Column(Float, nullable=False)
    buy_exchange = Column(String, nullable=False)
    sell_exchange = Column(String, nullable=False)
    status = Column(String, default="completed")
    
    def to_dict(self):
        return {
            "id": self.id,
            "timestamp": self.timestamp.isoformat() if self.timestamp else None,
            "direction": self.direction,
            "btc_amount": self.btc_amount,
            "buy_price": self.buy_price,
            "sell_price": self.sell_price,
            "spread_percent": self.spread_percent,
            "profit_usd": self.profit_usd,
            "buy_exchange": self.buy_exchange,
            "sell_exchange": self.sell_exchange,
            "status": self.status
        }
