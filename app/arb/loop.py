import asyncio
import logging
from datetime import datetime
from typing import Optional
from app.arb.exchanges.luno import luno_client
from app.arb.exchanges.binance import binance_client
from app.arb.exchanges.base import PriceData
from app.arb.fx_rates import fx_service
from app.config import config
from app.database import SessionLocal
from app.models import Trade, FloatBalance, Opportunity

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
        self.consecutive_errors = 0
        self.start_time = None
    
    def get_setting(self, key: str, default=None):
        return config.get(key) if config.get(key) is not None else getattr(config, key, default)
    
    async def get_prices(self) -> tuple[PriceData, PriceData]:
        luno_price = await luno_client.get_price("XBTZAR")
        binance_price = await binance_client.get_price("BTCUSDT")
        return luno_price, binance_price
    
    async def calculate_spread(self, luno_price: PriceData, binance_price: PriceData) -> dict:
        usd_zar_rate = await fx_service.get_usd_zar_rate()
        slippage_bps = self.get_setting("SLIPPAGE_BPS_BUFFER", 10)
        luno_fee = self.get_setting("LUNO_TRADING_FEE", 0.001)
        binance_fee = self.get_setting("BINANCE_TRADING_FEE", 0.001)
        min_net_edge = self.get_setting("MIN_NET_EDGE_BPS", 40)
        
        if luno_price.last == 0 or binance_price.last == 0:
            return {
                "direction": "unknown",
                "spread_percent": 0,
                "gross_edge_bps": 0,
                "net_edge_bps": 0,
                "net_spread": 0,
                "buy_exchange": None,
                "sell_exchange": None,
                "buy_price": 0,
                "sell_price": 0,
                "luno_zar": luno_price.last,
                "luno_usd": 0,
                "binance_usd": 0,
                "is_profitable": False,
                "error": "Unable to fetch prices from one or both exchanges"
            }
        
        luno_usd = luno_price.last / usd_zar_rate
        binance_usd = binance_price.last
        
        slippage_factor = slippage_bps / 10000
        
        if binance_usd > luno_usd:
            direction = "luno_to_binance"
            buy_exchange = "luno"
            sell_exchange = "binance"
            buy_price = luno_price.ask * (1 + slippage_factor)
            sell_price = binance_price.bid * (1 - slippage_factor)
            gross_spread = (sell_price - (buy_price / usd_zar_rate)) / (buy_price / usd_zar_rate)
        else:
            direction = "binance_to_luno"
            buy_exchange = "binance"
            sell_exchange = "luno"
            buy_price = binance_price.ask * (1 + slippage_factor)
            sell_price = luno_price.bid * (1 - slippage_factor)
            gross_spread = ((sell_price / usd_zar_rate) - buy_price) / buy_price
        
        gross_edge_bps = gross_spread * 10000
        total_fee_bps = (luno_fee + binance_fee) * 10000
        net_edge_bps = gross_edge_bps - total_fee_bps
        
        spread_percent = gross_spread * 100
        total_fees = (luno_fee + binance_fee) * 100
        net_spread = spread_percent - total_fees
        
        is_profitable = net_edge_bps >= min_net_edge
        
        return {
            "direction": direction,
            "spread_percent": spread_percent,
            "gross_edge_bps": gross_edge_bps,
            "net_edge_bps": net_edge_bps,
            "net_spread": net_spread,
            "buy_exchange": buy_exchange,
            "sell_exchange": sell_exchange,
            "buy_price": buy_price,
            "sell_price": sell_price,
            "luno_zar": luno_price.last,
            "luno_usd": luno_usd,
            "binance_usd": binance_usd,
            "usd_zar_rate": usd_zar_rate,
            "luno_bid": luno_price.bid,
            "luno_ask": luno_price.ask,
            "binance_bid": binance_price.bid,
            "binance_ask": binance_price.ask,
            "is_profitable": is_profitable
        }
    
    def log_opportunity(self, spread_info: dict, was_executed: bool = False, reason_skipped: str = None):
        if spread_info.get("error"):
            return
            
        db = SessionLocal()
        try:
            max_trade_btc = self.get_setting("MAX_TRADE_SIZE_BTC", 0.01)
            size_estimate = max_trade_btc
            size_zar_estimate = size_estimate * spread_info.get("luno_zar", 0)
            
            opportunity = Opportunity(
                direction=spread_info["direction"],
                sell_exchange=spread_info["sell_exchange"],
                buy_exchange=spread_info["buy_exchange"],
                sell_price=spread_info["sell_price"],
                buy_price=spread_info["buy_price"],
                gross_edge_bps=spread_info["gross_edge_bps"],
                net_edge_bps=spread_info["net_edge_bps"],
                size_btc_estimate=size_estimate,
                size_zar_estimate=size_zar_estimate,
                was_executed=1 if was_executed else 0,
                reason_skipped=reason_skipped,
                luno_price_zar=spread_info.get("luno_zar"),
                binance_price_usd=spread_info["binance_usd"]
            )
            db.add(opportunity)
            db.commit()
        except Exception as e:
            logger.error(f"Error logging opportunity: {e}")
        finally:
            db.close()
    
    async def execute_hedged_trade(self, spread_info: dict, btc_amount: float) -> Optional[Trade]:
        is_paper = config.is_paper_mode()
        luno_fee = self.get_setting("LUNO_TRADING_FEE", 0.001)
        binance_fee = self.get_setting("BINANCE_TRADING_FEE", 0.001)
        
        if is_paper:
            logger.info(f"[PAPER MODE] Simulated trade: {spread_info['direction']} for {btc_amount} BTC")
            
            profit_usd = btc_amount * abs(spread_info["binance_usd"] - spread_info["luno_usd"])
            profit_usd *= (spread_info["net_edge_bps"] / 10000)
            
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
                    status="paper"
                )
                db.add(trade)
                db.commit()
                db.refresh(trade)
                
                self.total_trades += 1
                self.total_pnl += profit_usd
                
                logger.info(f"[PAPER] Trade logged: {trade.id}, Simulated Profit: ${profit_usd:.4f}")
                return trade
            finally:
                db.close()
        
        logger.info(f"[LIVE MODE] Executing hedged trade: {spread_info['direction']} for {btc_amount} BTC")
        
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
        profit_usd -= btc_amount * spread_info["buy_price"] * luno_fee
        profit_usd -= btc_amount * spread_info["sell_price"] * binance_fee
        
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
            
            spread_info = await self.calculate_spread(luno_price, binance_price)
            self.last_opportunity = spread_info
            
            if spread_info.get("error"):
                logger.warning(f"Price fetch issue: {spread_info['error']}")
                self.consecutive_errors += 1
            else:
                self.consecutive_errors = 0
                is_paper = config.is_paper_mode()
                mode_str = "[PAPER]" if is_paper else "[LIVE]"
                usd_zar = spread_info.get('usd_zar_rate', 18.5)
                logger.info(
                    f"{mode_str} USD/ZAR: {usd_zar:.2f} | "
                    f"Luno: {luno_price.last:.0f} ZAR (bid:{luno_price.bid:.0f}/ask:{luno_price.ask:.0f}) | "
                    f"Binance: ${binance_price.last:.2f} (bid:{binance_price.bid:.2f}/ask:{binance_price.ask:.2f}) | "
                    f"Luno→USD: ${spread_info['luno_usd']:.2f} | "
                    f"Gross: {spread_info['gross_edge_bps']:.1f}bps | Net: {spread_info['net_edge_bps']:.1f}bps"
                )
                
                self.log_opportunity(spread_info)
            
            if spread_info["is_profitable"] and not spread_info.get("error"):
                logger.info(f"Profitable opportunity detected! Direction: {spread_info['direction']}, Net Edge: {spread_info['net_edge_bps']:.1f}bps")
                
                btc_amount = self.get_setting("MAX_TRADE_SIZE_BTC", 0.01)
                trade = await self.execute_hedged_trade(spread_info, btc_amount)
                if trade:
                    self.log_opportunity(spread_info, was_executed=True)
            
            error_stop_count = self.get_setting("ERROR_STOP_COUNT", 5)
            if self.consecutive_errors >= error_stop_count:
                logger.error(f"Stopping bot due to {self.consecutive_errors} consecutive errors")
                self.stop()
                return
                
            await self.update_float_balances()
            
        except Exception as e:
            logger.error(f"Error in arbitrage iteration: {e}")
            self.consecutive_errors += 1
    
    async def loop(self):
        self.running = True
        self.start_time = datetime.utcnow()
        is_paper = config.is_paper_mode()
        mode_str = "PAPER" if is_paper else "LIVE"
        logger.info(f"Arbitrage loop started in {mode_str} mode")
        
        while self.running:
            await self.run_iteration()
            loop_interval = self.get_setting("LOOP_INTERVAL_SECONDS", 10)
            await asyncio.sleep(loop_interval)
        
        logger.info("Arbitrage loop stopped")
    
    def start(self):
        if not self.running:
            self.consecutive_errors = 0
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
        uptime = None
        if self.start_time and self.running:
            uptime = (datetime.utcnow() - self.start_time).total_seconds()
            
        return {
            "running": self.running,
            "mode": "paper" if config.is_paper_mode() else "live",
            "last_check": self.last_check.isoformat() if self.last_check else None,
            "last_opportunity": self.last_opportunity,
            "total_trades": self.total_trades,
            "total_pnl": self.total_pnl,
            "uptime_seconds": uptime,
            "consecutive_errors": self.consecutive_errors
        }

arb_loop = ArbitrageLoop()
