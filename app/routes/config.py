import json
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import Optional
from sqlalchemy.orm import Session
from app.config import config
from app.database import get_db
from app.models import ConfigHistory
from app.arb.fast_loop import fast_arb_loop

router = APIRouter()

class ConfigUpdate(BaseModel):
    mode: Optional[str] = None
    spread_threshold: Optional[float] = None
    min_net_edge_bps: Optional[float] = None
    max_trade_size_btc: Optional[float] = None
    min_trade_size_btc: Optional[float] = None
    max_trade_zar: Optional[float] = None
    loop_interval_seconds: Optional[int] = None
    slippage_bps_buffer: Optional[float] = None
    min_remaining_zar_luno: Optional[float] = None
    min_remaining_btc_binance: Optional[float] = None
    usd_zar_rate: Optional[float] = None

@router.get("/config")
async def get_config():
    return {
        **config.to_dict(),
        "luno_api_configured": bool(config.LUNO_API_KEY),
        "binance_api_configured": bool(config.BINANCE_API_KEY)
    }

@router.post("/config")
async def update_config(update: ConfigUpdate, db: Session = Depends(get_db)):
    changes = []
    
    if update.mode is not None and update.mode in ["paper", "live"]:
        config.set("MODE", update.mode)
        changes.append(f"mode={update.mode}")
    if update.spread_threshold is not None:
        config.set("SPREAD_THRESHOLD", update.spread_threshold)
        changes.append(f"spread_threshold={update.spread_threshold}")
    if update.min_net_edge_bps is not None:
        config.set("MIN_NET_EDGE_BPS", update.min_net_edge_bps)
        changes.append(f"min_net_edge_bps={update.min_net_edge_bps}")
    if update.max_trade_size_btc is not None:
        config.set("MAX_TRADE_SIZE_BTC", update.max_trade_size_btc)
        changes.append(f"max_trade_size_btc={update.max_trade_size_btc}")
    if update.min_trade_size_btc is not None:
        config.set("MIN_TRADE_SIZE_BTC", update.min_trade_size_btc)
        changes.append(f"min_trade_size_btc={update.min_trade_size_btc}")
    if update.max_trade_zar is not None:
        config.set("MAX_TRADE_ZAR", update.max_trade_zar)
        changes.append(f"max_trade_zar={update.max_trade_zar}")
    if update.loop_interval_seconds is not None:
        config.set("LOOP_INTERVAL_SECONDS", update.loop_interval_seconds)
        changes.append(f"loop_interval_seconds={update.loop_interval_seconds}")
    if update.slippage_bps_buffer is not None:
        config.set("SLIPPAGE_BPS_BUFFER", update.slippage_bps_buffer)
        changes.append(f"slippage_bps_buffer={update.slippage_bps_buffer}")
    if update.min_remaining_zar_luno is not None:
        config.set("MIN_REMAINING_ZAR_LUNO", update.min_remaining_zar_luno)
        changes.append(f"min_remaining_zar_luno={update.min_remaining_zar_luno}")
    if update.min_remaining_btc_binance is not None:
        config.set("MIN_REMAINING_BTC_BINANCE", update.min_remaining_btc_binance)
        changes.append(f"min_remaining_btc_binance={update.min_remaining_btc_binance}")
    if update.usd_zar_rate is not None:
        config.set("USD_ZAR_RATE", update.usd_zar_rate)
        changes.append(f"usd_zar_rate={update.usd_zar_rate}")
    
    if changes:
        history = ConfigHistory(
            config_json=json.dumps(config.to_dict()),
            updated_by="dashboard",
            change_description=", ".join(changes)
        )
        db.add(history)
        db.commit()
    
    return {"success": True, "config": config.to_dict()}

@router.post("/reset-paper-floats")
async def reset_paper_floats():
    fast_arb_loop.reset_paper_floats()
    return {"success": True, "message": "Paper floats reset successfully"}
