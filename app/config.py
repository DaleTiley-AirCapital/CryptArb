import os
from dataclasses import dataclass, field
from typing import Literal

@dataclass
class Config:
    LUNO_API_KEY: str = os.environ.get("LUNO_API_KEY", "")
    LUNO_API_SECRET: str = os.environ.get("LUNO_API_SECRET", "")
    BINANCE_API_KEY: str = os.environ.get("BINANCE_API_KEY", "")
    BINANCE_API_SECRET: str = os.environ.get("BINANCE_API_SECRET", "")
    BINANCE_BASE_URL: str = os.environ.get("BINANCE_BASE_URL", "https://api.binance.com/api/v3")
    
    DATABASE_URL: str = os.environ.get("DATABASE_URL", "")
    
    MODE: str = os.environ.get("MODE", "paper")
    
    SPREAD_THRESHOLD: float = float(os.environ.get("SPREAD_THRESHOLD", "0.5"))
    MIN_NET_EDGE_BPS: float = float(os.environ.get("MIN_NET_EDGE_BPS", "40"))
    MAX_TRADE_SIZE_BTC: float = float(os.environ.get("MAX_TRADE_SIZE_BTC", "0.01"))
    MIN_TRADE_SIZE_BTC: float = float(os.environ.get("MIN_TRADE_SIZE_BTC", "0.0001"))
    MAX_TRADE_ZAR: float = float(os.environ.get("MAX_TRADE_ZAR", "5000"))
    
    LOOP_INTERVAL_SECONDS: int = int(os.environ.get("LOOP_INTERVAL_SECONDS", "10"))
    POLL_INTERVAL_MS: int = int(os.environ.get("POLL_INTERVAL_MS", "750"))
    
    LUNO_TRADING_FEE: float = float(os.environ.get("LUNO_TRADING_FEE", "0.001"))
    BINANCE_TRADING_FEE: float = float(os.environ.get("BINANCE_TRADING_FEE", "0.001"))
    SLIPPAGE_BPS_BUFFER: float = float(os.environ.get("SLIPPAGE_BPS_BUFFER", "10"))
    
    MIN_REMAINING_ZAR_LUNO: float = float(os.environ.get("MIN_REMAINING_ZAR_LUNO", "1000"))
    MIN_REMAINING_BTC_BINANCE: float = float(os.environ.get("MIN_REMAINING_BTC_BINANCE", "0.001"))
    
    USD_ZAR_RATE: float = float(os.environ.get("USD_ZAR_RATE", "17.0"))
    
    ERROR_STOP_COUNT: int = int(os.environ.get("ERROR_STOP_COUNT", "5"))
    
    _runtime_overrides: dict = field(default_factory=dict)
    
    def get(self, key: str):
        if key in self._runtime_overrides:
            return self._runtime_overrides[key]
        return getattr(self, key, None)
    
    def set(self, key: str, value):
        self._runtime_overrides[key] = value
    
    def is_paper_mode(self) -> bool:
        mode = self._runtime_overrides.get("MODE", self.MODE)
        return mode.lower() == "paper"
    
    def to_dict(self) -> dict:
        return {
            "mode": self._runtime_overrides.get("MODE", self.MODE),
            "spread_threshold": self._runtime_overrides.get("SPREAD_THRESHOLD", self.SPREAD_THRESHOLD),
            "min_net_edge_bps": self._runtime_overrides.get("MIN_NET_EDGE_BPS", self.MIN_NET_EDGE_BPS),
            "max_trade_size_btc": self._runtime_overrides.get("MAX_TRADE_SIZE_BTC", self.MAX_TRADE_SIZE_BTC),
            "min_trade_size_btc": self._runtime_overrides.get("MIN_TRADE_SIZE_BTC", self.MIN_TRADE_SIZE_BTC),
            "max_trade_zar": self._runtime_overrides.get("MAX_TRADE_ZAR", self.MAX_TRADE_ZAR),
            "loop_interval_seconds": self._runtime_overrides.get("LOOP_INTERVAL_SECONDS", self.LOOP_INTERVAL_SECONDS),
            "luno_trading_fee": self._runtime_overrides.get("LUNO_TRADING_FEE", self.LUNO_TRADING_FEE),
            "binance_trading_fee": self._runtime_overrides.get("BINANCE_TRADING_FEE", self.BINANCE_TRADING_FEE),
            "slippage_bps_buffer": self._runtime_overrides.get("SLIPPAGE_BPS_BUFFER", self.SLIPPAGE_BPS_BUFFER),
            "min_remaining_zar_luno": self._runtime_overrides.get("MIN_REMAINING_ZAR_LUNO", self.MIN_REMAINING_ZAR_LUNO),
            "min_remaining_btc_binance": self._runtime_overrides.get("MIN_REMAINING_BTC_BINANCE", self.MIN_REMAINING_BTC_BINANCE),
            "usd_zar_rate": self._runtime_overrides.get("USD_ZAR_RATE", self.USD_ZAR_RATE),
            "error_stop_count": self._runtime_overrides.get("ERROR_STOP_COUNT", self.ERROR_STOP_COUNT)
        }

config = Config()
