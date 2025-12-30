import { useState, useEffect } from 'react'
import { fetchStatus, fetchSummary, fetchTrades, fetchFloats, fetchConfig, updateConfig, fetchOpportunities, startBot, stopBot } from './api'

function StatusCard({ title, value, subtitle, color = 'green' }) {
  const colorClasses = {
    green: 'bg-green-500/20 border-green-500/50 text-green-400',
    red: 'bg-red-500/20 border-red-500/50 text-red-400',
    blue: 'bg-blue-500/20 border-blue-500/50 text-blue-400',
    yellow: 'bg-yellow-500/20 border-yellow-500/50 text-yellow-400',
    purple: 'bg-purple-500/20 border-purple-500/50 text-purple-400',
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
                ${trade.profit_usd?.toFixed(4)}
              </td>
              <td className="p-2">
                <span className={`px-2 py-1 rounded text-xs ${
                  trade.status === 'completed' ? 'bg-green-500/20 text-green-400' : 
                  trade.status === 'paper' ? 'bg-yellow-500/20 text-yellow-400' :
                  'bg-slate-500/20 text-slate-400'
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

function OpportunitiesTable({ opportunities }) {
  if (!opportunities || opportunities.length === 0) {
    return (
      <div className="text-center py-4 text-slate-400">
        No opportunities logged yet.
      </div>
    )
  }

  return (
    <div className="overflow-x-auto max-h-64">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-slate-900">
          <tr className="border-b border-slate-700">
            <th className="text-left p-2">Time</th>
            <th className="text-left p-2">Direction</th>
            <th className="text-right p-2">Gross (bps)</th>
            <th className="text-right p-2">Net (bps)</th>
            <th className="text-left p-2">Executed</th>
          </tr>
        </thead>
        <tbody>
          {opportunities.slice(0, 20).map((opp) => (
            <tr key={opp.id} className="border-b border-slate-800 hover:bg-slate-800/50">
              <td className="p-2 text-xs">{new Date(opp.timestamp).toLocaleTimeString()}</td>
              <td className="p-2">
                <span className={`px-1 py-0.5 rounded text-xs ${
                  opp.direction === 'luno_to_binance' 
                    ? 'bg-blue-500/20 text-blue-400' 
                    : 'bg-purple-500/20 text-purple-400'
                }`}>
                  {opp.direction === 'luno_to_binance' ? 'L→B' : 'B→L'}
                </span>
              </td>
              <td className="p-2 text-right font-mono text-xs">{opp.gross_edge_bps?.toFixed(1)}</td>
              <td className={`p-2 text-right font-mono text-xs ${opp.net_edge_bps >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {opp.net_edge_bps?.toFixed(1)}
              </td>
              <td className="p-2">
                {opp.was_executed ? (
                  <span className="text-green-400 text-xs">Yes</span>
                ) : (
                  <span className="text-slate-500 text-xs">No</span>
                )}
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

function formatUptime(seconds) {
  if (!seconds) return 'N/A'
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)
  if (hours > 0) return `${hours}h ${minutes}m`
  if (minutes > 0) return `${minutes}m ${secs}s`
  return `${secs}s`
}

function App() {
  const [status, setStatus] = useState(null)
  const [summary, setSummary] = useState(null)
  const [trades, setTrades] = useState([])
  const [floats, setFloats] = useState(null)
  const [config, setConfig] = useState(null)
  const [opportunities, setOpportunities] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const loadFastData = async () => {
    try {
      const [statusData, oppsData] = await Promise.all([
        fetchStatus(),
        fetchOpportunities(50)
      ])
      setStatus(statusData)
      setOpportunities(oppsData.opportunities || [])
      setError(null)
    } catch (err) {
      setError('Failed to connect to backend. Make sure the API is running.')
      console.error('Error loading data:', err)
    } finally {
      setLoading(false)
    }
  }

  const loadSlowData = async () => {
    try {
      const [summaryData, tradesData, floatsData, configData] = await Promise.all([
        fetchSummary(),
        fetchTrades(20),
        fetchFloats(),
        fetchConfig()
      ])
      setSummary(summaryData)
      setTrades(tradesData.trades || [])
      setFloats(floatsData.floats)
      setConfig(configData)
    } catch (err) {
      console.error('Error loading slow data:', err)
    }
  }

  useEffect(() => {
    loadFastData()
    loadSlowData()
    const fastInterval = setInterval(loadFastData, 2000)
    const slowInterval = setInterval(loadSlowData, 10000)
    return () => {
      clearInterval(fastInterval)
      clearInterval(slowInterval)
    }
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

  const handleModeToggle = async () => {
    try {
      const newMode = config?.mode === 'paper' ? 'live' : 'paper'
      await updateConfig({ mode: newMode })
      await loadData()
    } catch (err) {
      console.error('Error toggling mode:', err)
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
  const botMode = status?.bot?.mode || config?.mode || 'paper'
  const uptime = status?.bot?.uptime_seconds
  const totalPnL = summary?.all_time?.total_profit_usd || 0
  const totalTrades = summary?.all_time?.total_trades || 0
  const todayPnL = summary?.today?.profit_usd || 0
  const lastOpportunity = status?.bot?.last_opportunity

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-7xl mx-auto">
        <header className="mb-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold">Crypto Arbitrage Dashboard</h1>
              <p className="text-slate-400 mt-1">BTC/ZAR - Luno ↔ Binance</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleModeToggle}
                className={`px-4 py-2 rounded-lg font-semibold transition text-sm ${
                  botMode === 'paper'
                    ? 'bg-yellow-600 hover:bg-yellow-700'
                    : 'bg-green-600 hover:bg-green-700'
                }`}
              >
                {botMode === 'paper' ? 'Paper Mode' : 'Live Mode'}
              </button>
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
          </div>
        </header>

        {error && (
          <div className="mb-6 p-4 bg-red-500/20 border border-red-500/50 rounded-lg text-red-400">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
          <StatusCard
            title="Bot Status"
            value={botRunning ? 'Running' : 'Stopped'}
            subtitle={uptime ? `Uptime: ${formatUptime(uptime)}` : (status?.bot?.last_check ? `Last: ${new Date(status.bot.last_check).toLocaleTimeString()}` : null)}
            color={botRunning ? 'green' : 'red'}
          />
          <StatusCard
            title="Mode"
            value={botMode === 'paper' ? 'Paper' : 'Live'}
            subtitle={botMode === 'paper' ? 'Simulated trades' : 'Real trades'}
            color={botMode === 'paper' ? 'yellow' : 'purple'}
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
            title="Net Edge"
            value={lastOpportunity?.net_edge_bps ? `${lastOpportunity.net_edge_bps.toFixed(1)} bps` : 'N/A'}
            subtitle={lastOpportunity?.direction?.replace('_to_', ' → ')}
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

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div className="bg-slate-800/30 rounded-lg p-6 border border-slate-700">
            <h2 className="text-xl font-semibold mb-4">Live Spread Monitor</h2>
            {lastOpportunity && !lastOpportunity.error ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-slate-400 text-sm">Luno BTC/ZAR</div>
                    <div className="font-mono text-lg">R {lastOpportunity.luno_zar?.toLocaleString() || 'N/A'}</div>
                    <div className="text-slate-500 text-xs">
                      Bid: R{lastOpportunity.luno_bid?.toLocaleString()} | Ask: R{lastOpportunity.luno_ask?.toLocaleString()}
                    </div>
                    <div className="text-slate-500 text-xs">≈ ${lastOpportunity.luno_usd?.toFixed(2) || 'N/A'}</div>
                  </div>
                  <div>
                    <div className="text-slate-400 text-sm">Binance BTC/USDT</div>
                    <div className="font-mono text-lg">${lastOpportunity.binance_usd?.toLocaleString() || 'N/A'}</div>
                    <div className="text-slate-500 text-xs">
                      Bid: ${lastOpportunity.binance_bid?.toFixed(2)} | Ask: ${lastOpportunity.binance_ask?.toFixed(2)}
                    </div>
                  </div>
                </div>
                <div className="text-center text-xs text-slate-400 border-t border-slate-700 pt-2">
                  USD/ZAR Rate: {lastOpportunity.usd_zar_rate?.toFixed(4) || 'N/A'} (Live)
                </div>
                <div className="border-t border-slate-700 pt-4">
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <div className="text-slate-400 text-xs">Gross Edge</div>
                      <div className="font-semibold">{lastOpportunity.gross_edge_bps?.toFixed(1) || '0'} bps</div>
                    </div>
                    <div>
                      <div className="text-slate-400 text-xs">Net Edge</div>
                      <div className={`font-semibold ${lastOpportunity.net_edge_bps >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {lastOpportunity.net_edge_bps?.toFixed(1) || '0'} bps
                      </div>
                    </div>
                    <div>
                      <div className="text-slate-400 text-xs">Profitable?</div>
                      <div className={`font-semibold ${lastOpportunity.is_profitable ? 'text-green-400' : 'text-yellow-400'}`}>
                        {lastOpportunity.is_profitable ? 'Yes' : 'No'}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-slate-400">
                {lastOpportunity?.error || 'Waiting for price data...'}
              </div>
            )}
          </div>

          <div className="bg-slate-800/30 rounded-lg p-6 border border-slate-700">
            <h2 className="text-xl font-semibold mb-4">Recent Opportunities</h2>
            <OpportunitiesTable opportunities={opportunities} />
          </div>
        </div>

        <div className="bg-slate-800/30 rounded-lg p-6 border border-slate-700 mb-8">
          <h2 className="text-xl font-semibold mb-4">Configuration</h2>
          {config && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-slate-400">Min Net Edge:</span>
                <span className="ml-2 font-mono">{config.min_net_edge_bps} bps</span>
              </div>
              <div>
                <span className="text-slate-400">Max Trade BTC:</span>
                <span className="ml-2 font-mono">{config.max_trade_size_btc}</span>
              </div>
              <div>
                <span className="text-slate-400">Max Trade ZAR:</span>
                <span className="ml-2 font-mono">R {config.max_trade_zar?.toLocaleString()}</span>
              </div>
              <div>
                <span className="text-slate-400">Slippage Buffer:</span>
                <span className="ml-2 font-mono">{config.slippage_bps_buffer} bps</span>
              </div>
              <div>
                <span className="text-slate-400">Poll Interval:</span>
                <span className="ml-2 font-mono">{config.loop_interval_seconds}s</span>
              </div>
              <div>
                <span className="text-slate-400">Luno Fee:</span>
                <span className="ml-2 font-mono">{(config.luno_trading_fee * 100).toFixed(2)}%</span>
              </div>
              <div>
                <span className="text-slate-400">Binance Fee:</span>
                <span className="ml-2 font-mono">{(config.binance_trading_fee * 100).toFixed(2)}%</span>
              </div>
              <div>
                <span className="text-slate-400">USD/ZAR Rate:</span>
                <span className="ml-2 font-mono">{config.usd_zar_rate}</span>
              </div>
            </div>
          )}
        </div>

        <footer className="mt-8 text-center text-slate-500 text-sm">
          <p>Status: 2s | Config: 10s | Check interval: {status?.bot?.check_interval_ms || 500}ms | WebSocket: {status?.bot?.price_service?.ws_connected ? '✓ Connected' : '○ Connecting'}</p>
          <p className="mt-1">
            API Status: {config?.luno_api_configured ? '✓ Luno' : '✗ Luno'} | {config?.binance_api_configured ? '✓ Binance' : '✗ Binance'}
            {status?.bot?.stats && ` | Checks: ${status.bot.stats.checks} | Opportunities: ${status.bot.stats.opportunities_found}`}
          </p>
        </footer>
      </div>
    </div>
  )
}

export default App
