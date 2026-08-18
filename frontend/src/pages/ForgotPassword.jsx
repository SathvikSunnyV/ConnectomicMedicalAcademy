import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../api.js';

export default function ForgotPassword() {
  const [identifier, setIdentifier] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const data = await api('/api/forgot-password', { method: 'POST', body: JSON.stringify({ identifier }) });
      if (!data.userId) {
        // Don't reveal whether the account exists -- just say the message and let them try again.
        setError('If that account exists, a reset code has been sent. Check your email/phone, or try again.');
        setBusy(false);
        return;
      }
      navigate('/reset-password', { state: { userId: data.userId, devOtp: data.devOtp } });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page">
      <div className="card" style={{ maxWidth: 420, margin: '2rem auto' }}>
        <h3>Forgot your password?</h3>
        <p className="helper-text">Enter your email or phone number and we'll send a reset code.</p>
        <form onSubmit={handleSubmit}>
          <div className="field-group">
            <label className="field-label" htmlFor="fpIdentifier">Email or phone number</label>
            <input id="fpIdentifier" className="field" value={identifier} onChange={e => setIdentifier(e.target.value)} />
          </div>
          {error && <p className="helper-text" style={{ color: '#A33F3F' }}>{error}</p>}
          <button className="btn btn-primary" style={{ width: '100%' }} disabled={busy}>{busy ? 'Sending…' : 'Send reset code'}</button>
        </form>
        <p className="helper-text mt-1"><Link to="/login">Back to login</Link></p>
      </div>
    </div>
  );
}
