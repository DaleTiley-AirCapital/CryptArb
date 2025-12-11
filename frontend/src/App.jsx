import { useState, useEffect } from 'react'
import { fetchStatus, fetchSummary, fetchTrades, fetchFloats, startBot, stopBot } from './api'

function StatusCard({ title, value, subtitle, color = 'green' }) {
  const colorClasses = {
    green: 'bg-green-500/20 border-green-500/50 text-green-400',
    red: 'bg-red-500/20 border-red-500/50 text-red-400',
    blue: 'bg-blue-500/20 border-blue-500/50 text-blue-400',
    yellow: 'bg-yellow-500/20 border-yellow-500/50 text-yellow-400',
  }

  return (
    <div className={`p-4 rounded-lg border ${colorClasses[color]}`}>
      <div className="text-sm opacity-75">{title}</div>
      <div className="text-2xl font-bold mt-1">{value}</div>
      {subtitle && <div className="text-xs opacity-60 mt-1">{subtitle}</div>}
    </div>
  )
}

function TradesTable({ trades }) {
  if (!trades || trades.length === 0) {
    return (
      <div className="text-center py-8 text-slate-400">
        No trades yet. The bot will execute trades when profitable spreads are detected.
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-700">
            <th className="text-left p-2">Time</th>
            <th className="text-left p-2">Direction</th>
            <th className="text-right p-2">BTC Amount</th>
            <th className="text-right p-2">Spread %</th>
            <th className="text-right p-2">Profit (USD)</th>
            <th className="text-left p-2">Status</th>
          </tr>
        </thead>
        <tbody>
          {trades.map((trade) => (
            <tr key={trade.id} className="border-b border-slate-800 hover:bg-slate-800/50">
              <td className="p-2">{new Date(trade.timestamp).toLocaleString()}</td>
              <td className="p-2">
                <span className={`px-2 py-1 rounded text-xs ${
                  trade.direction === 'luno_to_binance' 
                    ? 'bg-blue-500/20 text-blue-400' 
                    : 'bg-purple-500/20 text-purple-400'
                }`}>
                  {trade.direction === 'luno_to_binance' ? 'Luno → Binance' : 'Binance → Luno'}
                </span>
              </td>
              <td className="p-2 text-right font-mono">{trade.btc_amount?.toFixed(6)}</td>
              <td className="p-2 text-right font-mono">{trade.spread_percent?.toFixed(2)}%</td>
              <td className={`p-2 text-right font-mono ${trade.profit_usd >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                ${trade.profit_usd?.toFixed(2)}
              </td>
              <td className="p-2">
                <span className={`px-2 py-1 rounded text-xs ${
                  trade.status === 'completed' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'
                }`}>
                  {trade.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function FloatsDisplay({ floats }) {
  if (!floats) return null

  const exchanges = [
    { name: 'Luno', key: 'luno', currencies: ['XBT', 'ZAR'] },
    { name: 'Binance', key: 'binance', currencies: ['BTC', 'USDT'] }
  ]

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {exchanges.map((exchange) => (
        <div key={exchange.key} className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
          <h3 className="text-lg font-semibold mb-3">{exchange.name}</h3>
          <div className="space-y-2">
            {exchange.currencies.map((currency) => {
              const balance = floats[exchange.key]?.[currency]
              return (
                <div key={currency} className="flex justify-between items-center">
                  <span className="text-slate-400">{currency}</span>
                  <span className="font-mono">
                    {balance?.balance?.toFixed(currency === 'ZAR' || currency === 'USDT' ? 2 : 6) || '0.00'}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

function App() {
  const [status, setStatus] = useState(null)
  const [summary, setSummary] = useState(null)
  const [trades, setTrades] = useState([])
  const [floats, setFloats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const loadData = async () => {
    try {
      const [statusData, summaryData, tradesData, floatsData] = await Promise.all([
        fetchStatus(),
        fetchSummary(),
        fetchTrades(20),
        fetchFloats()
      ])
      setStatus(statusData)
      setSummary(summaryData)
      setTrades(tradesData.trades || [])
      setFloats(floatsData.floats)
      setError(null)
    } catch (err) {
      setError('Failed to connect to backend. Make sure the API is running.')
      console.error('Error loading data:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
    const interval = setInterval(loadData, 10000)
    return () => clearInterval(interval)
  }, [])

  const handleStartStop = async () => {
    try {
      if (status?.bot?.running) {
        await stopBot()
      } else {
        await startBot()
      }
      await loadData()
    } catch (err) {
      console.error('Error toggling bot:', err)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Loading dashboard...</div>
      </div>
    )
  }

  const botRunning = status?.bot?.running
  const totalPnL = summary?.all_time?.total_profit_usd || 0
  const totalTrades = summary?.all_time?.total_trades || 0
  const todayPnL = summary?.today?.profit_usd || 0
  const lastSpread = status?.bot?.last_opportunity?.spread_percent

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-7xl mx-auto">
        <header className="mb-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold">Crypto Arbitrage Dashboard</h1>
              <p className="text-slate-400 mt-1">BTC/ZAR - Luno ↔ Binance</p>
            </div>
            <button
              onClick={handleStartStop}
              className={`px-6 py-3 rounded-lg font-semibold transition ${
                botRunning
                  ? 'bg-red-600 hover:bg-red-700'
                  : 'bg-green-600 hover:bg-green-700'
              }`}
            >
              {botRunning ? 'Stop Bot' : 'Start Bot'}
            </button>
          </div>
        </header>

        {error && (
          <div className="mb-6 p-4 bg-red-500/20 border border-red-500/50 rounded-lg text-red-400">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatusCard
            title="Bot Status"
            value={botRunning ? 'Running' : 'Stopped'}
            subtitle={status?.bot?.last_check ? `Last check: ${new Date(status.bot.last_check).toLocaleTimeString()}` : null}
            color={botRunning ? 'green' : 'red'}
          />
          <StatusCard
            title="Total PnL"
            value={`$${totalPnL.toFixed(2)}`}
            subtitle={`${totalTrades} total trades`}
            color={totalPnL >= 0 ? 'green' : 'red'}
          />
          <StatusCard
            title="Today's PnL"
            value={`$${todayPnL.toFixed(2)}`}
            subtitle={`${summary?.today?.trade_count || 0} trades today`}
            color={todayPnL >= 0 ? 'green' : 'red'}
          />
          <StatusCard
            title="Current Spread"
            value={lastSpread ? `${lastSpread.toFixed(2)}%` : 'N/A'}
            subtitle={status?.bot?.last_opportunity?.direction?.replace('_', ' → ')}
            color="blue"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <div className="lg:col-span-2 bg-slate-800/30 rounded-lg p-6 border border-slate-700">
            <h2 className="text-xl font-semibold mb-4">Recent Trades</h2>
            <TradesTable trades={trades} />
          </div>
          <div className="bg-slate-800/30 rounded-lg p-6 border border-slate-700">
            <h2 className="text-xl font-semibold mb-4">Exchange Balances</h2>
            <FloatsDisplay floats={floats} />
          </div>
        </div>

        <div className="bg-slate-800/30 rounded-lg p-6 border border-slate-700">
          <h2 className="text-xl font-semibold mb-4">Opportunity Monitor</h2>
          {status?.bot?.last_opportunity ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <div className="text-slate-400 text-sm">Direction</div>
                <div className="font-semibold">
                  {status.bot.last_opportunity.direction === 'luno_to_binance' 
                    ? 'Buy Luno → Sell Binance' 
                    : 'Buy Binance → Sell Luno'}
                </div>
              </div>
              <div>
                <div className="text-slate-400 text-sm">Gross Spread</div>
                <div className="font-semibold">{status.bot.last_opportunity.spread_percent?.toFixed(3)}%</div>
              </div>
              <div>
                <div className="text-slate-400 text-sm">Net Spread (after fees)</div>
                <div className={`font-semibold ${status.bot.last_opportunity.net_spread >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {status.bot.last_opportunity.net_spread?.toFixed(3)}%
                </div>
              </div>
              <div>
                <div className="text-slate-400 text-sm">Profitable?</div>
                <div className={`font-semibold ${status.bot.last_opportunity.is_profitable ? 'text-green-400' : 'text-yellow-400'}`}>
                  {status.bot.last_opportunity.is_profitable ? 'Yes' : 'Below threshold'}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-slate-400">Waiting for price data...</div>
          )}
        </div>

        <footer className="mt-8 text-center text-slate-500 text-sm">
          <p>Refresh interval: 10 seconds | Data from Luno and Binance APIs</p>
        </footer>
      </div>
    </div>
  )
}

export default App
