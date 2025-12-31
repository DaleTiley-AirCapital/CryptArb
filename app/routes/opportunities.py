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

def calculate_direction_stats(ticks, direction_filter=None):
    if direction_filter:
        filtered = [t for t in ticks if t.direction == direction_filter]
    else:
        filtered = ticks
    
    net_edges = [tick.net_edge_bps for tick in filtered if tick.net_edge_bps is not None]
    
    if not net_edges:
        return {
            "count": 0,
            "stats": {"min_net_edge_pct": 0, "max_net_edge_pct": 0, "avg_net_edge_pct": 0, "median_net_edge_pct": 0},
            "distribution": {},
            "opportunities_per_threshold": {}
        }
    
    buckets = {
        "below_0.25%": len([e for e in net_edges if e < 25]),
        "0.25%-0.50%": len([e for e in net_edges if 25 <= e < 50]),
        "0.50%-0.75%": len([e for e in net_edges if 50 <= e < 75]),
        "0.75%-1.00%": len([e for e in net_edges if 75 <= e < 100]),
        "1.00%-1.25%": len([e for e in net_edges if 100 <= e < 125]),
        "1.25%-1.50%": len([e for e in net_edges if 125 <= e < 150]),
        "above_1.50%": len([e for e in net_edges if e >= 150]),
    }
    
    return {
        "count": len(filtered),
        "stats": {
            "min_net_edge_pct": min(net_edges) / 100 if net_edges else 0,
            "max_net_edge_pct": max(net_edges) / 100 if net_edges else 0,
            "avg_net_edge_pct": sum(net_edges) / len(net_edges) / 100 if net_edges else 0,
            "median_net_edge_pct": sorted(net_edges)[len(net_edges)//2] / 100 if net_edges else 0,
        },
        "distribution": buckets,
        "opportunities_per_threshold": {
            "0.25%": len([e for e in net_edges if e >= 25]),
            "0.50%": len([e for e in net_edges if e >= 50]),
            "0.75%": len([e for e in net_edges if e >= 75]),
            "1.00%": len([e for e in net_edges if e >= 100]),
            "1.25%": len([e for e in net_edges if e >= 125]),
            "1.50%": len([e for e in net_edges if e >= 150]),
        }
    }

@router.get("/reports/net-edge-analysis")
def get_net_edge_analysis(
    hours: int = Query(24, ge=1, le=168),
    db: Session = Depends(get_db)
):
    from datetime import datetime, timedelta
    from app.models import ArbTick
    
    cutoff = datetime.utcnow() - timedelta(hours=hours)
    ticks = db.query(ArbTick).filter(
        ArbTick.timestamp >= cutoff
    ).all()
    
    if not ticks:
        return {"message": "No tick data in timeframe. Start the bot to collect data.", "data": None}
    
    all_data = calculate_direction_stats(ticks)
    b2l_data = calculate_direction_stats(ticks, "binance_to_luno")
    l2b_data = calculate_direction_stats(ticks, "luno_to_binance")
    
    if all_data["count"] == 0:
        return {"message": "No net edge data available", "data": None}
    
    return {
        "hours_analyzed": hours,
        "total_opportunities": len(ticks),
        "stats": all_data["stats"],
        "distribution": all_data["distribution"],
        "opportunities_per_threshold": all_data["opportunities_per_threshold"],
        "by_direction": {
            "binance_to_luno": b2l_data,
            "luno_to_binance": l2b_data
        }
    }

@router.get("/reports/net-edge-raw")
def get_net_edge_raw_data(
    hours: int = Query(24, ge=1, le=168),
    limit: int = Query(1000, ge=1, le=10000),
    db: Session = Depends(get_db)
):
    from datetime import datetime, timedelta
    from app.models import ArbTick
    
    cutoff = datetime.utcnow() - timedelta(hours=hours)
    ticks = db.query(ArbTick).filter(
        ArbTick.timestamp >= cutoff
    ).order_by(ArbTick.timestamp.desc()).limit(limit).all()
    
    return {
        "hours_analyzed": hours,
        "count": len(ticks),
        "ticks": [
            {
                "timestamp": tick.timestamp.isoformat() if tick.timestamp else None,
                "direction": tick.direction,
                "luno_bid": tick.luno_bid,
                "luno_ask": tick.luno_ask,
                "luno_last": tick.luno_last,
                "binance_bid": tick.binance_bid,
                "binance_ask": tick.binance_ask,
                "binance_last": tick.binance_last,
                "usd_zar_rate": tick.usd_zar_rate,
                "spread_pct": tick.spread_pct,
                "gross_edge_bps": tick.gross_edge_bps,
                "net_edge_bps": tick.net_edge_bps,
                "is_profitable": tick.is_profitable
            }
            for tick in ticks
        ]
    }
