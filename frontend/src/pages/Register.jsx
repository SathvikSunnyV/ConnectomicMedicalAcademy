import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../api.js';

export default function Register() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('student');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!name.trim() || !password) { setError('Name and password are required.'); return; }
    if (!email.trim() && !phone.trim()) { setError('Enter an email or a phone number — at least one is required.'); return; }
    if (phone.trim()) {
      const digitsOnly = phone.replace(/\D/g, '');
      if (digitsOnly.length < 7 || digitsOnly.length > 15) { setError('Enter a valid phone number.'); return; }
    }
    setBusy(true);
    try {
      const data = await api('/api/register', {
        method: 'POST',
        body: JSON.stringify({ name, email: email.trim() || undefined, phone: phone.trim() || undefined, password, role })
      });
      navigate('/verify-otp', { state: { userId: data.userId, channel: data.channel, devOtp: data.devOtp } });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page">
      <div className="card" style={{ maxWidth: 460, margin: '2rem auto' }}>
        <h3>Create your account</h3>
        <p className="helper-text">Enter an email or a phone number — you only need one, and your verification code goes there.</p>
        <form onSubmit={handleSubmit}>
          <div className="field-group">
            <label className="field-label" htmlFor="regName">Full name</label>
            <input id="regName" className="field" value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div className="field-group">
            <label className="field-label" htmlFor="regEmail">Email {phone.trim() ? '(optional)' : ''}</label>
            <input id="regEmail" type="email" className="field" value={email} onChange={e => setEmail(e.target.value)} />
          </div>
          <div className="field-group">
            <label className="field-label" htmlFor="regPhone">Phone number {email.trim() ? '(optional)' : ''}</label>
            <input id="regPhone" type="tel" className="field" placeholder="+91 98765 43210" value={phone} onChange={e => setPhone(e.target.value)} />
          </div>
          <div className="field-group">
            <label className="field-label" htmlFor="regPassword">Password</label>
            <input id="regPassword" type="password" className="field" value={password} onChange={e => setPassword(e.target.value)} />
          </div>
          <div className="field-group">
            <label className="field-label" htmlFor="regRole">I am a</label>
            <select id="regRole" value={role} onChange={e => setRole(e.target.value)}>
              <option value="student">Student</option>
              <option value="faculty">Faculty</option>
            </select>
          </div>
          {error && <p className="helper-text" style={{ color: '#A33F3F' }}>{error}</p>}
          <button className="btn btn-primary" style={{ width: '100%' }} disabled={busy}>{busy ? 'Creating…' : 'Create account'}</button>
        </form>
        <p className="helper-text mt-1">Already have an account? <Link to="/login">Log in</Link></p>
      </div>
    </div>
  );
}
