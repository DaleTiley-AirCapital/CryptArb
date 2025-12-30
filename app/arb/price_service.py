import asyncio
import json
import logging
import websockets
from datetime import datetime
from typing import Optional, Dict, Any
from dataclasses import dataclass, field
from app.arb.exchanges.base import PriceData
from app.arb.exchanges.luno import luno_client
from app.config import config

logger = logging.getLogger(__name__)

@dataclass
class PriceSnapshot:
    luno: Optional[PriceData] = None
    binance: Optional[PriceData] = None
    luno_updated: Optional[datetime] = None
    binance_updated: Optional[datetime] = None
    
    def is_fresh(self, max_age_seconds: float = 5.0) -> bool:
        now = datetime.utcnow()
        if not self.luno_updated or not self.binance_updated:
            return False
        luno_age = (now - self.luno_updated).total_seconds()
        binance_age = (now - self.binance_updated).total_seconds()
        return luno_age < max_age_seconds and binance_age < max_age_seconds


class PriceService:
    def __init__(self):
        self.snapshot = PriceSnapshot()
        self.running = False
        self._binance_ws_task: Optional[asyncio.Task] = None
        self._luno_poll_task: Optional[asyncio.Task] = None
        self._ws_connected = False
        self._luno_poll_interval = 1.0
        self._binance_ws_url = "wss://stream.binance.com:9443/ws/btcusdt@bookTicker"
        self._reconnect_delay = 1.0
        self._max_reconnect_delay = 30.0
        self._stats = {
            "binance_updates": 0,
            "luno_updates": 0,
            "ws_reconnects": 0,
            "luno_errors": 0,
        }
    
    async def start(self):
        if self.running:
            return
        
        self.running = True
        logger.info("Price service starting...")
        
        self._binance_ws_task = asyncio.create_task(self._binance_websocket_loop())
        self._luno_poll_task = asyncio.create_task(self._luno_polling_loop())
        
        logger.info("Price service started - WebSocket + REST polling active")
    
    async def stop(self):
        self.running = False
        
        if self._binance_ws_task:
            self._binance_ws_task.cancel()
            try:
                await self._binance_ws_task
            except asyncio.CancelledError:
                pass
        
        if self._luno_poll_task:
            self._luno_poll_task.cancel()
            try:
                await self._luno_poll_task
            except asyncio.CancelledError:
                pass
        
        logger.info("Price service stopped")
    
    async def _binance_websocket_loop(self):
        reconnect_delay = self._reconnect_delay
        
        while self.running:
            try:
                logger.info(f"Connecting to Binance WebSocket: {self._binance_ws_url}")
                
                async with websockets.connect(
                    self._binance_ws_url,
                    ping_interval=20,
                    ping_timeout=10,
                    close_timeout=5
                ) as ws:
                    self._ws_connected = True
                    reconnect_delay = self._reconnect_delay
                    logger.info("Binance WebSocket connected - receiving real-time prices")
                    
                    async for message in ws:
                        if not self.running:
                            break
                        
                        try:
                            data = json.loads(message)
                            bid = float(data.get("b", 0))
                            ask = float(data.get("a", 0))
                            
                            self.snapshot.binance = PriceData(
                                bid=bid,
                                ask=ask,
                                last=(bid + ask) / 2,
                                exchange="binance",
                                pair="BTCUSDT"
                            )
                            self.snapshot.binance_updated = datetime.utcnow()
                            self._stats["binance_updates"] += 1
                            
                        except Exception as e:
                            logger.warning(f"Error parsing Binance WS message: {e}")
                            
            except websockets.exceptions.ConnectionClosed as e:
                self._ws_connected = False
                logger.warning(f"Binance WebSocket closed: {e}")
            except Exception as e:
                self._ws_connected = False
                logger.error(f"Binance WebSocket error: {e}")
            
            if self.running:
                self._stats["ws_reconnects"] += 1
                logger.info(f"Reconnecting to Binance WebSocket in {reconnect_delay}s...")
                await asyncio.sleep(reconnect_delay)
                reconnect_delay = min(reconnect_delay * 2, self._max_reconnect_delay)
    
    async def _luno_polling_loop(self):
        while self.running:
            try:
                start = datetime.utcnow()
                price = await luno_client.get_price("XBTZAR")
                
                if price and price.last > 0:
                    self.snapshot.luno = price
                    self.snapshot.luno_updated = datetime.utcnow()
                    self._stats["luno_updates"] += 1
                    
                    fetch_time = (datetime.utcnow() - start).total_seconds() * 1000
                    if self._stats["luno_updates"] % 60 == 0:
                        logger.debug(f"Luno price fetched in {fetch_time:.0f}ms: {price.last:.0f} ZAR")
                        
            except Exception as e:
                self._stats["luno_errors"] += 1
                logger.warning(f"Luno polling error: {e}")
            
            await asyncio.sleep(self._luno_poll_interval)
    
    def get_prices(self) -> tuple[Optional[PriceData], Optional[PriceData]]:
        return self.snapshot.luno, self.snapshot.binance
    
    def get_snapshot(self) -> PriceSnapshot:
        return self.snapshot
    
    def get_stats(self) -> Dict[str, Any]:
        return {
            **self._stats,
            "ws_connected": self._ws_connected,
            "luno_age_ms": (datetime.utcnow() - self.snapshot.luno_updated).total_seconds() * 1000 if self.snapshot.luno_updated else None,
            "binance_age_ms": (datetime.utcnow() - self.snapshot.binance_updated).total_seconds() * 1000 if self.snapshot.binance_updated else None,
        }
    
    def is_ready(self) -> bool:
        return self.snapshot.luno is not None and self.snapshot.binance is not None

price_service = PriceService()
