from sqlalchemy import Column, Integer, Float, DateTime, Boolean, String
from sqlalchemy.sql import func
from app.database import Base


class ArbTick(Base):
    __tablename__ = "arb_ticks"
    
    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    
    luno_bid = Column(Float, nullable=False)
    luno_ask = Column(Float, nullable=False)
    luno_last = Column(Float, nullable=False)
    
    binance_bid = Column(Float, nullable=False)
    binance_ask = Column(Float, nullable=False)
    binance_last = Column(Float, nullable=False)
    
    usd_zar_rate = Column(Float, nullable=False)
    
    spread_pct = Column(Float, nullable=False)
    gross_edge_bps = Column(Float, nullable=False)
    net_edge_bps = Column(Float, nullable=False, index=True)
    
    direction = Column(String, nullable=False)
    is_profitable = Column(Boolean, default=False)
    
    min_edge_threshold_bps = Column(Integer, nullable=True)
    slippage_bps = Column(Integer, nullable=True)
    fee_bps = Column(Integer, nullable=True)
    
    def to_dict(self):
        return {
            "id": self.id,
            "timestamp": self.timestamp.isoformat() if self.timestamp else None,
            "luno_bid": self.luno_bid,
            "luno_ask": self.luno_ask,
            "luno_last": self.luno_last,
            "binance_bid": self.binance_bid,
            "binance_ask": self.binance_ask,
            "binance_last": self.binance_last,
            "usd_zar_rate": self.usd_zar_rate,
            "spread_pct": self.spread_pct,
            "gross_edge_bps": self.gross_edge_bps,
            "net_edge_bps": self.net_edge_bps,
            "direction": self.direction,
            "is_profitable": self.is_profitable,
        }
