import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';

export default function AdminLogin() {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const { loginWithToken } = useAuth();
  const { showToast } = useToast();

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const data = await api('/api/login', { method: 'POST', body: JSON.stringify({ identifier, password }) });
      if (data.role !== 'admin') { setError('This login is for administrators only.'); setBusy(false); return; }
      await loginWithToken(data.token);
      showToast('Welcome, admin.');
      navigate('/admin');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page">
      <div className="card" style={{ maxWidth: 420, margin: '2rem auto' }}>
        <div className="eyebrow">Admin Portal</div>
        <h3>Administrator login</h3>
        <form onSubmit={handleSubmit}>
          <div className="field-group">
            <label className="field-label" htmlFor="adminIdentifier">Email or phone number</label>
            <input id="adminIdentifier" className="field" value={identifier} onChange={e => setIdentifier(e.target.value)} />
          </div>
          <div className="field-group">
            <label className="field-label" htmlFor="adminPassword">Password</label>
            <input id="adminPassword" type="password" className="field" value={password} onChange={e => setPassword(e.target.value)} />
          </div>
          {error && <p className="helper-text" style={{ color: '#A33F3F' }}>{error}</p>}
          <button className="btn btn-primary" style={{ width: '100%' }} disabled={busy}>{busy ? 'Logging in…' : 'Log in'}</button>
        </form>
      </div>
    </div>
  );
}
