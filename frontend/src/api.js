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
