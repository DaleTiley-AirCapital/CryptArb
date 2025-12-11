from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import FloatBalance

router = APIRouter()

@router.get("/floats")
async def get_floats(db: Session = Depends(get_db)):
    balances = db.query(FloatBalance).all()
    
    result = {
        "luno": {},
        "binance": {}
    }
    
    for bal in balances:
        result[bal.exchange][bal.currency] = {
            "balance": bal.balance,
            "updated_at": bal.updated_at.isoformat() if bal.updated_at else None
        }
    
    return {
        "floats": result,
        "exchanges": ["luno", "binance"]
    }
