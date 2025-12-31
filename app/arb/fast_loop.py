import asyncio
import logging
from collections import deque
from dataclasses import dataclass
from datetime import datetime
from typing import Optional
from app.arb.price_service import price_service
from app.arb.exchanges.luno import luno_client
from app.arb.exchanges.binance import binance_client
from app.arb.exchanges.base import PriceData
from app.arb.fx_rates import fx_service
from app.config import config
from app.database import SessionLocal
from app.models import Trade, FloatBalance, Opportunity, ArbTick


@dataclass
class TickData:
    timestamp: datetime
    luno_bid: float
    luno_ask: float
    luno_last: float
    binance_bid: float
    binance_ask: float
    binance_last: float
    usd_zar_rate: float
    spread_pct: float
    gross_edge_bps: float
    net_edge_bps: float
    direction: str
    is_profitable: bool
    min_edge_threshold_bps: int
    slippage_bps: int
    fee_bps: int

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class FastArbitrageLoop:
    TICK_BUFFER_SIZE = 6
    TICK_QUEUE_MAX_SIZE = 100
    
    def __init__(self):
        self.running = False
        self.last_check = None
        self.last_opportunity = None
        self.total_trades = 0
        self.total_pnl = 0.0
        self.task: Optional[asyncio.Task] = None
        self.consecutive_errors = 0
        self.start_time = None
        self._check_interval = 0.5
        self._last_trade_time: Optional[datetime] = None
        self._min_trade_interval = 2.0
        self._stats = {
            "checks": 0,
            "opportunities_found": 0,
            "trades_executed": 0,
            "avg_check_time_ms": 0,
            "ticks_persisted": 0,
            "skipped_insufficient_balance": 0,
            "skipped_below_threshold": 0,
        }
        self._inventory_status = {
            "can_trade_luno_to_binance": False,
            "can_trade_binance_to_luno": False,
            "block_reason_l2b": None,
            "block_reason_b2l": None,
            "consecutive_same_direction": 0,
            "last_profitable_direction": None,
        }
        self._paper_floats = {
            "binance_btc": 0.0,
            "binance_usdt": 0.0,
            "luno_btc": 0.0,
            "luno_zar": 0.0,
            "last_direction": None,
        }
        self._paper_floats_initialized = False
        self._tick_buffer: deque[TickData] = deque(maxlen=self.TICK_BUFFER_SIZE)
        self._tick_queue: asyncio.Queue = asyncio.Queue(maxsize=self.TICK_QUEUE_MAX_SIZE)
        self._tick_writer_task: Optional[asyncio.Task] = None
    
    def get_setting(self, key: str, default=None):
        return config.get(key) if config.get(key) is not None else getattr(config, key, default)
    
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
    
    def create_tick_from_spread(self, luno_price: PriceData, binance_price: PriceData, spread_info: dict) -> TickData:
        min_net_edge = self.get_setting("MIN_NET_EDGE_BPS", 40)
        slippage_bps = self.get_setting("SLIPPAGE_BPS_BUFFER", 10)
        luno_fee = self.get_setting("LUNO_TRADING_FEE", 0.001)
        binance_fee = self.get_setting("BINANCE_TRADING_FEE", 0.001)
        total_fee_bps = int((luno_fee + binance_fee) * 10000)
        
        return TickData(
            timestamp=datetime.utcnow(),
            luno_bid=luno_price.bid,
            luno_ask=luno_price.ask,
            luno_last=luno_price.last,
            binance_bid=binance_price.bid,
            binance_ask=binance_price.ask,
            binance_last=binance_price.last,
            usd_zar_rate=spread_info.get("usd_zar_rate", 17.0),
            spread_pct=spread_info.get("spread_percent", 0),
            gross_edge_bps=spread_info.get("gross_edge_bps", 0),
            net_edge_bps=spread_info.get("net_edge_bps", 0),
            direction=spread_info.get("direction", "unknown"),
            is_profitable=spread_info.get("is_profitable", False),
            min_edge_threshold_bps=int(min_net_edge),
            slippage_bps=int(slippage_bps),
            fee_bps=total_fee_bps,
        )
    
    def add_tick_to_buffer(self, tick: TickData):
        if len(self._tick_buffer) >= self.TICK_BUFFER_SIZE:
            oldest_tick = self._tick_buffer[0]
            second_oldest = self._tick_buffer[1] if len(self._tick_buffer) > 1 else None
            should_persist = True
            if second_oldest and round(oldest_tick.net_edge_bps, 1) == round(second_oldest.net_edge_bps, 1):
                should_persist = False
            
            if should_persist and not self._tick_queue.full():
                try:
                    self._tick_queue.put_nowait(oldest_tick)
                except asyncio.QueueFull:
                    logger.warning("Tick queue full, dropping tick")
        self._tick_buffer.append(tick)
    
    async def _tick_writer_loop(self):
        logger.info("Tick writer task started")
        while self.running or (self._tick_queue and not self._tick_queue.empty()):
            try:
                tick = await asyncio.wait_for(self._tick_queue.get(), timeout=1.0)
                await asyncio.to_thread(self._persist_tick, tick)
                self._stats["ticks_persisted"] += 1
            except asyncio.TimeoutError:
                continue
            except Exception as e:
                logger.error(f"Error in tick writer: {e}")
        logger.info("Tick writer task stopped")
    
    def _persist_tick(self, tick: TickData):
        db = SessionLocal()
        try:
            arb_tick = ArbTick(
                timestamp=tick.timestamp,
                luno_bid=tick.luno_bid,
                luno_ask=tick.luno_ask,
                luno_last=tick.luno_last,
                binance_bid=tick.binance_bid,
                binance_ask=tick.binance_ask,
                binance_last=tick.binance_last,
                usd_zar_rate=tick.usd_zar_rate,
                spread_pct=tick.spread_pct,
                gross_edge_bps=tick.gross_edge_bps,
                net_edge_bps=tick.net_edge_bps,
                direction=tick.direction,
                is_profitable=tick.is_profitable,
                min_edge_threshold_bps=tick.min_edge_threshold_bps,
                slippage_bps=tick.slippage_bps,
                fee_bps=tick.fee_bps,
            )
            db.add(arb_tick)
            db.commit()
        except Exception as e:
            db.rollback()
            logger.error(f"Error persisting tick: {e}")
        finally:
            db.close()
    
    def get_recent_ticks(self) -> list:
        return [
            {
                "timestamp": t.timestamp.isoformat() if t.timestamp else None,
                "luno_last": t.luno_last,
                "binance_last": t.binance_last,
                "usd_zar_rate": t.usd_zar_rate,
                "spread_pct": t.spread_pct,
                "net_edge_bps": t.net_edge_bps,
                "direction": t.direction,
                "is_profitable": t.is_profitable,
            }
            for t in list(self._tick_buffer)
        ]

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
    
    def initialize_paper_floats(self, luno_zar_price: float):
        if self._paper_floats_initialized:
            return
        max_trade_zar = self.get_setting("MAX_TRADE_ZAR", 5000)
        usd_zar_rate = self.get_setting("USD_ZAR_RATE", 17.0)
        self._paper_floats["luno_zar"] = max_trade_zar
        self._paper_floats["luno_btc"] = 0.0
        btc_value = max_trade_zar / luno_zar_price if luno_zar_price > 0 else 0.0
        self._paper_floats["binance_btc"] = btc_value
        self._paper_floats["binance_usdt"] = 0.0
        self._paper_floats["last_direction"] = None
        self._paper_floats_initialized = True
        logger.info(f"[PAPER] Initialized floats: Luno ZAR={max_trade_zar:.2f}, Binance BTC={btc_value:.8f} (≈R{max_trade_zar:.2f})")

    def get_safety_buffers(self) -> dict:
        return {
            "luno_zar": self.get_setting("MIN_REMAINING_ZAR_LUNO", 1000),
            "luno_btc": self.get_setting("MIN_REMAINING_BTC_LUNO", 0.0005),
            "binance_btc": self.get_setting("MIN_REMAINING_BTC_BINANCE", 0.001),
            "binance_usdt": self.get_setting("MIN_REMAINING_USDT_BINANCE", 50),
        }
    
    def get_tradeable_amounts(self, direction: str) -> dict:
        buffers = self.get_safety_buffers()
        if config.is_paper_mode():
            luno_zar = max(0, self._paper_floats["luno_zar"] - buffers["luno_zar"])
            luno_btc = max(0, self._paper_floats["luno_btc"] - buffers["luno_btc"])
            binance_btc = max(0, self._paper_floats["binance_btc"] - buffers["binance_btc"])
            binance_usdt = max(0, self._paper_floats["binance_usdt"] - buffers["binance_usdt"])
        else:
            luno_zar = 0
            luno_btc = 0
            binance_btc = 0
            binance_usdt = 0
        
        return {
            "luno_zar": luno_zar,
            "luno_btc": luno_btc,
            "binance_btc": binance_btc,
            "binance_usdt": binance_usdt,
        }

    def can_execute_paper_trade(self, direction: str) -> tuple[bool, str]:
        tradeable = self.get_tradeable_amounts(direction)
        
        if direction == "luno_to_binance":
            if tradeable["binance_btc"] <= 0:
                return False, "Insufficient BTC on Binance (below safety buffer)"
            if tradeable["luno_zar"] <= 0:
                return False, "Insufficient ZAR on Luno (below safety buffer)"
        else:
            if tradeable["luno_btc"] <= 0:
                return False, "Insufficient BTC on Luno (below safety buffer)"
            if tradeable["binance_usdt"] <= 0:
                return False, "Insufficient USDT on Binance (below safety buffer)"
        return True, ""

    def calculate_trade_size(self, spread_info: dict, direction: str) -> tuple[float, float]:
        max_trade_zar = self.get_setting("MAX_TRADE_ZAR", 5000)
        max_trade_btc = self.get_setting("MAX_TRADE_SIZE_BTC", 0.01)
        min_trade_btc = self.get_setting("MIN_TRADE_SIZE_BTC", 0.0001)
        luno_zar_price = spread_info.get("luno_zar", 0)
        binance_usd = spread_info.get("binance_usd", 0)
        usd_zar_rate = spread_info.get("usd_zar_rate", 17.0)
        
        if luno_zar_price <= 0:
            return 0.0, 0.0
        
        btc_for_max_zar = max_trade_zar / luno_zar_price
        btc_amount = min(btc_for_max_zar, max_trade_btc)
        
        if config.is_paper_mode():
            tradeable = self.get_tradeable_amounts(direction)
            
            if direction == "luno_to_binance":
                available_btc = tradeable["binance_btc"]
                available_zar = tradeable["luno_zar"]
                max_btc_from_zar = available_zar / luno_zar_price if luno_zar_price > 0 else 0
                btc_amount = min(btc_amount, available_btc, max_btc_from_zar)
            else:
                available_btc = tradeable["luno_btc"]
                available_usdt = tradeable["binance_usdt"]
                max_btc_from_usdt = available_usdt / binance_usd if binance_usd > 0 else 0
                btc_amount = min(btc_amount, available_btc, max_btc_from_usdt)
            
            if btc_amount < min_trade_btc:
                logger.info(f"[PAPER] Trade size {btc_amount:.8f} BTC below minimum {min_trade_btc:.8f} BTC")
                return 0.0, 0.0
        
        trade_size_zar = btc_amount * luno_zar_price
        return btc_amount, trade_size_zar

    async def execute_hedged_trade_parallel(self, spread_info: dict, btc_amount: float) -> Optional[Trade]:
        is_paper = config.is_paper_mode()
        luno_fee = self.get_setting("LUNO_TRADING_FEE", 0.001)
        binance_fee = self.get_setting("BINANCE_TRADING_FEE", 0.001)
        
        if is_paper:
            direction = spread_info["direction"]
            can_trade, reason = self.can_execute_paper_trade(direction)
            if not can_trade:
                logger.info(f"[PAPER] Cannot execute {direction}: {reason}")
                return None
            
            btc_amount, trade_size_zar = self.calculate_trade_size(spread_info, direction)
            if btc_amount <= 0:
                logger.warning("[PAPER] Trade size calculated as zero")
                return None
            
            net_edge_pct = spread_info["net_edge_bps"] / 10000
            profit_zar = trade_size_zar * net_edge_pct
            usd_zar_rate = spread_info.get("usd_zar_rate", 17.0)
            profit_usd = profit_zar / usd_zar_rate
            
            if direction == "luno_to_binance":
                self._paper_floats["luno_zar"] -= trade_size_zar
                self._paper_floats["luno_btc"] += btc_amount * (1 - luno_fee)
                self._paper_floats["binance_btc"] -= btc_amount
                self._paper_floats["binance_usdt"] += btc_amount * spread_info["binance_usd"] * (1 - binance_fee)
            else:
                self._paper_floats["binance_usdt"] -= btc_amount * spread_info["binance_usd"]
                self._paper_floats["binance_btc"] += btc_amount * (1 - binance_fee)
                self._paper_floats["luno_btc"] -= btc_amount
                self._paper_floats["luno_zar"] += trade_size_zar * (1 - luno_fee)
            
            self._paper_floats["last_direction"] = direction
            
            logger.info(f"[PAPER] Trade: {direction} | Size: {btc_amount:.6f} BTC (R{trade_size_zar:.2f}) | Profit: R{profit_zar:.2f}")
            logger.info(f"[PAPER] New floats: Binance BTC={self._paper_floats['binance_btc']:.6f}, USDT={self._paper_floats['binance_usdt']:.2f} | Luno BTC={self._paper_floats['luno_btc']:.6f}, ZAR={self._paper_floats['luno_zar']:.2f}")
            
            db = SessionLocal()
            try:
                trade = Trade(
                    direction=spread_info["direction"],
                    btc_amount=btc_amount,
                    buy_price=spread_info["buy_price"],
                    sell_price=spread_info["sell_price"],
                    spread_percent=spread_info["spread_percent"],
                    profit_usd=profit_usd,
                    profit_zar=profit_zar,
                    buy_exchange=spread_info["buy_exchange"],
                    sell_exchange=spread_info["sell_exchange"],
                    status="paper"
                )
                db.add(trade)
                db.commit()
                db.refresh(trade)
                
                self.total_trades += 1
                self.total_pnl += profit_usd
                self._stats["trades_executed"] += 1
                
                logger.info(f"[PAPER] Trade logged: {trade.id}, Profit: R{profit_zar:.2f} (${profit_usd:.4f})")
                return trade
            finally:
                db.close()
        
        logger.info(f"[LIVE MODE] Executing PARALLEL hedged trade: {spread_info['direction']} for {btc_amount} BTC")
        
        start_time = datetime.utcnow()
        
        if spread_info["direction"] == "luno_to_binance":
            buy_coro = luno_client.place_market_buy("XBTZAR", btc_amount * spread_info["buy_price"])
            sell_coro = binance_client.place_market_sell("BTCUSDT", btc_amount)
        else:
            buy_coro = binance_client.place_market_buy("BTCUSDT", btc_amount)
            sell_coro = luno_client.place_market_sell("XBTZAR", btc_amount)
        
        buy_result, sell_result = await asyncio.gather(buy_coro, sell_coro, return_exceptions=True)
        
        exec_time = (datetime.utcnow() - start_time).total_seconds() * 1000
        logger.info(f"Parallel execution completed in {exec_time:.0f}ms")
        
        if isinstance(buy_result, Exception) or isinstance(sell_result, Exception):
            logger.error(f"Trade exception - Buy: {buy_result}, Sell: {sell_result}")
            return None
        
        if not buy_result.success or not sell_result.success:
            logger.error(f"Trade failed - Buy: {buy_result.error}, Sell: {sell_result.error}")
            return None
        
        profit_usd = btc_amount * (spread_info["sell_price"] - spread_info["buy_price"])
        profit_usd -= btc_amount * spread_info["buy_price"] * luno_fee
        profit_usd -= btc_amount * spread_info["sell_price"] * binance_fee
        
        usd_zar_rate = spread_info.get("usd_zar_rate", 17.0)
        profit_zar = profit_usd * usd_zar_rate
        
        db = SessionLocal()
        try:
            trade = Trade(
                direction=spread_info["direction"],
                btc_amount=btc_amount,
                buy_price=spread_info["buy_price"],
                sell_price=spread_info["sell_price"],
                spread_percent=spread_info["spread_percent"],
                profit_usd=profit_usd,
                profit_zar=profit_zar,
                buy_exchange=spread_info["buy_exchange"],
                sell_exchange=spread_info["sell_exchange"],
                status="completed"
            )
            db.add(trade)
            db.commit()
            db.refresh(trade)
            
            self.total_trades += 1
            self.total_pnl += profit_usd
            self._stats["trades_executed"] += 1
            
            logger.info(f"Trade completed: {trade.id}, Profit: ${profit_usd:.2f}, Exec time: {exec_time:.0f}ms")
            return trade
        finally:
            db.close()
    
    async def update_float_balances(self):
        db = SessionLocal()
        try:
            luno_btc, luno_zar, binance_btc, binance_usdt = await asyncio.gather(
                luno_client.get_balance("XBT"),
                luno_client.get_balance("ZAR"),
                binance_client.get_balance("BTC"),
                binance_client.get_balance("USDT"),
                return_exceptions=True
            )
            
            balances = []
            if not isinstance(luno_btc, Exception):
                balances.append(("luno", "XBT", luno_btc.available))
            if not isinstance(luno_zar, Exception):
                balances.append(("luno", "ZAR", luno_zar.available))
            if not isinstance(binance_btc, Exception):
                balances.append(("binance", "BTC", binance_btc.available))
            if not isinstance(binance_usdt, Exception):
                balances.append(("binance", "USDT", binance_usdt.available))
            
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
            start_time = datetime.utcnow()
            
            luno_price, binance_price = price_service.get_prices()
            
            if not luno_price or not binance_price:
                if not price_service.is_ready():
                    return
                self.consecutive_errors += 1
                return
            
            self.last_check = datetime.utcnow()
            self._stats["checks"] += 1
            
            spread_info = await self.calculate_spread(luno_price, binance_price)
            self.last_opportunity = spread_info
            
            if spread_info.get("error"):
                self.consecutive_errors += 1
                return
            
            tick = self.create_tick_from_spread(luno_price, binance_price, spread_info)
            self.add_tick_to_buffer(tick)
            
            if config.is_paper_mode() and not self._paper_floats_initialized:
                self.initialize_paper_floats(luno_price.last)
            
            self.consecutive_errors = 0
            
            check_time = (datetime.utcnow() - start_time).total_seconds() * 1000
            self._stats["avg_check_time_ms"] = (
                self._stats["avg_check_time_ms"] * 0.9 + check_time * 0.1
            )
            
            if self._stats["checks"] % 120 == 0:
                is_paper = config.is_paper_mode()
                mode_str = "[PAPER]" if is_paper else "[LIVE]"
                usd_zar = spread_info.get('usd_zar_rate', 18.5)
                logger.info(
                    f"{mode_str} USD/ZAR: {usd_zar:.2f} | "
                    f"Luno: R{luno_price.last:.0f} | Binance: ${binance_price.last:.2f} | "
                    f"Net: {spread_info['net_edge_bps']:.1f}bps | "
                    f"Check: {check_time:.0f}ms"
                )
            
            if spread_info["is_profitable"]:
                self._stats["opportunities_found"] += 1
                direction = spread_info["direction"]
                
                if self._inventory_status["last_profitable_direction"] == direction:
                    self._inventory_status["consecutive_same_direction"] += 1
                else:
                    self._inventory_status["consecutive_same_direction"] = 1
                self._inventory_status["last_profitable_direction"] = direction
                
                if self._last_trade_time:
                    time_since_trade = (datetime.utcnow() - self._last_trade_time).total_seconds()
                    if time_since_trade < self._min_trade_interval:
                        return
                
                if config.is_paper_mode():
                    can_trade, reason = self.can_execute_paper_trade(direction)
                    if not can_trade:
                        self._stats["skipped_insufficient_balance"] += 1
                        self.log_opportunity(spread_info, was_executed=False, reason_skipped=reason)
                        return
                logger.info(
                    f"OPPORTUNITY! Direction: {direction}, "
                    f"Net Edge: {spread_info['net_edge_bps']:.1f}bps ({spread_info['net_edge_bps']/100:.2f}%)"
                )
                
                btc_amount, trade_size_zar = self.calculate_trade_size(spread_info, spread_info['direction'])
                trade = await self.execute_hedged_trade_parallel(spread_info, btc_amount)
                
                if trade:
                    self._last_trade_time = datetime.utcnow()
                    self.log_opportunity(spread_info, was_executed=True)
                else:
                    self.log_opportunity(spread_info, was_executed=False, reason_skipped="execution_failed")
            
        except Exception as e:
            logger.error(f"Error in arbitrage iteration: {e}")
            self.consecutive_errors += 1
    
    def start(self):
        if not self.running and self.task is None:
            self.running = True
            self.consecutive_errors = 0
            self.task = asyncio.create_task(self._run_with_cleanup())
            return True
        return False
    
    async def _run_with_cleanup(self):
        try:
            await self._loop_inner()
        finally:
            await price_service.stop()
            self.running = False
            self._flush_tick_buffer()
            if self._tick_writer_task:
                try:
                    await asyncio.wait_for(self._tick_writer_task, timeout=5.0)
                except asyncio.TimeoutError:
                    logger.warning("Tick writer task did not finish in time")
                self._tick_writer_task = None
            self.task = None
    
    def _flush_tick_buffer(self):
        for tick in list(self._tick_buffer):
            try:
                self._tick_queue.put_nowait(tick)
            except asyncio.QueueFull:
                logger.warning("Queue full during flush, dropping tick")
        self._tick_buffer.clear()
        logger.info(f"Flushed tick buffer to queue")
    
    async def _loop_inner(self):
        self.start_time = datetime.utcnow()
        
        self._tick_writer_task = asyncio.create_task(self._tick_writer_loop())
        
        await price_service.start()
        await asyncio.sleep(2)
        
        is_paper = config.is_paper_mode()
        mode_str = "PAPER" if is_paper else "LIVE"
        logger.info(f"Fast arbitrage loop started in {mode_str} mode (check interval: {self._check_interval}s)")
        
        balance_update_counter = 0
        
        while self.running:
            await self.run_iteration()
            
            balance_update_counter += 1
            if balance_update_counter >= 60:
                asyncio.create_task(self.update_float_balances())
                balance_update_counter = 0
            
            error_stop_count = self.get_setting("ERROR_STOP_COUNT", 5)
            if self.consecutive_errors >= error_stop_count:
                logger.error(f"Stopping bot due to {self.consecutive_errors} consecutive errors")
                break
            
            await asyncio.sleep(self._check_interval)
        
        logger.info("Fast arbitrage loop stopped")
    
    def stop(self):
        self.running = False
        return True
    
    def reset_paper_floats(self):
        self._paper_floats = {
            "binance_btc": 0.0,
            "binance_usdt": 0.0,
            "luno_btc": 0.0,
            "luno_zar": 0.0,
            "last_direction": None,
        }
        self._paper_floats_initialized = False
        self.total_trades = 0
        self.total_pnl = 0.0
        self._stats["trades_executed"] = 0
        self._stats["opportunities_found"] = 0
        logger.info("[PAPER] Floats reset - will re-initialize on next price check")
    
    def update_inventory_status(self):
        if config.is_paper_mode():
            can_l2b, reason_l2b = self.can_execute_paper_trade("luno_to_binance")
            can_b2l, reason_b2l = self.can_execute_paper_trade("binance_to_luno")
            self._inventory_status["can_trade_luno_to_binance"] = can_l2b
            self._inventory_status["can_trade_binance_to_luno"] = can_b2l
            self._inventory_status["block_reason_l2b"] = reason_l2b if not can_l2b else None
            self._inventory_status["block_reason_b2l"] = reason_b2l if not can_b2l else None
    
    def get_status(self) -> dict:
        uptime = None
        if self.start_time and self.running:
            uptime = (datetime.utcnow() - self.start_time).total_seconds()
        
        price_stats = price_service.get_stats()
        
        if config.is_paper_mode():
            self.update_inventory_status()
        
        tradeable_amounts = None
        buffers = None
        if config.is_paper_mode() and self._paper_floats_initialized:
            buffers = self.get_safety_buffers()
            tradeable_amounts = {
                "luno_zar": max(0, self._paper_floats["luno_zar"] - buffers["luno_zar"]),
                "luno_btc": max(0, self._paper_floats["luno_btc"] - buffers["luno_btc"]),
                "binance_btc": max(0, self._paper_floats["binance_btc"] - buffers["binance_btc"]),
                "binance_usdt": max(0, self._paper_floats["binance_usdt"] - buffers["binance_usdt"]),
            }
        
        return {
            "running": self.running,
            "mode": "paper" if config.is_paper_mode() else "live",
            "last_check": self.last_check.isoformat() if self.last_check else None,
            "last_opportunity": self.last_opportunity,
            "total_trades": self.total_trades,
            "total_pnl": self.total_pnl,
            "uptime_seconds": uptime,
            "consecutive_errors": self.consecutive_errors,
            "check_interval_ms": self._check_interval * 1000,
            "stats": self._stats,
            "price_service": price_stats,
            "paper_floats": self._paper_floats if config.is_paper_mode() else None,
            "tradeable_amounts": tradeable_amounts,
            "safety_buffers": buffers,
            "inventory_status": self._inventory_status if config.is_paper_mode() else None,
            "recent_ticks": self.get_recent_ticks(),
        }

fast_arb_loop = FastArbitrageLoop()
