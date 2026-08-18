const API_BASE = ''; // same-origin: Vite dev proxy handles /api in dev, server.js serves both in prod

export async function api(path, opts = {}, tokenOverride) {
  const token = tokenOverride || localStorage.getItem('cma_token');
  const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}${path}`, { ...opts, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || 'Something went wrong.');
    err.data = data;
    throw err;
  }
  return data;
}
