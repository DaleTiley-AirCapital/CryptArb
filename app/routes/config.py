from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional
from app.config import config

router = APIRouter()

class ConfigUpdate(BaseModel):
    spread_threshold: Optional[float] = None
    max_trade_size_btc: Optional[float] = None
    min_trade_size_btc: Optional[float] = None
    loop_interval_seconds: Optional[int] = None
    usd_zar_rate: Optional[float] = None

@router.get("/config")
async def get_config():
    return {
        "spread_threshold": config.SPREAD_THRESHOLD,
        "max_trade_size_btc": config.MAX_TRADE_SIZE_BTC,
        "min_trade_size_btc": config.MIN_TRADE_SIZE_BTC,
        "loop_interval_seconds": config.LOOP_INTERVAL_SECONDS,
        "usd_zar_rate": config.USD_ZAR_RATE,
        "luno_trading_fee": config.LUNO_TRADING_FEE,
        "binance_trading_fee": config.BINANCE_TRADING_FEE,
        "luno_api_configured": bool(config.LUNO_API_KEY),
        "binance_api_configured": bool(config.BINANCE_API_KEY)
    }

@router.post("/config")
async def update_config(update: ConfigUpdate):
    if update.spread_threshold is not None:
        config.SPREAD_THRESHOLD = update.spread_threshold
    if update.max_trade_size_btc is not None:
        config.MAX_TRADE_SIZE_BTC = update.max_trade_size_btc
    if update.min_trade_size_btc is not None:
        config.MIN_TRADE_SIZE_BTC = update.min_trade_size_btc
    if update.loop_interval_seconds is not None:
        config.LOOP_INTERVAL_SECONDS = update.loop_interval_seconds
    if update.usd_zar_rate is not None:
        config.USD_ZAR_RATE = update.usd_zar_rate
    
    return {"success": True, "config": await get_config()}
