from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.models import Opportunity

router = APIRouter()

def serialize_opportunity(opp):
    return {
        "id": opp.id,
        "timestamp": opp.timestamp.isoformat() if opp.timestamp else None,
        "direction": opp.direction,
        "sell_exchange": opp.sell_exchange,
        "buy_exchange": opp.buy_exchange,
        "sell_price": opp.sell_price,
        "buy_price": opp.buy_price,
        "gross_edge_bps": opp.gross_edge_bps,
        "net_edge_bps": opp.net_edge_bps,
        "size_btc_estimate": opp.size_btc_estimate,
        "size_zar_estimate": opp.size_zar_estimate,
        "was_executed": bool(opp.was_executed),
        "reason_skipped": opp.reason_skipped,
        "luno_price_zar": opp.luno_price_zar,
        "binance_price_usd": opp.binance_price_usd
    }

@router.get("/reports/opportunities")
def get_opportunities(
    limit: int = Query(200, ge=1, le=1000),
    db: Session = Depends(get_db)
):
    opportunities = db.query(Opportunity).order_by(
        Opportunity.timestamp.desc()
    ).limit(limit).all()
    
    return {
        "opportunities": [serialize_opportunity(opp) for opp in opportunities],
        "count": len(opportunities)
    }

@router.get("/reports/missed-opportunities")
def get_missed_opportunities(
    limit: int = Query(200, ge=1, le=1000),
    db: Session = Depends(get_db)
):
    opportunities = db.query(Opportunity).filter(
        Opportunity.was_executed == 0
    ).order_by(
        Opportunity.timestamp.desc()
    ).limit(limit).all()
    
    return {
        "opportunities": [serialize_opportunity(opp) for opp in opportunities],
        "count": len(opportunities)
    }
