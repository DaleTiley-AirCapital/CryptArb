from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, Text
from app.database import Base

class ConfigHistory(Base):
    __tablename__ = "config_history"
    
    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)
    config_json = Column(Text, nullable=False)
    updated_by = Column(String, default="dashboard")
    change_description = Column(Text, nullable=True)
