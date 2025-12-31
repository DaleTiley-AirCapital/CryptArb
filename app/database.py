import os
import logging
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

logger = logging.getLogger(__name__)

DATABASE_URL = os.environ.get("DATABASE_URL", "")
CLEAR_DB_ON_STARTUP = os.environ.get("CLEAR_DB_ON_STARTUP", "false").lower() == "true"

if not DATABASE_URL:
    logger.warning("DATABASE_URL not set. Using SQLite for development.")
    DATABASE_URL = "sqlite:///./crypto_arb.db"
    engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
else:
    engine = create_engine(DATABASE_URL, pool_pre_ping=True, pool_recycle=300)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def clear_all_tables():
    from app.models import Trade, FloatBalance, PnLRecord, Opportunity, ConfigHistory
    db = SessionLocal()
    try:
        db.query(Trade).delete()
        db.query(FloatBalance).delete()
        db.query(PnLRecord).delete()
        db.query(Opportunity).delete()
        db.query(ConfigHistory).delete()
        db.commit()
        logger.info("All database tables cleared successfully")
    except Exception as e:
        db.rollback()
        logger.error(f"Error clearing database tables: {e}")
    finally:
        db.close()

def init_db():
    from app.models import trade, float_balance, pnl
    Base.metadata.create_all(bind=engine)
    
    if CLEAR_DB_ON_STARTUP:
        logger.warning("CLEAR_DB_ON_STARTUP is enabled - clearing all tables")
        clear_all_tables()
