const API_BASE = import.meta.env.VITE_API_BASE || '';

export async function fetchStatus() {
  const res = await fetch(`${API_BASE}/status`);
  return res.json();
}

export async function fetchTrades(limit = 50) {
  const res = await fetch(`${API_BASE}/reports/trades?limit=${limit}`);
  return res.json();
}

export async function fetchPnL(days = 30) {
  const res = await fetch(`${API_BASE}/reports/pnl?days=${days}`);
  return res.json();
}

export async function fetchSummary() {
  const res = await fetch(`${API_BASE}/reports/summary`);
  return res.json();
}

export async function fetchFloats() {
  const res = await fetch(`${API_BASE}/floats`);
  return res.json();
}

export async function fetchConfig() {
  const res = await fetch(`${API_BASE}/config`);
  return res.json();
}

export async function updateConfig(config) {
  const res = await fetch(`${API_BASE}/config`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config)
  });
  return res.json();
}

export async function fetchOpportunities(limit = 50) {
  const res = await fetch(`${API_BASE}/reports/opportunities?limit=${limit}`);
  return res.json();
}

export async function startBot() {
  const res = await fetch(`${API_BASE}/start`, { method: 'POST' });
  return res.json();
}

export async function stopBot() {
  const res = await fetch(`${API_BASE}/stop`, { method: 'POST' });
  return res.json();
}

export async function resetPaperFloats() {
  const res = await fetch(`${API_BASE}/reset-paper-floats`, { method: 'POST' });
  return res.json();
}

export async function fetchMissedOpportunities(limit = 200) {
  const res = await fetch(`${API_BASE}/reports/missed-opportunities?limit=${limit}`);
  return res.json();
}

export async function fetchNetEdgeAnalysis(hours = 24) {
  const res = await fetch(`${API_BASE}/reports/net-edge-analysis?hours=${hours}`);
  return res.json();
}

export async function fetchNetEdgeRawData(hours = 24, limit = 1000) {
  const res = await fetch(`${API_BASE}/reports/net-edge-raw?hours=${hours}&limit=${limit}`);
  return res.json();
}

export function exportToCSV(data, filename) {
  const headers = Object.keys(data[0] || {});
  const csvContent = [
    headers.join(','),
    ...data.map(row => headers.map(h => JSON.stringify(row[h] ?? '')).join(','))
  ].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export async function exportToXLSX(data, filename) {
  const XLSX = await import('xlsx');
  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Data');
  XLSX.writeFile(workbook, filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`);
}
