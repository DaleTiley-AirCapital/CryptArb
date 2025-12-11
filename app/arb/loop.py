import asyncio
import logging
from datetime import datetime
from typing import Optional
from app.arb.exchanges.luno import luno_client
from app.arb.exchanges.binance import binance_client
from app.arb.exchanges.base import PriceData
from app.config import config
from app.database import SessionLocal
from app.models import Trade, FloatBalance

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class ArbitrageLoop:
    def __init__(self):
        self.running = False
        self.last_check = None
        self.last_opportunity = None
        self.total_trades = 0
        self.total_pnl = 0.0
        self.task: Optional[asyncio.Task] = None
    
    async def get_prices(self) -> tuple[PriceData, PriceData]:
        luno_price = await luno_client.get_price("XBTZAR")
        binance_price = await binance_client.get_price("BTCUSDT")
        return luno_price, binance_price
    
    def calculate_spread(self, luno_price: PriceData, binance_price: PriceData) -> dict:
        if luno_price.last == 0 or binance_price.last == 0:
            return {
                "direction": "unknown",
                "spread_percent": 0,
                "net_spread": 0,
                "buy_exchange": None,
                "sell_exchange": None,
                "buy_price": 0,
                "sell_price": 0,
                "luno_usd": 0,
                "binance_usd": 0,
                "is_profitable": False,
                "error": "Unable to fetch prices from one or both exchanges"
            }
        
        luno_usd = luno_price.last / config.USD_ZAR_RATE
        binance_usd = binance_price.last
        
        if binance_usd > luno_usd:
            spread_percent = ((binance_usd - luno_usd) / luno_usd) * 100
            direction = "luno_to_binance"
            buy_exchange = "luno"
            sell_exchange = "binance"
            buy_price = luno_price.ask
            sell_price = binance_price.bid
        else:
            spread_percent = ((luno_usd - binance_usd) / binance_usd) * 100
            direction = "binance_to_luno"
            buy_exchange = "binance"
            sell_exchange = "luno"
            buy_price = binance_price.ask
            sell_price = luno_price.bid
        
        total_fees = (config.LUNO_TRADING_FEE + config.BINANCE_TRADING_FEE) * 100
        net_spread = spread_percent - total_fees
        
        return {
            "direction": direction,
            "spread_percent": spread_percent,
            "net_spread": net_spread,
            "buy_exchange": buy_exchange,
            "sell_exchange": sell_exchange,
            "buy_price": buy_price,
            "sell_price": sell_price,
            "luno_usd": luno_usd,
            "binance_usd": binance_usd,
            "is_profitable": net_spread >= config.SPREAD_THRESHOLD
        }
    
    async def execute_hedged_trade(self, spread_info: dict, btc_amount: float) -> Optional[Trade]:
        logger.info(f"Executing hedged trade: {spread_info['direction']} for {btc_amount} BTC")
        
        if spread_info["direction"] == "luno_to_binance":
            buy_result = await luno_client.place_market_buy("XBTZAR", btc_amount * spread_info["buy_price"])
            sell_result = await binance_client.place_market_sell("BTCUSDT", btc_amount)
        else:
            buy_result = await binance_client.place_market_buy("BTCUSDT", btc_amount)
            sell_result = await luno_client.place_market_sell("XBTZAR", btc_amount)
        
        if not buy_result.success or not sell_result.success:
            logger.error(f"Trade failed - Buy: {buy_result.error}, Sell: {sell_result.error}")
            return None
        
        profit_usd = btc_amount * (spread_info["sell_price"] - spread_info["buy_price"])
        profit_usd -= btc_amount * spread_info["buy_price"] * config.LUNO_TRADING_FEE
        profit_usd -= btc_amount * spread_info["sell_price"] * config.BINANCE_TRADING_FEE
        
        db = SessionLocal()
        try:
            trade = Trade(
                direction=spread_info["direction"],
                btc_amount=btc_amount,
                buy_price=spread_info["buy_price"],
                sell_price=spread_info["sell_price"],
                spread_percent=spread_info["spread_percent"],
                profit_usd=profit_usd,
                buy_exchange=spread_info["buy_exchange"],
                sell_exchange=spread_info["sell_exchange"],
                status="completed"
            )
            db.add(trade)
            db.commit()
            db.refresh(trade)
            
            self.total_trades += 1
            self.total_pnl += profit_usd
            
            logger.info(f"Trade completed: {trade.id}, Profit: ${profit_usd:.2f}")
            return trade
        finally:
            db.close()
    
    async def update_float_balances(self):
        db = SessionLocal()
        try:
            luno_btc = await luno_client.get_balance("XBT")
            luno_zar = await luno_client.get_balance("ZAR")
            binance_btc = await binance_client.get_balance("BTC")
            binance_usdt = await binance_client.get_balance("USDT")
            
            balances = [
                ("luno", "XBT", luno_btc.available),
                ("luno", "ZAR", luno_zar.available),
                ("binance", "BTC", binance_btc.available),
                ("binance", "USDT", binance_usdt.available)
            ]
            
            for exchange, currency, balance in balances:
                existing = db.query(FloatBalance).filter(
                    FloatBalance.exchange == exchange,
                    FloatBalance.currency == currency
                ).first()
                
                if existing:
                    existing.balance = balance
                else:
                    new_balance = FloatBalance(
                        exchange=exchange,
                        currency=currency,
                        balance=balance
                    )
                    db.add(new_balance)
            
            db.commit()
        except Exception as e:
            logger.error(f"Error updating balances: {e}")
        finally:
            db.close()
    
    async def run_iteration(self):
        try:
            luno_price, binance_price = await self.get_prices()
            self.last_check = datetime.utcnow()
            
            spread_info = self.calculate_spread(luno_price, binance_price)
            self.last_opportunity = spread_info
            
            if spread_info.get("error"):
                logger.warning(f"Price fetch issue: {spread_info['error']}")
            else:
                logger.info(
                    f"Prices - Luno: {luno_price.last} ZAR, Binance: ${binance_price.last} | "
                    f"Spread: {spread_info['spread_percent']:.2f}% | "
                    f"Net: {spread_info['net_spread']:.2f}%"
                )
            
            if spread_info["is_profitable"] and not spread_info.get("error"):
                logger.info(f"Profitable opportunity detected! Direction: {spread_info['direction']}")
                
            await self.update_float_balances()
            
        except Exception as e:
            logger.error(f"Error in arbitrage iteration: {e}")
    
    async def loop(self):
        self.running = True
        logger.info("Arbitrage loop started")
        
        while self.running:
            await self.run_iteration()
            await asyncio.sleep(config.LOOP_INTERVAL_SECONDS)
        
        logger.info("Arbitrage loop stopped")
    
    def start(self):
        if not self.running:
            self.task = asyncio.create_task(self.loop())
            return True
        return False
    
    def stop(self):
        self.running = False
        if self.task:
            self.task.cancel()
            self.task = None
        return True
    
    def get_status(self) -> dict:
        return {
            "running": self.running,
            "last_check": self.last_check.isoformat() if self.last_check else None,
            "last_opportunity": self.last_opportunity,
            "total_trades": self.total_trades,
            "total_pnl": self.total_pnl
        }

arb_loop = ArbitrageLoop()
