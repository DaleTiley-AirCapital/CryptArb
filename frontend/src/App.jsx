import { useState, useEffect } from 'react'
import { fetchStatus, fetchSummary, fetchTrades, fetchFloats, fetchConfig, updateConfig, fetchOpportunities, fetchMissedOpportunities, startBot, stopBot, resetPaperFloats, exportToCSV, fetchNetEdgeAnalysis } from './api'

function Toast({ message, type, onClose }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 4000)
    return () => clearTimeout(timer)
  }, [onClose])

  const bgColor = type === 'success' ? 'bg-green-600' : 'bg-red-600'

  return (
    <div className={`${bgColor} text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-3`}>
      <span>{type === 'success' ? '✓' : '✕'}</span>
      <span>{message}</span>
      <button onClick={onClose} className="ml-2 hover:opacity-75">×</button>
    </div>
  )
}

function ToastContainer({ toasts, removeToast }) {
  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map((toast) => (
        <Toast key={toast.id} message={toast.message} type={toast.type} onClose={() => removeToast(toast.id)} />
      ))}
    </div>
  )
}

function SettingsModal({ config, onClose, onSave, showToast }) {
  const [formData, setFormData] = useState({
    mode: config?.mode || 'paper',
    min_net_edge_bps: config?.min_net_edge_bps ?? 40,
    max_trade_size_btc: config?.max_trade_size_btc ?? 0.01,
    min_trade_size_btc: config?.min_trade_size_btc ?? 0.0001,
    max_trade_zar: config?.max_trade_zar ?? 5000,
    loop_interval_seconds: config?.loop_interval_seconds ?? 0.5,
    slippage_bps_buffer: config?.slippage_bps_buffer ?? 10,
    min_remaining_zar_luno: config?.min_remaining_zar_luno ?? 1000,
    min_remaining_btc_binance: config?.min_remaining_btc_binance ?? 0.001,
  })
  const [saving, setSaving] = useState(false)

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await updateConfig({
        mode: formData.mode,
        min_net_edge_bps: parseFloat(formData.min_net_edge_bps),
        max_trade_size_btc: parseFloat(formData.max_trade_size_btc),
        min_trade_size_btc: parseFloat(formData.min_trade_size_btc),
        max_trade_zar: parseFloat(formData.max_trade_zar),
        loop_interval_seconds: parseFloat(formData.loop_interval_seconds),
        slippage_bps_buffer: parseFloat(formData.slippage_bps_buffer),
        min_remaining_zar_luno: parseFloat(formData.min_remaining_zar_luno),
        min_remaining_btc_binance: parseFloat(formData.min_remaining_btc_binance),
      })
      showToast('Configuration saved successfully', 'success')
      onSave()
      onClose()
    } catch (err) {
      showToast('Failed to save configuration', 'error')
      console.error('Error saving config:', err)
    } finally {
      setSaving(false)
    }
  }

  const inputClass = "w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500"
  const labelClass = "block text-slate-400 text-sm mb-1"

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-40" onClick={onClose}>
      <div className="bg-slate-800 rounded-lg p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto border border-slate-700" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold">Bot Settings</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-2xl">&times;</button>
        </div>

        <div className="space-y-4">
          <div>
            <label className={labelClass}>Mode</label>
            <select
              value={formData.mode}
              onChange={(e) => handleChange('mode', e.target.value)}
              className={inputClass}
            >
              <option value="paper">Paper (Simulated)</option>
              <option value="live">Live (Real Trades)</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Min Net Edge (%)</label>
              <input
                type="number"
                step="0.01"
                value={(formData.min_net_edge_bps / 100).toFixed(2)}
                onChange={(e) => handleChange('min_net_edge_bps', parseFloat(e.target.value) * 100)}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Slippage Buffer (%)</label>
              <input
                type="number"
                step="0.01"
                value={(formData.slippage_bps_buffer / 100).toFixed(2)}
                onChange={(e) => handleChange('slippage_bps_buffer', parseFloat(e.target.value) * 100)}
                className={inputClass}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Max Trade Size (BTC)</label>
              <input
                type="number"
                step="0.0001"
                value={formData.max_trade_size_btc}
                onChange={(e) => handleChange('max_trade_size_btc', e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Min Trade Size (BTC)</label>
              <input
                type="number"
                step="0.0001"
                value={formData.min_trade_size_btc}
                onChange={(e) => handleChange('min_trade_size_btc', e.target.value)}
                className={inputClass}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Max Trade (ZAR)</label>
              <input
                type="number"
                step="100"
                value={formData.max_trade_zar}
                onChange={(e) => handleChange('max_trade_zar', e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Loop Interval (seconds)</label>
              <input
                type="number"
                step="0.1"
                value={formData.loop_interval_seconds}
                onChange={(e) => handleChange('loop_interval_seconds', e.target.value)}
                className={inputClass}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Min Remaining ZAR (Luno)</label>
              <input
                type="number"
                step="100"
                value={formData.min_remaining_zar_luno}
                onChange={(e) => handleChange('min_remaining_zar_luno', e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Min Remaining BTC (Binance)</label>
              <input
                type="number"
                step="0.0001"
                value={formData.min_remaining_btc_binance}
                onChange={(e) => handleChange('min_remaining_btc_binance', e.target.value)}
                className={inputClass}
              />
            </div>
          </div>
        </div>

        <div className="flex gap-3 mt-6 pt-4 border-t border-slate-700">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:cursor-not-allowed rounded-lg transition flex items-center justify-center gap-2"
          >
            {saving ? (
              <>
                <span className="animate-spin">⟳</span>
                Saving...
              </>
            ) : (
              'Save Settings'
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

function GearIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
    </svg>
  )
}

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

function TradesTable({ trades, usdZarRate = 17 }) {
  if (!trades || trades.length === 0) {
    return (
      <div className="text-center py-8 text-slate-400">
        No trades yet. The bot will execute trades when profitable spreads are detected.
      </div>
    )
  }

  return (
    <div className="overflow-x-auto max-h-96 overflow-y-auto">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-slate-900">
          <tr className="border-b border-slate-700">
            <th className="text-left p-2">Time</th>
            <th className="text-left p-2">Direction</th>
            <th className="text-right p-2">BTC Amount</th>
            <th className="text-right p-2">Spread %</th>
            <th className="text-right p-2">Profit (ZAR)</th>
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
              <td className={`p-2 text-right font-mono ${(trade.profit_zar ?? trade.profit_usd) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                R {(trade.profit_zar ?? (trade.profit_usd * usdZarRate))?.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
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
    <div className="overflow-x-auto max-h-96 overflow-y-auto">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-slate-900">
          <tr className="border-b border-slate-700">
            <th className="text-left p-2">Time</th>
            <th className="text-left p-2">Direction</th>
            <th className="text-right p-2">Gross %</th>
            <th className="text-right p-2">Net %</th>
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
              <td className="p-2 text-right font-mono text-xs">{(opp.gross_edge_bps / 100)?.toFixed(2)}%</td>
              <td className={`p-2 text-right font-mono text-xs ${opp.net_edge_bps >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {(opp.net_edge_bps / 100)?.toFixed(2)}%
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

function MissedOpportunitiesTable({ opportunities }) {
  if (!opportunities || opportunities.length === 0) {
    return (
      <div className="text-center py-4 text-slate-400">
        No missed opportunities yet.
      </div>
    )
  }

  return (
    <div className="overflow-x-auto max-h-96 overflow-y-auto">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-slate-900">
          <tr className="border-b border-amber-500/30">
            <th className="text-left p-2">Time</th>
            <th className="text-left p-2">Direction</th>
            <th className="text-right p-2">Gross %</th>
            <th className="text-right p-2">Net %</th>
            <th className="text-left p-2">Reason Skipped</th>
          </tr>
        </thead>
        <tbody>
          {opportunities.slice(0, 50).map((opp) => (
            <tr key={opp.id} className="border-b border-slate-800 hover:bg-amber-500/10">
              <td className="p-2 text-xs text-amber-200">{new Date(opp.timestamp).toLocaleTimeString()}</td>
              <td className="p-2">
                <span className={`px-1 py-0.5 rounded text-xs ${
                  opp.direction === 'luno_to_binance' 
                    ? 'bg-amber-500/20 text-amber-400' 
                    : 'bg-red-500/20 text-red-400'
                }`}>
                  {opp.direction === 'luno_to_binance' ? 'L→B' : 'B→L'}
                </span>
              </td>
              <td className="p-2 text-right font-mono text-xs text-amber-300">{(opp.gross_edge_bps / 100)?.toFixed(2)}%</td>
              <td className={`p-2 text-right font-mono text-xs ${opp.net_edge_bps >= 0 ? 'text-amber-400' : 'text-red-400'}`}>
                {(opp.net_edge_bps / 100)?.toFixed(2)}%
              </td>
              <td className="p-2 text-xs text-red-400">
                {opp.reason_skipped || 'Unknown'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function DownloadIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
    </svg>
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

function PaperFloatsDisplay({ paperFloats, onReset, usdZarRate }) {
  if (!paperFloats) return null

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="bg-slate-800/50 rounded-lg p-4 border border-amber-500/30">
        <h3 className="text-lg font-semibold mb-3 text-amber-400">Luno</h3>
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-slate-400">ZAR</span>
            <span className="font-mono">R {paperFloats.luno_zar?.toFixed(2)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-slate-400">BTC</span>
            <span className="font-mono">{paperFloats.luno_btc?.toFixed(6)}</span>
          </div>
        </div>
      </div>
      <div className="bg-slate-800/50 rounded-lg p-4 border border-amber-500/30">
        <h3 className="text-lg font-semibold mb-3 text-amber-400">Binance</h3>
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-slate-400">BTC</span>
            <span className="font-mono">{paperFloats.binance_btc?.toFixed(6)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-slate-400">USDT</span>
            <span className="font-mono">${paperFloats.binance_usdt?.toFixed(2)}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

function SimulatedBalancesSection({ paperFloats, onReset, usdZarRate }) {
  if (!paperFloats) return null

  return (
    <div className="bg-slate-800/30 rounded-lg p-6 border border-amber-500/40">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold text-amber-400">Simulated Trade Balances</h2>
        <button
          onClick={onReset}
          className="px-3 py-1.5 text-sm bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 rounded border border-amber-500/30"
        >
          Reset Floats
        </button>
      </div>
      <PaperFloatsDisplay paperFloats={paperFloats} onReset={onReset} usdZarRate={usdZarRate} />
      {paperFloats.last_direction && (
        <div className="mt-4 pt-3 border-t border-amber-500/20 text-sm text-slate-400">
          Last trade: <span className="text-amber-300">{paperFloats.last_direction === 'binance_to_luno' ? 'Binance → Luno' : 'Luno → Binance'}</span>
          <span className="ml-2 text-slate-500">(Waiting for reversal)</span>
        </div>
      )}
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

function NetEdgeAnalysis({ data, hours, onHoursChange, currentThresholdBps }) {
  const timeRanges = [
    { label: '1h', value: 1 },
    { label: '6h', value: 6 },
    { label: '12h', value: 12 },
    { label: '24h', value: 24 },
    { label: '48h', value: 48 },
    { label: '72h', value: 72 },
    { label: '7d', value: 168 },
  ]

  if (!data || data.message || !data.distribution) {
    return (
      <div className="text-center py-4 text-slate-400">
        {data?.message || 'No analysis data available'}
      </div>
    )
  }

  const { stats, distribution, opportunities_per_threshold, total_opportunities } = data

  const distributionValues = Object.values(distribution || {})
  const maxBucketCount = distributionValues.length > 0 ? Math.max(...distributionValues) : 0

  const thresholdLabels = {
    "0.25%": 25,
    "0.50%": 50,
    "0.75%": 75,
    "1.00%": 100,
    "1.25%": 125,
    "1.50%": 150,
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {timeRanges.map((range) => (
          <button
            key={range.value}
            onClick={() => onHoursChange(range.value)}
            className={`px-3 py-1.5 text-sm rounded transition ${
              hours === range.value
                ? 'bg-blue-600 text-white'
                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
          >
            {range.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-slate-700/50 rounded-lg p-3">
          <div className="text-slate-400 text-xs">Min Net Edge</div>
          <div className="text-lg font-mono text-blue-400">{stats.min_net_edge_pct?.toFixed(2)}%</div>
        </div>
        <div className="bg-slate-700/50 rounded-lg p-3">
          <div className="text-slate-400 text-xs">Max Net Edge</div>
          <div className="text-lg font-mono text-green-400">{stats.max_net_edge_pct?.toFixed(2)}%</div>
        </div>
        <div className="bg-slate-700/50 rounded-lg p-3">
          <div className="text-slate-400 text-xs">Average</div>
          <div className="text-lg font-mono text-blue-400">{stats.avg_net_edge_pct?.toFixed(2)}%</div>
        </div>
        <div className="bg-slate-700/50 rounded-lg p-3">
          <div className="text-slate-400 text-xs">Median</div>
          <div className="text-lg font-mono text-blue-400">{stats.median_net_edge_pct?.toFixed(2)}%</div>
        </div>
      </div>

      <div>
        <h4 className="text-sm text-slate-400 mb-3">Distribution ({total_opportunities} opportunities)</h4>
        <div className="space-y-2">
          {Object.entries(distribution).map(([bucket, count]) => (
            <div key={bucket} className="flex items-center gap-3">
              <div className="w-24 text-xs text-slate-400">{bucket.replace('_', ' ')}</div>
              <div className="flex-1 h-6 bg-slate-700 rounded overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-600 to-green-500 transition-all"
                  style={{ width: maxBucketCount > 0 ? `${(count / maxBucketCount) * 100}%` : '0%' }}
                />
              </div>
              <div className="w-12 text-right text-sm font-mono text-slate-300">{count}</div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h4 className="text-sm text-slate-400 mb-3">Threshold Impact Analysis</h4>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="text-left p-2 text-slate-400">Threshold</th>
                <th className="text-right p-2 text-slate-400">Opportunities</th>
                <th className="text-right p-2 text-slate-400">% Captured</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(opportunities_per_threshold).map(([threshold, count]) => {
                const thresholdBps = thresholdLabels[threshold]
                const isCurrentThreshold = currentThresholdBps && Math.abs(thresholdBps - currentThresholdBps) < 5
                const pctCaptured = total_opportunities > 0 ? (count / total_opportunities * 100).toFixed(1) : 0

                return (
                  <tr
                    key={threshold}
                    className={`border-b border-slate-800 ${isCurrentThreshold ? 'bg-blue-500/20' : 'hover:bg-slate-800/50'}`}
                  >
                    <td className="p-2">
                      <span className={isCurrentThreshold ? 'text-blue-400 font-semibold' : ''}>
                        {threshold}
                        {isCurrentThreshold && <span className="ml-2 text-xs">(current)</span>}
                      </span>
                    </td>
                    <td className="p-2 text-right font-mono text-green-400">{count}</td>
                    <td className="p-2 text-right font-mono text-slate-300">{pctCaptured}%</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-slate-500">
          Shows how many opportunities you would have captured at each threshold level.
        </p>
      </div>
    </div>
  )
}

function App() {
  const [status, setStatus] = useState(null)
  const [summary, setSummary] = useState(null)
  const [trades, setTrades] = useState([])
  const [floats, setFloats] = useState(null)
  const [config, setConfig] = useState(null)
  const [opportunities, setOpportunities] = useState([])
  const [missedOpportunities, setMissedOpportunities] = useState([])
  const [netEdgeAnalysis, setNetEdgeAnalysis] = useState(null)
  const [analysisHours, setAnalysisHours] = useState(24)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showSettings, setShowSettings] = useState(false)
  const [toasts, setToasts] = useState([])
  const [actionLoading, setActionLoading] = useState({ start: false, mode: false })

  const showToast = (message, type = 'success') => {
    const id = Date.now()
    setToasts(prev => [...prev, { id, message, type }])
  }

  const removeToast = (id) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }

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
      const [summaryData, tradesData, floatsData, configData, missedData, analysisData] = await Promise.all([
        fetchSummary(),
        fetchTrades(20),
        fetchFloats(),
        fetchConfig(),
        fetchMissedOpportunities(200),
        fetchNetEdgeAnalysis(analysisHours)
      ])
      setSummary(summaryData)
      setTrades(tradesData.trades || [])
      setFloats(floatsData.floats)
      setConfig(configData)
      setMissedOpportunities(missedData.opportunities || [])
      setNetEdgeAnalysis(analysisData)
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
    setActionLoading(prev => ({ ...prev, start: true }))
    try {
      if (status?.bot?.running) {
        await stopBot()
        showToast('Bot stopped', 'success')
      } else {
        await startBot()
        showToast('Bot started', 'success')
      }
      await loadFastData()
    } catch (err) {
      showToast('Failed to toggle bot', 'error')
      console.error('Error toggling bot:', err)
    } finally {
      setActionLoading(prev => ({ ...prev, start: false }))
    }
  }

  const handleModeToggle = async () => {
    setActionLoading(prev => ({ ...prev, mode: true }))
    try {
      const newMode = config?.mode === 'paper' ? 'live' : 'paper'
      await updateConfig({ mode: newMode })
      showToast(`Switched to ${newMode} mode`, 'success')
      await loadFastData()
      await loadSlowData()
    } catch (err) {
      showToast('Failed to change mode', 'error')
      console.error('Error toggling mode:', err)
    } finally {
      setActionLoading(prev => ({ ...prev, mode: false }))
    }
  }

  const handleSettingsSave = async () => {
    await loadFastData()
    await loadSlowData()
  }

  const handleResetFloats = async () => {
    try {
      await resetPaperFloats()
      showToast('Paper floats reset successfully', 'success')
      await loadFastData()
    } catch (err) {
      showToast('Failed to reset floats', 'error')
      console.error('Error resetting floats:', err)
    }
  }

  const handleAnalysisHoursChange = async (newHours) => {
    setAnalysisHours(newHours)
    try {
      const analysisData = await fetchNetEdgeAnalysis(newHours)
      setNetEdgeAnalysis(analysisData)
    } catch (err) {
      console.error('Error fetching analysis:', err)
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
  const usdZarRate = status?.bot?.last_opportunity?.usd_zar_rate || config?.usd_zar_rate || 17
  const totalPnLZar = (summary?.all_time?.total_profit_usd || 0) * usdZarRate
  const totalTrades = summary?.all_time?.total_trades || 0
  const todayPnLZar = (summary?.today?.profit_usd || 0) * usdZarRate
  const lastOpportunity = status?.bot?.last_opportunity

  return (
    <div className="min-h-screen p-6">
      <ToastContainer toasts={toasts} removeToast={removeToast} />
      
      {showSettings && (
        <SettingsModal
          config={config}
          onClose={() => setShowSettings(false)}
          onSave={handleSettingsSave}
          showToast={showToast}
        />
      )}

      <div className="max-w-7xl mx-auto">
        <header className="mb-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold">Crypto Arbitrage Dashboard</h1>
              <p className="text-slate-400 mt-1">BTC/ZAR - Luno ↔ Binance</p>
            </div>
            <div className="flex gap-3 items-center">
              <button
                onClick={() => setShowSettings(true)}
                className="p-2 rounded-lg bg-slate-700 hover:bg-slate-600 transition"
                title="Settings"
              >
                <GearIcon />
              </button>
              <button
                onClick={handleModeToggle}
                disabled={actionLoading.mode}
                className={`px-4 py-2 rounded-lg font-semibold transition text-sm flex items-center gap-2 ${
                  botMode === 'paper'
                    ? 'bg-yellow-600 hover:bg-yellow-700 disabled:bg-yellow-800'
                    : 'bg-green-600 hover:bg-green-700 disabled:bg-green-800'
                } disabled:cursor-not-allowed`}
              >
                {actionLoading.mode ? (
                  <span className="animate-spin">⟳</span>
                ) : null}
                {botMode === 'paper' ? 'Paper Mode' : 'Live Mode'}
              </button>
              <button
                onClick={handleStartStop}
                disabled={actionLoading.start}
                className={`px-6 py-3 rounded-lg font-semibold transition flex items-center gap-2 ${
                  botRunning
                    ? 'bg-red-600 hover:bg-red-700 disabled:bg-red-800'
                    : 'bg-green-600 hover:bg-green-700 disabled:bg-green-800'
                } disabled:cursor-not-allowed`}
              >
                {actionLoading.start ? (
                  <span className="animate-spin">⟳</span>
                ) : null}
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
            value={`R ${totalPnLZar.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`}
            subtitle={`${totalTrades} total trades`}
            color={totalPnLZar >= 0 ? 'green' : 'red'}
          />
          <StatusCard
            title="Today's PnL"
            value={`R ${todayPnLZar.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`}
            subtitle={`${summary?.today?.trade_count || 0} trades today`}
            color={todayPnLZar >= 0 ? 'green' : 'red'}
          />
          <StatusCard
            title="Net Edge"
            value={lastOpportunity?.net_edge_bps ? `${(lastOpportunity.net_edge_bps / 100).toFixed(2)}%` : 'N/A'}
            subtitle={lastOpportunity?.direction?.replace('_to_', ' → ')}
            color="blue"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <div className="lg:col-span-2 bg-slate-800/30 rounded-lg p-6 border border-slate-700">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Recent Trades</h2>
              <button
                onClick={() => trades.length > 0 && exportToCSV(trades, 'recent_trades.csv')}
                disabled={trades.length === 0}
                className="px-3 py-1.5 text-sm bg-slate-600 hover:bg-slate-500 disabled:bg-slate-700 disabled:cursor-not-allowed rounded flex items-center gap-1"
              >
                <DownloadIcon /> Export
              </button>
            </div>
            <TradesTable trades={trades} usdZarRate={usdZarRate} />
          </div>
          <div className="bg-slate-800/30 rounded-lg p-6 border border-slate-700">
            <h2 className="text-xl font-semibold mb-4">Exchange Balances</h2>
            <FloatsDisplay floats={floats} />
          </div>
        </div>

        {status?.bot?.mode === 'paper' && status?.bot?.paper_floats && (
          <div className="grid grid-cols-1 gap-6 mb-8">
            <SimulatedBalancesSection
              paperFloats={status?.bot?.paper_floats}
              onReset={handleResetFloats}
              usdZarRate={usdZarRate}
            />
          </div>
        )}

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
                    <div className="text-slate-500 text-xs">≈ ${lastOpportunity.luno_usd?.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}) || 'N/A'} USD</div>
                  </div>
                  <div>
                    <div className="text-slate-400 text-sm">Binance BTC/USDT</div>
                    <div className="font-mono text-lg">R {(lastOpportunity.binance_usd * lastOpportunity.usd_zar_rate)?.toLocaleString(undefined, {minimumFractionDigits: 0, maximumFractionDigits: 0}) || 'N/A'}</div>
                    <div className="text-slate-500 text-xs">
                      ${lastOpportunity.binance_usd?.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} USD
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
                      <div className="font-semibold">{(lastOpportunity.gross_edge_bps / 100)?.toFixed(2) || '0'}%</div>
                    </div>
                    <div>
                      <div className="text-slate-400 text-xs">Net Edge</div>
                      <div className={`font-semibold ${lastOpportunity.net_edge_bps >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {(lastOpportunity.net_edge_bps / 100)?.toFixed(2) || '0'}%
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
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Recent Opportunities</h2>
              <button
                onClick={() => opportunities.length > 0 && exportToCSV(opportunities, 'recent_opportunities.csv')}
                disabled={opportunities.length === 0}
                className="px-3 py-1.5 text-sm bg-slate-600 hover:bg-slate-500 disabled:bg-slate-700 disabled:cursor-not-allowed rounded flex items-center gap-1"
              >
                <DownloadIcon /> Export
              </button>
            </div>
            <OpportunitiesTable opportunities={opportunities} />
          </div>
        </div>

        <div className="bg-slate-800/30 rounded-lg p-6 border border-amber-500/30 mb-8">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-amber-400">Missed Opportunities</h2>
            <button
              onClick={() => missedOpportunities.length > 0 && exportToCSV(missedOpportunities, 'missed_opportunities.csv')}
              disabled={missedOpportunities.length === 0}
              className="px-3 py-1.5 text-sm bg-slate-600 hover:bg-slate-500 disabled:bg-slate-700 disabled:cursor-not-allowed rounded flex items-center gap-1"
            >
              <DownloadIcon /> Export
            </button>
          </div>
          <MissedOpportunitiesTable opportunities={missedOpportunities} />
        </div>

        <div className="bg-slate-800/30 rounded-lg p-6 border border-slate-700 mb-8">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Configuration</h2>
            <button
              onClick={() => setShowSettings(true)}
              className="text-sm text-blue-400 hover:text-blue-300 flex items-center gap-1"
            >
              <GearIcon /> Edit
            </button>
          </div>
          {config && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-slate-400">Min Net Edge:</span>
                <span className="ml-2 font-mono">{(config.min_net_edge_bps / 100).toFixed(2)}%</span>
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
                <span className="ml-2 font-mono">{(config.slippage_bps_buffer / 100).toFixed(2)}%</span>
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

        <div className="bg-slate-800/30 rounded-lg p-6 border border-slate-700 mb-8">
          <h2 className="text-xl font-semibold mb-4">Net Edge Analysis</h2>
          <NetEdgeAnalysis
            data={netEdgeAnalysis}
            hours={analysisHours}
            onHoursChange={handleAnalysisHoursChange}
            currentThresholdBps={config?.min_net_edge_bps}
          />
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
