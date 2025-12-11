# Crypto Arbitrage Bot

## Overview
A market-neutral crypto arbitrage bot that monitors BTC price spreads between Luno (South African exchange) and Binance, executing hedged trades when profitable opportunities are detected.

## Architecture

### Backend (FastAPI - Python)
Located in `/app/`:
- `main.py` - FastAPI entrypoint with CORS and lifecycle management
- `config.py` - Configuration from environment variables
- `database.py` - PostgreSQL/SQLite connection using SQLAlchemy (auto-fallback to SQLite in dev)
- `arb/loop.py` - Background arbitrage monitoring loop
- `arb/exchanges/` - Exchange API clients (Luno, Binance)
- `models/` - Database models (Trade, FloatBalance, PnLRecord)
- `routes/` - REST API endpoints

### Frontend (React + Vite)
Located in `/frontend/`:
- React dashboard with Tailwind CSS
- Displays bot status, PnL, trades, and exchange balances
- Auto-refreshes every 10 seconds
- Proxies API requests to backend in development

## API Endpoints
- `GET /status` - Bot health and current opportunity
- `GET /reports/trades` - Recent trade history
- `GET /reports/pnl` - Profit/loss summary
- `GET /reports/summary` - Overall statistics
- `GET /floats` - Exchange balance floats
- `GET /config` - Current configuration
- `POST /start` - Start the arbitrage bot
- `POST /stop` - Stop the arbitrage bot
- `POST /config` - Update configuration

## Environment Variables

### Required for Production
- `DATABASE_URL` - PostgreSQL connection string (falls back to SQLite in dev)

### Exchange API Keys (for live trading)
- `LUNO_API_KEY` - Luno API key
- `LUNO_API_SECRET` - Luno API secret
- `BINANCE_API_KEY` - Binance API key
- `BINANCE_API_SECRET` - Binance API secret

### Trading Configuration (all have defaults)
- `SPREAD_THRESHOLD` - Minimum spread % to execute (default: 0.5)
- `MAX_TRADE_SIZE_BTC` - Maximum BTC per trade (default: 0.01)
- `MIN_TRADE_SIZE_BTC` - Minimum BTC per trade (default: 0.0001)
- `LOOP_INTERVAL_SECONDS` - Price check interval (default: 10)
- `USD_ZAR_RATE` - USD to ZAR exchange rate (default: 18.5)

See `.env.example` for full configuration template.

## Development
- Backend runs on port 8000
- Frontend runs on port 5000
- Frontend proxies API requests to backend automatically

## Deployment

### Railway (Backend)
1. Push code to GitHub
2. Connect Railway to your GitHub repo
3. Set environment variables in Railway dashboard:
   - `DATABASE_URL` (use Railway's Postgres add-on)
   - Exchange API keys
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
- **Fee-aware**: Only executes when spread > fees + threshold

## Recent Changes
- December 11, 2025: Initial project setup with full backend and frontend
- December 11, 2025: Added SQLite fallback for development, improved error handling
