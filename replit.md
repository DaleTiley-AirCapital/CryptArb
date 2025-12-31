# Crypto Arbitrage Bot

## Overview
A market-neutral crypto arbitrage bot that monitors BTC price spreads between Luno (South African exchange) and Binance, executing hedged trades when profitable opportunities are detected.

## Architecture

### High-Speed Price Service
- **Binance WebSocket**: Real-time price streaming (~100ms updates)
- **Luno REST Polling**: Every 1 second (rate limit safe)
- **In-memory cache**: Instant price reads for arb calculations
- **Check interval**: 500ms arbitrage calculations
- **Live FX rates**: USD/ZAR fetched from live APIs every 5 minutes

### Backend (FastAPI - Python)
Located in `/app/`:
- `main.py` - FastAPI entrypoint with CORS and lifecycle management
- `config.py` - Configuration from environment variables with runtime overrides
- `database.py` - PostgreSQL/SQLite connection using SQLAlchemy (auto-fallback to SQLite in dev)
- `arb/fast_loop.py` - High-speed arbitrage loop with WebSocket + REST hybrid
- `arb/price_service.py` - Real-time price streaming service
- `arb/fx_rates.py` - Live USD/ZAR exchange rate service
- `arb/exchanges/` - Exchange API clients (Luno, Binance)
- `models/` - Database models (Trade, FloatBalance, PnLRecord, Opportunity, ConfigHistory)
- `routes/` - REST API endpoints

### Frontend (React + Vite)
Located in `/frontend/`:
- React dashboard with Tailwind CSS
- Displays bot status, mode (paper/live), PnL, trades, exchange balances, and opportunities
- Live spread monitor with real-time prices
- Mode toggle and Start/Stop controls
- Auto-refreshes every 10 seconds
- Proxies API requests to backend in development

## API Endpoints
- `GET /status` - Bot health, mode, uptime, and current opportunity
- `GET /reports/trades` - Recent trade history
- `GET /reports/pnl` - Profit/loss summary
- `GET /reports/summary` - Overall statistics
- `GET /reports/opportunities` - Logged spread opportunities
- `GET /floats` - Exchange balance floats
- `GET /config` - Current configuration
- `POST /start` - Start the arbitrage bot
- `POST /stop` - Stop the arbitrage bot
- `POST /config` - Update configuration (mode, thresholds, etc.)

## Environment Variables

### Required for Production
- `DATABASE_URL` - PostgreSQL connection string (falls back to SQLite in dev)

### Exchange API Keys (for live trading)
- `LUNO_API_KEY` - Luno API key
- `LUNO_API_SECRET` - Luno API secret
- `BINANCE_API_KEY` - Binance API key
- `BINANCE_API_SECRET` - Binance API secret

### Database Configuration
- `CLEAR_DB_ON_STARTUP` - Clear all database tables on startup (default: false). Set to "true" on Railway to reset data on each deploy.

### Trading Configuration (all have defaults)
- `MODE` - Trading mode: "paper" or "live" (default: paper)
- `SPREAD_THRESHOLD` - Minimum spread % to execute (default: 0.5)
- `MIN_NET_EDGE_BPS` - Minimum net edge in basis points (default: 100)
- `MAX_TRADE_SIZE_BTC` - Maximum BTC per trade (default: 0.01)
- `MIN_TRADE_SIZE_BTC` - Minimum BTC per trade (default: 0.0001)
- `MAX_TRADE_ZAR` - Maximum ZAR per trade (default: 5000)
- `LOOP_INTERVAL_SECONDS` - Price check interval (default: 10)
- `SLIPPAGE_BPS_BUFFER` - Slippage buffer in bps (default: 10)
- `USD_ZAR_RATE` - USD to ZAR exchange rate (default: 18.5)
- `ERROR_STOP_COUNT` - Stop after N consecutive errors (default: 5)

See `.env.example` for full configuration template.

## Development
- Backend runs on port 8000
- Frontend runs on port 5000
- Frontend proxies API requests to backend automatically

## Trading Modes

### Paper Mode (Default)
- Logs opportunities and simulated trades
- No real orders placed on exchanges
- Safe for testing and development

### Live Mode
- Places real orders on Luno and Binance
- Requires valid API keys with trading permissions
- Only switch to live mode when ready for real trading

## Deployment

### Railway (Backend)
1. Push code to GitHub
2. Connect Railway to your GitHub repo
3. Set environment variables in Railway dashboard:
   - `DATABASE_URL` (use Railway's Postgres add-on)
   - Exchange API keys
   - `MODE=paper` (or `live` when ready)
4. Deploy with start command:
```
uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

### Frontend (Replit or Vercel)
Set environment variable:
```
VITE_API_BASE=https://your-backend-url.railway.app
```

## Arbitrage Strategy
- **Market-neutral**: No directional BTC exposure
- **Bidirectional**: Supports both Luno→Binance and Binance→Luno spreads
- **Hedged trades**: Simultaneous buy/sell across exchanges
- **Fee-aware**: Only executes when spread > fees + slippage + threshold
- **Risk controls**: Max trade size, min remaining balance, error stop count

## Database Models
- `trades` - Executed trades with prices, fees, and profit
- `opportunities` - Logged spread opportunities (executed or skipped)
- `float_balance` - Current exchange balances
- `pnl_records` - Daily PnL summaries
- `config_history` - Configuration change history

## Paper Trading Simulation

The paper mode simulates real-world trading with proper float tracking:

**Initial State:** 
- Luno: R5,000 ZAR + 0 BTC
- Binance: R5,000 equivalent in BTC (~0.003 BTC) + 0 USDT

**Trade Cycle:**
1. **luno_to_binance**: Spend ZAR to buy BTC on Luno, sell BTC on Binance for USDT
   - After: Luno has BTC, Binance has USDT
   - Next trade must be binance_to_luno (waiting for reversal)

2. **binance_to_luno**: Spend USDT to buy BTC on Binance, sell BTC on Luno for ZAR
   - After: Back to starting positions (minus fees)
   - Profit captured from spread differential

**Key Features:**
- Profit calculation: trade_size_zar × net_edge_percentage (e.g., R5,000 × 0.82% = R41)
- Trade size capped by available balances (prevents negative floats)
- Alternating direction enforcement (can't repeat same direction until reversal)
- Reset button to restart simulation

## Recent Changes
- December 31, 2025: Fixed paper trading simulation with proper float tracking and profit calculation
- December 31, 2025: Updated default Net Edge threshold to 1.0% (was 0.4%)
- December 31, 2025: Dashboard now displays all values in ZAR with percentages instead of bps
- December 30, 2025: Fixed Railway deployment (PORT handling, updated fallback FX rate to 17.0)
- December 30, 2025: Upgraded to high-speed architecture with WebSocket, 500ms checks, parallel order execution
- December 30, 2025: Added live USD/ZAR exchange rate fetching (was causing ~10% calculation error with static rate)
- December 29, 2025: Added paper/live mode, opportunities logging, config history, enhanced dashboard
- December 11, 2025: Initial project setup with full backend and frontend
- December 11, 2025: Added SQLite fallback for development, improved error handling
