import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { IconInfo } from '../components/Icons.jsx';

export default function VerifyOtp() {
  const location = useLocation();
  const navigate = useNavigate();
  const { loginWithToken } = useAuth();
  const { showToast } = useToast();

  const [userId] = useState(location.state?.userId || null);
  const [channel] = useState(location.state?.channel || 'email');
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [devOtp, setDevOtp] = useState(location.state?.devOtp || null);

  async function handleVerify(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const data = await api('/api/verify-otp', { method: 'POST', body: JSON.stringify({ userId, otp }) });
      if (data.pendingApproval) {
        showToast(data.message, 'success');
        navigate('/login');
        return;
      }
      await loginWithToken(data.token);
      showToast('Account verified!');
      navigate(data.onboardingDone ? '/sections' : '/onboarding');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleResend() {
    setError('');
    try {
      const data = await api('/api/resend-otp', { method: 'POST', body: JSON.stringify({ userId }) });
      setDevOtp(data.devOtp || null);
      showToast('Code resent.');
    } catch (err) {
      setError(err.message);
    }
  }

  if (!userId) {
    return (
      <div className="page">
        <div className="card" style={{ maxWidth: 420, margin: '2rem auto', textAlign: 'center' }}>
          <p className="helper-text">No pending verification. Please register or log in.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="card" style={{ maxWidth: 420, margin: '2rem auto' }}>
        <h3>Verify your account</h3>
        <p className="helper-text">We sent a 6-digit code via {channel === 'sms' ? 'SMS' : 'email'}.</p>
        {devOtp && (
          <p className="helper-text icon-row" style={{ background: 'var(--accent-soft)', padding: '0.5rem 0.75rem', borderRadius: 8 }}>
            <IconInfo /> Dev mode (no {channel === 'sms' ? 'SMS provider' : 'SMTP'} configured) — your code is <strong>{devOtp}</strong>
          </p>
        )}
        <form onSubmit={handleVerify}>
          <div className="field-group">
            <label className="field-label" htmlFor="otpInput">6-digit code</label>
            <input id="otpInput" className="field" maxLength={6} value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, ''))} />
          </div>
          {error && <p className="helper-text" style={{ color: '#A33F3F' }}>{error}</p>}
          <button className="btn btn-primary" style={{ width: '100%' }} disabled={busy}>{busy ? 'Verifying…' : 'Verify'}</button>
        </form>
        <p className="helper-text mt-1">Didn't get it? <a href="#" onClick={e => { e.preventDefault(); handleResend(); }}>Resend code</a></p>
      </div>
    </div>
  );
}