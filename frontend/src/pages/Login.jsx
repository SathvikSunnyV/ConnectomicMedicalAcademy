import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';

export default function Login() {
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
      await loginWithToken(data.token);
      showToast('Welcome back!');
      navigate(data.role === 'admin' ? '/admin' : data.role === 'faculty' ? '/faculty' : (data.onboardingDone ? '/sections' : '/onboarding'));
    } catch (err) {
      if (err.data?.needsVerification) {
        navigate('/verify-otp', { state: { userId: err.data.userId } });
        return;
      }
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page">
      <div className="card" style={{ maxWidth: 420, margin: '2rem auto' }}>
        <h3>Log in</h3>
        <form onSubmit={handleSubmit}>
          <div className="field-group">
            <label className="field-label" htmlFor="loginIdentifier">Email or phone number</label>
            <input id="loginIdentifier" className="field" value={identifier} onChange={e => setIdentifier(e.target.value)} />
          </div>
          <div className="field-group">
            <label className="field-label" htmlFor="loginPassword">Password</label>
            <input id="loginPassword" type="password" className="field" value={password} onChange={e => setPassword(e.target.value)} />
          </div>
          {error && <p className="helper-text" style={{ color: '#A33F3F' }}>{error}</p>}
          <button className="btn btn-primary" style={{ width: '100%' }} disabled={busy}>{busy ? 'Logging in…' : 'Log in'}</button>
        </form>
        <p className="helper-text mt-1">
          <Link to="/forgot-password">Forgot password?</Link> · New here? <Link to="/register">Create an account</Link>
        </p>
      </div>
    </div>
  );
}
