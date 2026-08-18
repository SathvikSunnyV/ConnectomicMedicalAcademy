import React, { useState } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { api } from '../api.js';
import { useToast } from '../context/ToastContext.jsx';
import { IconInfo } from '../components/Icons.jsx';

export default function ResetPassword() {
  const location = useLocation();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [userId] = useState(location.state?.userId || null);
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const devOtp = location.state?.devOtp || null;

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await api('/api/reset-password', { method: 'POST', body: JSON.stringify({ userId, otp, newPassword }) });
      showToast('Password updated — log in with your new password.');
      navigate('/login');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (!userId) {
    return (
      <div className="page">
        <div className="card" style={{ maxWidth: 420, margin: '2rem auto', textAlign: 'center' }}>
          <p className="helper-text">Start from <Link to="/forgot-password">Forgot password</Link>.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="card" style={{ maxWidth: 420, margin: '2rem auto' }}>
        <h3>Reset password</h3>
        <p className="helper-text">Enter the code we sent you.</p>
        {devOtp && (
          <p className="helper-text icon-row" style={{ background: 'var(--accent-soft)', padding: '0.5rem 0.75rem', borderRadius: 8 }}>
            <IconInfo /> Dev mode — your code is <strong>{devOtp}</strong>
          </p>
        )}
        <form onSubmit={handleSubmit}>
          <div className="field-group">
            <label className="field-label" htmlFor="resetOtp">6-digit code</label>
            <input id="resetOtp" className="field" maxLength={6} value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, ''))} />
          </div>
          <div className="field-group">
            <label className="field-label" htmlFor="newPassword">New password</label>
            <input id="newPassword" type="password" className="field" value={newPassword} onChange={e => setNewPassword(e.target.value)} />
          </div>
          {error && <p className="helper-text" style={{ color: '#A33F3F' }}>{error}</p>}
          <button className="btn btn-primary" style={{ width: '100%' }} disabled={busy}>{busy ? 'Updating…' : 'Update password'}</button>
        </form>
      </div>
    </div>
  );
}
