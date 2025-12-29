import httpx
import logging
import asyncio
from datetime import datetime, timedelta
from typing import Optional

logger = logging.getLogger(__name__)

class FXRateService:
    def __init__(self):
        self._usd_zar_rate: Optional[float] = None
        self._last_fetch: Optional[datetime] = None
        self._cache_duration = timedelta(minutes=5)
        self._fallback_rate = 18.5
    
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
    
    def get_cached_rate(self) -> Optional[float]:
        return self._usd_zar_rate
    
    def get_rate_age_seconds(self) -> Optional[float]:
        if self._last_fetch:
            return (datetime.utcnow() - self._last_fetch).total_seconds()
        return None

fx_service = FXRateService()
