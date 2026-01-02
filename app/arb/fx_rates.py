import httpx
import logging
import asyncio
from datetime import datetime, timedelta
from typing import Optional

logger = logging.getLogger(__name__)

class FXRateService:
    def __init__(self):
        self._usd_zar_rate: Optional[float] = None
        self._usdt_usd_rate: Optional[float] = None
        self._last_fetch: Optional[datetime] = None
        self._last_usdt_fetch: Optional[datetime] = None
        self._cache_duration = timedelta(minutes=5)
        self._usdt_cache_duration = timedelta(minutes=1)
        self._fallback_rate = 17.0
        self._fallback_usdt_rate = 1.0
    
    async def get_usd_zar_rate(self) -> float:
        if self._usd_zar_rate and self._last_fetch:
            if datetime.utcnow() - self._last_fetch < self._cache_duration:
                return self._usd_zar_rate
        
        rate = await self._fetch_live_rate()
        if rate:
            self._usd_zar_rate = rate
            self._last_fetch = datetime.utcnow()
            return rate
        
        if self._usd_zar_rate:
            logger.warning(f"Using cached USD/ZAR rate: {self._usd_zar_rate}")
            return self._usd_zar_rate
        
        logger.warning(f"Using fallback USD/ZAR rate: {self._fallback_rate}")
        return self._fallback_rate
    
    async def _fetch_live_rate(self) -> Optional[float]:
        apis = [
            self._fetch_from_exchangerate_api,
            self._fetch_from_frankfurter,
            self._fetch_from_fixer_free,
        ]
        
        for fetch_func in apis:
            try:
                rate = await fetch_func()
                if rate and rate > 10 and rate < 30:
                    logger.info(f"Live USD/ZAR rate fetched: {rate:.4f}")
                    return rate
            except Exception as e:
                logger.debug(f"FX API failed: {e}")
                continue
        
        return None
    
    async def _fetch_from_exchangerate_api(self) -> Optional[float]:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(
                "https://api.exchangerate-api.com/v4/latest/USD"
            )
            if response.status_code == 200:
                data = response.json()
                return float(data.get("rates", {}).get("ZAR", 0))
        return None
    
    async def _fetch_from_frankfurter(self) -> Optional[float]:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(
                "https://api.frankfurter.app/latest?from=USD&to=ZAR"
            )
            if response.status_code == 200:
                data = response.json()
                return float(data.get("rates", {}).get("ZAR", 0))
        return None
    
    async def _fetch_from_fixer_free(self) -> Optional[float]:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(
                "https://open.er-api.com/v6/latest/USD"
            )
            if response.status_code == 200:
                data = response.json()
                return float(data.get("rates", {}).get("ZAR", 0))
        return None
    
    async def get_usdt_usd_rate(self) -> float:
        """Fetch USDT/USD rate from Binance to account for USDT depeg from USD."""
        if self._usdt_usd_rate and self._last_usdt_fetch:
            if datetime.utcnow() - self._last_usdt_fetch < self._usdt_cache_duration:
                return self._usdt_usd_rate
        
        rate = await self._fetch_usdt_usd_from_binance()
        if rate:
            self._usdt_usd_rate = rate
            self._last_usdt_fetch = datetime.utcnow()
            return rate
        
        if self._usdt_usd_rate:
            logger.warning(f"Using cached USDT/USD rate: {self._usdt_usd_rate}")
            return self._usdt_usd_rate
        
        logger.warning(f"Using fallback USDT/USD rate: {self._fallback_usdt_rate}")
        return self._fallback_usdt_rate
    
    async def _fetch_usdt_usd_from_binance(self) -> Optional[float]:
        """Fetch USDT/TUSD or USDT/BUSD price from Binance as proxy for USDT/USD."""
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.get(
                    "https://api.binance.com/api/v3/ticker/price?symbol=USDCUSDT"
                )
                if response.status_code == 200:
                    data = response.json()
                    usdc_usdt = float(data.get("price", 0))
                    if usdc_usdt > 0:
                        usdt_usd = 1.0 / usdc_usdt
                        logger.info(f"Live USDT/USD rate from Binance USDC/USDT: {usdt_usd:.6f}")
                        return usdt_usd
        except Exception as e:
            logger.debug(f"Binance USDC/USDT API failed: {e}")
        
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.get(
                    "https://api.binance.com/api/v3/ticker/price?symbol=FDUSDUSDT"
                )
                if response.status_code == 200:
                    data = response.json()
                    fdusd_usdt = float(data.get("price", 0))
                    if fdusd_usdt > 0:
                        usdt_usd = 1.0 / fdusd_usdt
                        logger.info(f"Live USDT/USD rate from Binance FDUSD/USDT: {usdt_usd:.6f}")
                        return usdt_usd
        except Exception as e:
            logger.debug(f"Binance FDUSD/USDT API failed: {e}")
        
        return None
    
    async def get_usdt_zar_rate(self) -> float:
        """Get effective USDT to ZAR rate (combines USD/ZAR and USDT/USD)."""
        usd_zar = await self.get_usd_zar_rate()
        usdt_usd = await self.get_usdt_usd_rate()
        usdt_zar = usd_zar * usdt_usd
        return usdt_zar
    
    def get_cached_rate(self) -> Optional[float]:
        return self._usd_zar_rate
    
    def get_cached_usdt_usd_rate(self) -> Optional[float]:
        return self._usdt_usd_rate
    
    def get_rate_age_seconds(self) -> Optional[float]:
        if self._last_fetch:
            return (datetime.utcnow() - self._last_fetch).total_seconds()
        return None

fx_service = FXRateService()
