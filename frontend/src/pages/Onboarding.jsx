import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';

export default function Onboarding() {
  const [phase, setPhase] = useState('1st MBBS');
  const [state, setState] = useState('');
  const [hours, setHours] = useState('');
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const { refreshUser } = useAuth();
  const { showToast } = useToast();

  async function handleSubmit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      await api('/api/onboarding', { method: 'POST', body: JSON.stringify({ phase, state, dailyStudyHours: hours || null }) });
      await refreshUser();
      showToast('All set!');
      navigate('/sections');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page">
      <div className="card" style={{ maxWidth: 520, margin: '2rem auto' }}>
        <h3>Tell us about your studies</h3>
        <form onSubmit={handleSubmit}>
          <div className="field-group">
            <label className="field-label" htmlFor="obPhase">Current phase</label>
            <select id="obPhase" value={phase} onChange={e => setPhase(e.target.value)}>
              <option>1st MBBS</option>
              <option>2nd MBBS</option>
              <option>Final MBBS Part 1</option>
              <option>Final MBBS Part 2</option>
            </select>
          </div>
          <div className="field-group">
            <label className="field-label" htmlFor="obState">State</label>
            <input id="obState" className="field" value={state} onChange={e => setState(e.target.value)} />
          </div>
          <div className="field-group">
            <label className="field-label" htmlFor="obHours">Daily study hours</label>
            <input id="obHours" type="number" min="0" max="18" className="field" value={hours} onChange={e => setHours(e.target.value)} />
          </div>
          <button className="btn btn-primary" style={{ width: '100%' }} disabled={busy}>{busy ? 'Saving…' : 'Continue →'}</button>
        </form>
      </div>
    </div>
  );
}
