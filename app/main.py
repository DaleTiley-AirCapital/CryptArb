import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database import init_db
from app.arb.fast_loop import fast_arb_loop
from app.routes import status, trades, pnl, floats, config, opportunities, ticks

@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    fast_arb_loop.start()
    yield
    fast_arb_loop.stop()

app = FastAPI(
    title="Crypto Arbitrage Bot API",
    description="Market-neutral arbitrage bot for BTC between Luno and Binance",
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(status.router, tags=["Status"])
app.include_router(trades.router, tags=["Trades"])
app.include_router(pnl.router, tags=["PnL"])
app.include_router(floats.router, tags=["Floats"])
app.include_router(config.router, tags=["Config"])
app.include_router(opportunities.router, tags=["Opportunities"])
app.include_router(ticks.router, tags=["Ticks"])

@app.get("/")
async def root():
    return {
        "name": "Crypto Arbitrage Bot API",
        "version": "1.0.0",
        "endpoints": [
            "GET /status",
            "POST /start",
            "POST /stop",
            "GET /reports/trades",
            "GET /reports/pnl",
            "GET /reports/summary",
            "GET /reports/opportunities",
            "GET /floats",
            "GET /config",
            "POST /config",
            "GET /ticks",
            "GET /ticks/stats"
        ]
    }

@app.get("/health")
async def health():
    return {"status": "healthy"}
