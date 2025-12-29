from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, DateTime, Text
from app.database import Base

class Opportunity(Base):
    __tablename__ = "opportunities"
    
    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)
    direction = Column(String, nullable=False)
    sell_exchange = Column(String, nullable=False)
    buy_exchange = Column(String, nullable=False)
    sell_price = Column(Float, nullable=False)
    buy_price = Column(Float, nullable=False)
    gross_edge_bps = Column(Float, nullable=False)
    net_edge_bps = Column(Float, nullable=False)
    size_btc_estimate = Column(Float, nullable=True)
    size_zar_estimate = Column(Float, nullable=True)
    was_executed = Column(Integer, default=0)
    reason_skipped = Column(Text, nullable=True)
    luno_price_zar = Column(Float, nullable=True)
    binance_price_usd = Column(Float, nullable=True)
