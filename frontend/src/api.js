const API_BASE = ''; // same-origin: Vite dev proxy handles /api in dev, server.js serves both in prod

// If the token expires mid-session, every subsequent authenticated call was
// otherwise throwing to a generic error toast with no indication the user
// needs to log in again. Handle it once, here, so every caller benefits.
// Only fires for requests that actually carried a token -- a plain failed
// login/register attempt (no token) also returns 401 ("Invalid
// credentials.") and must NOT trigger a redirect away from the form.
function handleExpiredSession(hadToken) {
  if (!hadToken) return;
  localStorage.removeItem('cma_token');
  if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
    window.location.href = '/login';
  }
}

export async function api(path, opts = {}, tokenOverride) {
  const token = tokenOverride || localStorage.getItem('cma_token');
  const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}${path}`, { ...opts, headers });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) handleExpiredSession(!!token);
  if (!res.ok) {
    const err = new Error(data.error || 'Something went wrong.');
    err.data = data;
    err.status = res.status;
    throw err;
  }
  return data;
}

// For multipart/form-data uploads (material files, lecture videos). Pass a
// FormData instance -- deliberately no Content-Type header here, so the
// browser sets the multipart boundary itself.
export async function apiUpload(path, formData, method = 'POST') {
  const token = localStorage.getItem('cma_token');
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}${path}`, { method, headers, body: formData });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) handleExpiredSession(!!token);
  if (!res.ok) {
    const err = new Error(data.error || 'Something went wrong.');
    err.data = data;
    err.status = res.status;
    throw err;
  }
  return data;
}