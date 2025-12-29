# Railway Deployment Guide - Crypto Arbitrage Bot

## Step 1: Push Code to GitHub

First, push your code to a GitHub repository:

1. Create a new repository on GitHub (e.g., `crypto-arbitrage-bot`)
2. In your Replit project, open the Shell and run:
   ```bash
   git remote add origin https://github.com/YOUR_USERNAME/crypto-arbitrage-bot.git
   git branch -M main
   git push -u origin main
   ```

## Step 2: Create Railway Project

1. Go to [railway.app](https://railway.app) and sign in with GitHub
2. Click **"New Project"**
3. Select **"Deploy from GitHub repo"**
4. Choose your `crypto-arbitrage-bot` repository
5. Railway will automatically detect Python and start building

## Step 3: Add PostgreSQL Database

1. In your Railway project, click **"+ New"**
2. Select **"Database"** → **"Add PostgreSQL"**
3. Railway will create a PostgreSQL instance and automatically set `DATABASE_URL`

## Step 4: Configure Environment Variables

In your Railway project, go to **Variables** tab and add:

### Required API Keys (copy from Replit Secrets):
```
LUNO_API_KEY=your_luno_api_key
LUNO_API_SECRET=your_luno_api_secret
BINANCE_API_KEY=your_binance_api_key
BINANCE_API_SECRET=your_binance_api_secret
```

### Trading Configuration (Paper Mode - Safe for Testing):
```
MODE=paper
SPREAD_THRESHOLD=0.5
MIN_NET_EDGE_BPS=40
MAX_TRADE_SIZE_BTC=0.01
MIN_TRADE_SIZE_BTC=0.0001
MAX_TRADE_ZAR=5000
LOOP_INTERVAL_SECONDS=10
SLIPPAGE_BPS_BUFFER=10
USD_ZAR_RATE=18.5
ERROR_STOP_COUNT=5
```

### Fee Configuration:
```
LUNO_TRADING_FEE=0.001
BINANCE_TRADING_FEE=0.001
```

## Step 5: Deploy

1. Railway should auto-deploy when you push to GitHub
2. Check the **Deployments** tab to see build progress
3. Once deployed, click on the deployment to see logs

## Step 6: Get Your Backend URL

1. Go to **Settings** → **Networking** → **Generate Domain**
2. Railway will give you a URL like: `https://crypto-arbitrage-bot-production.up.railway.app`
3. Test it by visiting: `https://YOUR_URL/health`

## Step 7: Connect Frontend to Backend

In Replit, update the frontend environment variable:

1. Go to **Secrets** in Replit
2. Add: `VITE_API_BASE=https://YOUR_RAILWAY_URL`
3. Restart the Frontend Dashboard workflow

## Verification Checklist

After deployment, verify:

- [ ] Visit `/health` endpoint - should return `{"status": "healthy"}`
- [ ] Visit `/status` endpoint - should show bot running in paper mode
- [ ] Visit `/config` endpoint - should show your configuration
- [ ] Check Railway logs - should see "Arbitrage loop started in PAPER mode"
- [ ] Frontend dashboard connects and shows data

## Switching to Live Mode

**WARNING: Only do this when ready for real trading!**

1. In Railway Variables, change: `MODE=live`
2. Railway will auto-redeploy
3. The bot will now place REAL orders on exchanges

## Monitoring

- **Railway Logs**: Real-time logs in Railway dashboard
- **Frontend Dashboard**: Visual monitoring at your Replit URL
- **API Endpoints**:
  - `GET /status` - Bot status and current opportunity
  - `GET /reports/trades` - Trade history
  - `GET /reports/opportunities` - All detected opportunities
  - `GET /reports/pnl` - Profit/Loss summary

## Troubleshooting

### Bot not starting?
- Check Railway logs for errors
- Verify all environment variables are set
- Ensure DATABASE_URL is connected

### No prices showing?
- Verify API keys are correct
- Check if Binance/Luno APIs are accessible from Railway

### Database errors?
- Make sure PostgreSQL is added and linked
- DATABASE_URL should be auto-populated by Railway

## Cost Estimation

Railway pricing (as of 2024):
- **Hobby Plan**: $5/month (includes $5 credit)
- **Usage-based**: ~$0.01/hour for small apps
- **PostgreSQL**: Included in usage

For 24/7 operation, expect ~$5-10/month.

## Support

If you encounter issues:
1. Check Railway deployment logs
2. Verify all environment variables
3. Test API endpoints manually
4. Review the `/reports/opportunities` endpoint for logged data
