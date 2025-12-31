from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc, func
from datetime import datetime, timedelta
from app.database import get_db
from app.models import ArbTick

router = APIRouter()


@router.get("/ticks")
def get_ticks(
    hours: int = Query(default=1, ge=1, le=168),
    limit: int = Query(default=1000, ge=1, le=10000),
    db: Session = Depends(get_db)
):
    cutoff = datetime.utcnow() - timedelta(hours=hours)
    
    ticks = db.query(ArbTick).filter(
        ArbTick.timestamp >= cutoff
    ).order_by(desc(ArbTick.timestamp)).limit(limit).all()
    
    return {
        "count": len(ticks),
        "hours": hours,
        "ticks": [t.to_dict() for t in ticks]
    }


@router.get("/ticks/stats")
def get_tick_stats(
    hours: int = Query(default=24, ge=1, le=168),
    db: Session = Depends(get_db)
):
    cutoff = datetime.utcnow() - timedelta(hours=hours)
    
    stats = db.query(
        func.count(ArbTick.id).label('total'),
        func.min(ArbTick.net_edge_bps).label('min_edge'),
        func.max(ArbTick.net_edge_bps).label('max_edge'),
        func.avg(ArbTick.net_edge_bps).label('avg_edge'),
    ).filter(ArbTick.timestamp >= cutoff).first()
    
    profitable_count = db.query(func.count(ArbTick.id)).filter(
        ArbTick.timestamp >= cutoff,
        ArbTick.is_profitable == True
    ).scalar()
    
    total_count = db.query(func.count(ArbTick.id)).scalar()
    
    return {
        "hours": hours,
        "total_ticks": stats[0] if stats else 0,
        "total_ticks_all_time": total_count,
        "profitable_count": profitable_count,
        "min_net_edge_bps": stats[1] if stats else None,
        "max_net_edge_bps": stats[2] if stats else None,
        "avg_net_edge_bps": float(stats[3]) if stats and stats[3] else None,
    }
