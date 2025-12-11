from sqlalchemy import Column, Integer, Float, DateTime
from sqlalchemy.sql import func
from app.database import Base

class PnLRecord(Base):
    __tablename__ = "pnl_records"
    
    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime(timezone=True), server_default=func.now())
    daily_pnl = Column(Float, default=0.0)
    cumulative_pnl = Column(Float, default=0.0)
    trade_count = Column(Integer, default=0)
    
    def to_dict(self):
        return {
            "id": self.id,
            "timestamp": self.timestamp.isoformat() if self.timestamp else None,
            "daily_pnl": self.daily_pnl,
            "cumulative_pnl": self.cumulative_pnl,
            "trade_count": self.trade_count
        }
