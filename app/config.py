import os
from dataclasses import dataclass

@dataclass
class Config:
    LUNO_API_KEY: str = os.environ.get("LUNO_API_KEY", "")
    LUNO_API_SECRET: str = os.environ.get("LUNO_API_SECRET", "")
    BINANCE_API_KEY: str = os.environ.get("BINANCE_API_KEY", "")
    BINANCE_API_SECRET: str = os.environ.get("BINANCE_API_SECRET", "")
    
    DATABASE_URL: str = os.environ.get("DATABASE_URL", "")
    
    SPREAD_THRESHOLD: float = float(os.environ.get("SPREAD_THRESHOLD", "0.5"))
    MAX_TRADE_SIZE_BTC: float = float(os.environ.get("MAX_TRADE_SIZE_BTC", "0.01"))
    MIN_TRADE_SIZE_BTC: float = float(os.environ.get("MIN_TRADE_SIZE_BTC", "0.0001"))
    
    LOOP_INTERVAL_SECONDS: int = int(os.environ.get("LOOP_INTERVAL_SECONDS", "10"))
    
    LUNO_TRADING_FEE: float = float(os.environ.get("LUNO_TRADING_FEE", "0.001"))
    BINANCE_TRADING_FEE: float = float(os.environ.get("BINANCE_TRADING_FEE", "0.001"))
    
    USD_ZAR_RATE: float = float(os.environ.get("USD_ZAR_RATE", "18.5"))

config = Config()
