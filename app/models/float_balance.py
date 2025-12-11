from sqlalchemy import Column, Integer, String, Float, DateTime
from sqlalchemy.sql import func
from app.database import Base

class FloatBalance(Base):
    __tablename__ = "float_balances"
    
    id = Column(Integer, primary_key=True, index=True)
    exchange = Column(String, nullable=False)
    currency = Column(String, nullable=False)
    balance = Column(Float, nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    def to_dict(self):
        return {
            "id": self.id,
            "exchange": self.exchange,
            "currency": self.currency,
            "balance": self.balance,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }
