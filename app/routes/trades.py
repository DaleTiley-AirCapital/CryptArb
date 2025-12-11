from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc
from app.database import get_db
from app.models import Trade

router = APIRouter()

@router.get("/reports/trades")
async def get_trades(
    limit: int = Query(default=50, le=200),
    offset: int = Query(default=0),
    db: Session = Depends(get_db)
):
    trades = db.query(Trade).order_by(desc(Trade.timestamp)).offset(offset).limit(limit).all()
    total = db.query(Trade).count()
    
    return {
        "trades": [trade.to_dict() for trade in trades],
        "total": total,
        "limit": limit,
        "offset": offset
    }

@router.get("/reports/trades/{trade_id}")
async def get_trade(trade_id: int, db: Session = Depends(get_db)):
    trade = db.query(Trade).filter(Trade.id == trade_id).first()
    if not trade:
        return {"error": "Trade not found"}
    return trade.to_dict()
