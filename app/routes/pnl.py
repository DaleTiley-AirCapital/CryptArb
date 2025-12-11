from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, desc
from datetime import datetime, timedelta
from app.database import get_db
from app.models import Trade, PnLRecord
from app.arb.loop import arb_loop

router = APIRouter()

@router.get("/reports/pnl")
async def get_pnl(
    days: int = Query(default=30, le=365),
    db: Session = Depends(get_db)
):
    start_date = datetime.utcnow() - timedelta(days=days)
    
    trades = db.query(Trade).filter(Trade.timestamp >= start_date).all()
    
    total_profit = sum(t.profit_usd for t in trades)
    trade_count = len(trades)
    
    daily_pnl = db.query(
        func.date(Trade.timestamp).label("date"),
        func.sum(Trade.profit_usd).label("profit"),
        func.count(Trade.id).label("trades")
    ).filter(
        Trade.timestamp >= start_date
    ).group_by(
        func.date(Trade.timestamp)
    ).order_by(
        func.date(Trade.timestamp)
    ).all()
    
    return {
        "period_days": days,
        "total_profit_usd": total_profit,
        "total_trades": trade_count,
        "average_profit_per_trade": total_profit / trade_count if trade_count > 0 else 0,
        "daily_breakdown": [
            {
                "date": str(row.date),
                "profit_usd": row.profit,
                "trade_count": row.trades
            }
            for row in daily_pnl
        ],
        "current_session": {
            "total_pnl": arb_loop.total_pnl,
            "total_trades": arb_loop.total_trades
        }
    }

@router.get("/reports/summary")
async def get_summary(db: Session = Depends(get_db)):
    total_trades = db.query(Trade).count()
    total_profit = db.query(func.sum(Trade.profit_usd)).scalar() or 0
    
    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    today_trades = db.query(Trade).filter(Trade.timestamp >= today_start).all()
    today_profit = sum(t.profit_usd for t in today_trades)
    
    last_trade = db.query(Trade).order_by(desc(Trade.timestamp)).first()
    
    return {
        "all_time": {
            "total_trades": total_trades,
            "total_profit_usd": total_profit
        },
        "today": {
            "trade_count": len(today_trades),
            "profit_usd": today_profit
        },
        "last_trade": last_trade.to_dict() if last_trade else None,
        "bot_status": arb_loop.get_status()
    }
