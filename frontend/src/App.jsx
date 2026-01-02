import { useState, useEffect } from 'react'
import { fetchStatus, fetchSummary, fetchTrades, fetchFloats, fetchConfig, updateConfig, fetchOpportunities, fetchMissedOpportunities, startBot, stopBot, resetPaperFloats, exportToCSV, fetchNetEdgeAnalysis, fetchNetEdgeRawData, exportToXLSX } from './api'

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

function Tooltip({ text }) {
  return (
    <span className="ml-1 inline-block cursor-help text-slate-500 hover:text-slate-300" title={text}>
      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 inline" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
      </svg>
    </span>
  )
}

function SettingsModal({ config, onClose, onSave, showToast }) {
  const [formData, setFormData] = useState({
    mode: config?.mode || 'paper',
    min_net_edge_bps: config?.min_net_edge_bps ?? 100,
    max_trade_size_btc: config?.max_trade_size_btc ?? 0.01,
    min_trade_size_btc: config?.min_trade_size_btc ?? 0.0001,
    max_trade_zar: config?.max_trade_zar ?? 5000,
    slippage_bps_buffer: config?.slippage_bps_buffer ?? 10,
    min_remaining_zar_luno: config?.min_remaining_zar_luno ?? 1000,
    min_remaining_btc_luno: config?.min_remaining_btc_luno ?? 0.0005,
    min_remaining_btc_binance: config?.min_remaining_btc_binance ?? 0.001,
    min_remaining_usdt_binance: config?.min_remaining_usdt_binance ?? 50,
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
        slippage_bps_buffer: parseFloat(formData.slippage_bps_buffer),
        min_remaining_zar_luno: parseFloat(formData.min_remaining_zar_luno),
        min_remaining_btc_luno: parseFloat(formData.min_remaining_btc_luno),
        min_remaining_btc_binance: parseFloat(formData.min_remaining_btc_binance),
        min_remaining_usdt_binance: parseFloat(formData.min_remaining_usdt_binance),
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

          <div className="border-t border-slate-600 pt-4 mt-2">
            <h3 className="text-sm font-semibold text-slate-300 mb-3">Profitability Thresholds</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>
                  Min Net Edge (%)
                  <Tooltip text="Minimum profit margin after fees to execute a trade. Higher = fewer trades but safer." />
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={(formData.min_net_edge_bps / 100).toFixed(2)}
                  onChange={(e) => handleChange('min_net_edge_bps', parseFloat(e.target.value) * 100)}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>
                  Slippage Buffer (%)
                  <Tooltip text="Extra margin deducted to account for price movement during trade execution." />
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={(formData.slippage_bps_buffer / 100).toFixed(2)}
                  onChange={(e) => handleChange('slippage_bps_buffer', parseFloat(e.target.value) * 100)}
                  className={inputClass}
                />
              </div>
            </div>
          </div>

          <div className="border-t border-slate-600 pt-4 mt-2">
            <h3 className="text-sm font-semibold text-slate-300 mb-3">Trade Size Limits</h3>
            <div className="grid grid-cols-2 gap-4 mb-3">
              <div>
                <label className={labelClass}>
                  Max Trade Size (BTC)
                  <Tooltip text="Maximum BTC per trade. Bot uses the smaller of BTC limit or ZAR limit." />
                </label>
                <input
                  type="number"
                  step="0.0001"
                  value={formData.max_trade_size_btc}
                  onChange={(e) => handleChange('max_trade_size_btc', e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>
                  Min Trade Size (BTC)
                  <Tooltip text="Minimum BTC per trade. Avoids tiny 'dust' trades that aren't worth fees." />
                </label>
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
                <label className={labelClass}>
                  Max Trade (ZAR)
                  <Tooltip text="Maximum ZAR value per trade. Bot uses the smaller of BTC limit or ZAR limit." />
                </label>
                <input
                  type="number"
                  step="100"
                  value={formData.max_trade_zar}
                  onChange={(e) => handleChange('max_trade_zar', e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <div className="text-slate-500 text-xs mt-6">
                  Check interval: 500ms (hardcoded)
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-slate-600 pt-4 mt-2">
            <h3 className="text-sm font-semibold text-slate-300 mb-3">Safety Buffers (Min Remaining)</h3>
            <p className="text-xs text-slate-400 mb-3">Keep these amounts as reserves to cover fees and slippage</p>
            <div className="grid grid-cols-2 gap-4 mb-3">
              <div>
                <label className={labelClass}>
                  Luno - ZAR
                  <Tooltip text="Minimum ZAR to keep in Luno as safety buffer." />
                </label>
                <input
                  type="number"
                  step="100"
                  value={formData.min_remaining_zar_luno}
                  onChange={(e) => handleChange('min_remaining_zar_luno', e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>
                  Luno - BTC
                  <Tooltip text="Minimum BTC to keep in Luno as safety buffer." />
                </label>
                <input
                  type="number"
                  step="0.0001"
                  value={formData.min_remaining_btc_luno}
                  onChange={(e) => handleChange('min_remaining_btc_luno', e.target.value)}
                  className={inputClass}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>
                  Binance - BTC
                  <Tooltip text="Minimum BTC to keep in Binance as safety buffer." />
                </label>
                <input
                  type="number"
                  step="0.0001"
                  value={formData.min_remaining_btc_binance}
                  onChange={(e) => handleChange('min_remaining_btc_binance', e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>
                  Binance - USDT
                  <Tooltip text="Minimum USDT to keep in Binance as safety buffer." />
                </label>
                <input
                  type="number"
                  step="1"
                  value={formData.min_remaining_usdt_binance}
                  onChange={(e) => handleChange('min_remaining_usdt_binance', e.target.value)}
                  className={inputClass}
                />
              </div>
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

function LiveModeConfirmModal({ onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50" onClick={onCancel}>
      <div className="bg-slate-800 rounded-lg p-6 w-full max-w-md border-2 border-red-500/50" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center">
            <span className="text-2xl">⚠️</span>
          </div>
          <h2 className="text-xl font-bold text-red-400">Switch to Live Trading?</h2>
        </div>
        
        <div className="mb-6 space-y-3 text-slate-300">
          <p className="font-semibold text-white">Warning: This will enable real trading!</p>
          <ul className="list-disc list-inside space-y-1 text-sm">
            <li>Real orders will be placed on Luno and Binance</li>
            <li>Real money will be used for trades</li>
            <li>Ensure your API keys have trading permissions</li>
            <li>Monitor your exchange balances carefully</li>
          </ul>
        </div>
        
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-3 bg-slate-700 hover:bg-slate-600 rounded-lg transition font-semibold"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-700 rounded-lg transition font-semibold"
          >
            Yes, Go Live
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

function DirectionStats({ data, label, colorClass }) {
  if (!data || data.count === 0) {
    return (
      <div className="text-center py-4 text-slate-400 text-sm">
        No {label} data available
      </div>
    )
  }

  const { stats, distribution, count } = data
  const distributionValues = Object.values(distribution || {})
  const maxBucketCount = distributionValues.length > 0 ? Math.max(...distributionValues) : 0

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
        <div className="bg-slate-700/50 rounded-lg p-2">
          <div className="text-slate-400 text-xs">Min</div>
          <div className={`text-sm font-mono ${colorClass}`}>{stats?.min_net_edge_pct?.toFixed(2) || 0}%</div>
        </div>
        <div className="bg-slate-700/50 rounded-lg p-2">
          <div className="text-slate-400 text-xs">Max</div>
          <div className={`text-sm font-mono ${colorClass}`}>{stats?.max_net_edge_pct?.toFixed(2) || 0}%</div>
        </div>
        <div className="bg-slate-700/50 rounded-lg p-2">
          <div className="text-slate-400 text-xs">Avg</div>
          <div className={`text-sm font-mono ${colorClass}`}>{stats?.avg_net_edge_pct?.toFixed(2) || 0}%</div>
        </div>
        <div className="bg-slate-700/50 rounded-lg p-2">
          <div className="text-slate-400 text-xs">Median</div>
          <div className={`text-sm font-mono ${colorClass}`}>{stats?.median_net_edge_pct?.toFixed(2) || 0}%</div>
        </div>
        <div className="bg-slate-700/50 rounded-lg p-2">
          <div className="text-slate-400 text-xs">Count</div>
          <div className={`text-sm font-mono ${colorClass}`}>{count}</div>
        </div>
      </div>

      <div>
        <div className="text-xs text-slate-400 mb-2">Distribution</div>
        <div className="space-y-1">
          {Object.entries(distribution || {}).map(([bucket, bucketCount]) => (
            <div key={bucket} className="flex items-center gap-2">
              <div className="w-20 text-xs text-slate-500 truncate">{bucket.replace('_', ' ')}</div>
              <div className="flex-1 h-4 bg-slate-700 rounded overflow-hidden">
                <div
                  className={`h-full transition-all ${colorClass === 'text-blue-400' ? 'bg-blue-500' : 'bg-green-500'}`}
                  style={{ width: maxBucketCount > 0 ? `${(bucketCount / maxBucketCount) * 100}%` : '0%' }}
                />
              </div>
              <div className="w-8 text-right text-xs font-mono text-slate-300">{bucketCount}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function NetEdgeAnalysis({ data, hours, onHoursChange, currentThresholdBps }) {
  const [showRawData, setShowRawData] = useState(false)
  const [rawData, setRawData] = useState(null)
  const [loadingRaw, setLoadingRaw] = useState(false)

  const timeRanges = [
    { label: '1h', value: 1 },
    { label: '6h', value: 6 },
    { label: '12h', value: 12 },
    { label: '24h', value: 24 },
    { label: '48h', value: 48 },
    { label: '72h', value: 72 },
    { label: '7d', value: 168 },
    { label: '14d', value: 336 },
    { label: '21d', value: 504 },
    { label: 'Month', value: 720 },
    { label: 'Year', value: 8760 },
  ]

  const loadRawData = async () => {
    setLoadingRaw(true)
    try {
      const result = await fetchNetEdgeRawData(hours, 1000)
      setRawData(result)
      return result
    } catch (err) {
      console.error('Error loading raw data:', err)
      return null
    } finally {
      setLoadingRaw(false)
    }
  }

  const handleToggleRawData = async () => {
    if (!showRawData && !rawData) {
      await loadRawData()
    }
    setShowRawData(!showRawData)
  }

  const handleExportXLSX = async () => {
    let data = rawData
    if (!data?.ticks?.length) {
      data = await loadRawData()
    }
    if (data?.ticks?.length) {
      await exportToXLSX(data.ticks, `net_edge_data_${hours}h.xlsx`)
    }
  }

  if (!data || data.message || !data.stats || !data.distribution || !data.opportunities_per_threshold) {
    return (
      <div className="text-center py-4 text-slate-400">
        {data?.message || 'No analysis data available. Start the bot to collect data.'}
      </div>
    )
  }

  const { stats, distribution, opportunities_per_threshold, total_opportunities, by_direction } = data
  const b2l = by_direction?.binance_to_luno
  const l2b = by_direction?.luno_to_binance

  if (!stats || !distribution || !opportunities_per_threshold) {
    return (
      <div className="text-center py-4 text-slate-400">
        Incomplete analysis data. Please wait for more data.
      </div>
    )
  }

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
      <div className="flex flex-wrap items-center justify-between gap-2">
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
        <div className="flex gap-2">
          <button
            onClick={handleToggleRawData}
            className="px-3 py-1.5 text-sm bg-slate-700 text-slate-300 rounded hover:bg-slate-600 transition"
          >
            {loadingRaw ? 'Loading...' : showRawData ? 'Hide Raw Data' : 'Show Raw Data'}
          </button>
          <button
            onClick={handleExportXLSX}
            className="px-3 py-1.5 text-sm bg-green-600 text-white rounded hover:bg-green-500 transition flex items-center gap-1"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Export .xlsx
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-slate-800/50 rounded-lg p-4 border border-blue-500/30">
          <h4 className="text-sm font-semibold text-blue-400 mb-3 flex items-center gap-2">
            <span className="text-lg">←</span> Binance → Luno (B&gt;L)
            <span className="text-slate-400 font-normal ml-auto">{b2l?.count || 0} ticks</span>
          </h4>
          <DirectionStats data={b2l} label="B>L" colorClass="text-blue-400" />
        </div>

        <div className="bg-slate-800/50 rounded-lg p-4 border border-green-500/30">
          <h4 className="text-sm font-semibold text-green-400 mb-3 flex items-center gap-2">
            Luno → Binance (L&gt;B) <span className="text-lg">→</span>
            <span className="text-slate-400 font-normal ml-auto">{l2b?.count || 0} ticks</span>
          </h4>
          <DirectionStats data={l2b} label="L>B" colorClass="text-green-400" />
        </div>
      </div>

      <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
        <div className="flex justify-between items-center mb-4">
          <h4 className="text-sm font-semibold text-slate-400">Raw Data Snapshot (Last 10 Ticks)</h4>
          <button
            onClick={handleToggleRawData}
            className="text-xs px-2 py-1 bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 rounded border border-blue-600/30"
          >
            {showRawData ? 'Hide Detailed Data' : 'View All'}
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="text-left p-1.5 text-slate-500">Time</th>
                <th className="text-left p-1.5 text-slate-500">Dir</th>
                <th className="text-right p-1.5 text-slate-500">Net Edge</th>
                <th className="text-center p-1.5 text-slate-500">Profitable</th>
              </tr>
            </thead>
            <tbody>
              {(rawData?.ticks || []).slice(0, 10).map((tick, idx) => (
                <tr key={idx} className="border-b border-slate-800/50">
                  <td className="p-1.5 font-mono text-slate-400">{tick.timestamp?.split('T')[1]?.split('.')[0] || '-'}</td>
                  <td className={`p-1.5 ${tick.direction === 'binance_to_luno' ? 'text-blue-400' : 'text-green-400'}`}>
                    {tick.direction === 'binance_to_luno' ? 'B→L' : 'L→B'}
                  </td>
                  <td className={`p-1.5 text-right font-mono ${tick.net_edge_bps >= (currentThresholdBps || 100) ? 'text-green-400' : 'text-slate-400'}`}>
                    {(tick.net_edge_bps / 100)?.toFixed(2)}%
                  </td>
                  <td className="p-1.5 text-center">
                    {tick.net_edge_bps >= (currentThresholdBps || 100) ? (
                      <span className="text-green-400">✓</span>
                    ) : (
                      <span className="text-slate-600">✕</span>
                    )}
                  </td>
                </tr>
              ))}
              {(!rawData?.ticks || rawData.ticks.length === 0) && (
                <tr>
                  <td colSpan="4" className="p-4 text-center text-slate-500 italic">
                    {loadingRaw ? 'Loading snapshot...' : 'No data available. Click "View All" or start bot.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
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

      {showRawData && rawData?.ticks && (
        <div>
          <h4 className="text-sm text-slate-400 mb-3">Raw Tick Data ({rawData.count} records)</h4>
          <div className="overflow-x-auto max-h-96 overflow-y-auto border border-slate-700 rounded-lg">
            <table className="w-full text-xs">
              <thead className="bg-slate-800 sticky top-0">
                <tr className="border-b border-slate-700">
                  <th className="text-left p-2 text-slate-400">Timestamp</th>
                  <th className="text-left p-2 text-slate-400">Direction</th>
                  <th className="text-right p-2 text-slate-400">Luno (ZAR)</th>
                  <th className="text-right p-2 text-slate-400">Binance (USD)</th>
                  <th className="text-right p-2 text-slate-400">USD/ZAR</th>
                  <th className="text-right p-2 text-slate-400">Gross %</th>
                  <th className="text-right p-2 text-slate-400">Net %</th>
                  <th className="text-center p-2 text-slate-400">Profitable</th>
                </tr>
              </thead>
              <tbody>
                {rawData.ticks.slice(0, 500).map((tick, idx) => (
                  <tr key={idx} className="border-b border-slate-800 hover:bg-slate-800/50">
                    <td className="p-2 font-mono text-slate-300">{tick.timestamp?.split('T')[1]?.split('.')[0] || '-'}</td>
                    <td className={`p-2 ${tick.direction === 'binance_to_luno' ? 'text-blue-400' : 'text-green-400'}`}>
                      {tick.direction === 'binance_to_luno' ? 'B→L' : 'L→B'}
                    </td>
                    <td className="p-2 text-right font-mono text-slate-300">R{tick.luno_last?.toFixed(0)}</td>
                    <td className="p-2 text-right font-mono text-slate-300">${tick.binance_last?.toFixed(2)}</td>
                    <td className="p-2 text-right font-mono text-slate-300">{tick.usd_zar_rate?.toFixed(2)}</td>
                    <td className="p-2 text-right font-mono text-slate-300">{(tick.gross_edge_bps / 100)?.toFixed(2)}%</td>
                    <td className={`p-2 text-right font-mono ${tick.net_edge_bps >= 100 ? 'text-green-400' : tick.net_edge_bps >= 50 ? 'text-amber-400' : 'text-slate-400'}`}>
                      {(tick.net_edge_bps / 100)?.toFixed(2)}%
                    </td>
                    <td className="p-2 text-center">
                      {tick.is_profitable ? <span className="text-green-400">✓</span> : <span className="text-slate-500">-</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {rawData.ticks.length > 500 && (
            <p className="mt-2 text-xs text-slate-500">Showing 500 of {rawData.count} records. Export to see all data.</p>
          )}
        </div>
      )}
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
  const [showLiveModeConfirm, setShowLiveModeConfirm] = useState(false)
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

  const handleModeToggle = () => {
    const currentMode = config?.mode || 'paper'
    if (currentMode === 'paper') {
      setShowLiveModeConfirm(true)
    } else {
      performModeSwitch('paper')
    }
  }

  const performModeSwitch = async (newMode) => {
    setShowLiveModeConfirm(false)
    setActionLoading(prev => ({ ...prev, mode: true }))
    try {
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
  const usdZarRate = status?.bot?.last_opportunity?.usdt_zar_rate || status?.bot?.last_opportunity?.usd_zar_rate || config?.usd_zar_rate || 17
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

      {showLiveModeConfirm && (
        <LiveModeConfirmModal
          onConfirm={() => performModeSwitch('live')}
          onCancel={() => setShowLiveModeConfirm(false)}
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
            value={(() => {
              const l2b = lastOpportunity?.both_directions?.luno_to_binance?.net_edge_bps;
              const b2l = lastOpportunity?.both_directions?.binance_to_luno?.net_edge_bps;
              if (l2b !== undefined && b2l !== undefined) {
                return `L→B: ${(l2b/100).toFixed(2)}% | B→L: ${(b2l/100).toFixed(2)}%`;
              }
              return lastOpportunity?.net_edge_bps ? `${(lastOpportunity.net_edge_bps / 100).toFixed(2)}%` : 'N/A';
            })()}
            subtitle={`Best: ${lastOpportunity?.direction?.replace('_to_', ' → ') || 'N/A'}`}
            color="blue"
          />
        </div>

        {/* Row 1: Live Spread Monitor (50%) + Balances Card (50%) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Live Spread Monitor - Left */}
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
                    <div className="font-mono text-lg">R {((lastOpportunity.binance_usdt || lastOpportunity.binance_usd) * (lastOpportunity.usdt_zar_rate || lastOpportunity.usd_zar_rate))?.toLocaleString(undefined, {minimumFractionDigits: 0, maximumFractionDigits: 0}) || 'N/A'}</div>
                    <div className="text-slate-500 text-xs">
                      Bid: ${lastOpportunity.binance_bid?.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} | Ask: ${lastOpportunity.binance_ask?.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                    </div>
                    <div className="text-slate-500 text-xs">${(lastOpportunity.binance_usdt || lastOpportunity.binance_usd)?.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} USDT</div>
                  </div>
                </div>
                <div className="text-center text-xs text-slate-400 border-t border-slate-700 pt-2">
                  USDT/ZAR Rate: {(lastOpportunity.usdt_zar_rate || lastOpportunity.usd_zar_rate)?.toFixed(4) || 'N/A'} (Live)
                  {lastOpportunity.usdt_usd_rate && lastOpportunity.usdt_usd_rate !== 1 && (
                    <span className="ml-2">| USDT/USD: {lastOpportunity.usdt_usd_rate?.toFixed(6)}</span>
                  )}
                </div>
                <div className="border-t border-slate-700 pt-4">
                  <div className="grid grid-cols-2 gap-4 mb-3">
                    <div className="bg-blue-500/10 border border-blue-500/30 rounded p-3 text-center">
                      <div className="text-blue-400 text-xs mb-1">L → B (Luno to Binance)</div>
                      {(() => {
                        const l2b = lastOpportunity?.both_directions?.luno_to_binance;
                        const edge = l2b?.net_edge_bps ?? 0;
                        return (
                          <div className={`text-xl font-mono font-bold ${edge >= 100 ? 'text-green-400' : edge >= 0 ? 'text-blue-400' : 'text-red-400'}`}>
                            {(edge / 100).toFixed(2)}%
                          </div>
                        );
                      })()}
                      <div className="text-slate-500 text-xs mt-1">Net Edge</div>
                    </div>
                    <div className="bg-purple-500/10 border border-purple-500/30 rounded p-3 text-center">
                      <div className="text-purple-400 text-xs mb-1">B → L (Binance to Luno)</div>
                      {(() => {
                        const b2l = lastOpportunity?.both_directions?.binance_to_luno;
                        const edge = b2l?.net_edge_bps ?? 0;
                        return (
                          <div className={`text-xl font-mono font-bold ${edge >= 100 ? 'text-green-400' : edge >= 0 ? 'text-purple-400' : 'text-red-400'}`}>
                            {(edge / 100).toFixed(2)}%
                          </div>
                        );
                      })()}
                      <div className="text-slate-500 text-xs mt-1">Net Edge</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-center text-sm">
                    <div>
                      <div className="text-slate-400 text-xs">Best Direction</div>
                      <div className={`font-semibold ${lastOpportunity.direction === 'luno_to_binance' ? 'text-blue-400' : 'text-purple-400'}`}>
                        {lastOpportunity.direction === 'luno_to_binance' ? 'L → B' : 'B → L'}
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

          {/* Balances Card - Right */}
          <div className={`bg-slate-800/30 rounded-lg p-6 border ${botMode === 'paper' ? 'border-amber-500/40' : 'border-slate-700'}`}>
            {/* Paper Mode: Show Simulated Trade Balances */}
            {botMode === 'paper' ? (
              <>
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-semibold text-amber-400">Simulated Trade Balances</h2>
                  <button
                    onClick={handleResetFloats}
                    className="px-3 py-1.5 text-sm bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 rounded border border-amber-500/30"
                  >
                    Reset Floats
                  </button>
                </div>
                {status?.bot?.paper_floats ? (
                  <>
                    <PaperFloatsDisplay paperFloats={status?.bot?.paper_floats} onReset={handleResetFloats} usdZarRate={usdZarRate} />
                    {status?.bot?.paper_floats?.last_direction && (
                      <div className="mt-3 text-sm text-slate-400">
                        Last trade: <span className="text-amber-300">{status?.bot?.paper_floats?.last_direction === 'binance_to_luno' ? 'Binance → Luno' : 'Luno → Binance'}</span>
                        <span className="ml-2 text-slate-500">(Waiting for reversal)</span>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-slate-400 text-center py-4">Start the bot to see simulated balances</div>
                )}
              </>
            ) : (
              /* Live Mode: Show Exchange Balances */
              <>
                <h2 className="text-xl font-semibold mb-4">Exchange Balances</h2>
                <FloatsDisplay floats={floats} />
              </>
            )}
          </div>
        </div>

        {/* Row 2: Recent Trades - Full Width */}
        <div className={`bg-slate-800/30 rounded-lg p-6 border mb-8 ${botMode === 'paper' ? 'border-amber-500/40' : 'border-slate-700'}`}>
          <div className="flex justify-between items-center mb-4">
            <h2 className={`text-xl font-semibold ${botMode === 'paper' ? 'text-amber-400' : ''}`}>
              {botMode === 'paper' ? 'Paper Trades' : 'Recent Trades'}
            </h2>
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

        {/* Row 3: Recent Opportunities (50%) + Missed Opportunities (50%) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div className={`bg-slate-800/30 rounded-lg p-6 border ${botMode === 'paper' ? 'border-amber-500/40' : 'border-slate-700'}`}>
            <div className="flex justify-between items-center mb-4">
              <h2 className={`text-xl font-semibold ${botMode === 'paper' ? 'text-amber-400' : ''}`}>
                {botMode === 'paper' ? 'Paper Opportunities' : 'Recent Opportunities'}
              </h2>
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

          <div className={`bg-slate-800/30 rounded-lg p-6 border ${botMode === 'paper' ? 'border-amber-500/40' : 'border-amber-500/30'}`}>
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
        </div>

        {/* Row 4: Net Edge Analysis - Full Width */}
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
