import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { IconChart } from '../components/Icons.jsx';

export default function Progress() {
  const [data, setData] = useState(null);

  useEffect(() => { api('/api/progress/analytics').then(setData).catch(() => {}); }, []);

  if (!data) return <div className="page"><div className="spinner" /></div>;
  const { overall, weakChapters, recentScores, bySection } = data;
  const avgPct = overall.avg_pct ? Math.round(overall.avg_pct * 10) / 10 : 0;
  const bestPct = overall.best_pct ? Math.round(overall.best_pct * 10) / 10 : 0;

  return (
    <div className="page">
      <div className="flex-between">
        <h2 className="icon-row"><IconChart />Your progress</h2>
        <Link className="btn btn-outline btn-sm" to="/tests">Test Centre</Link>
      </div>

      <div className="grid-3">
        <div className="card" style={{ textAlign: 'center' }}><h3>{overall.tests_taken || 0}</h3><p className="helper-text">Tests taken</p></div>
        <div className="card" style={{ textAlign: 'center' }}><h3>{avgPct}%</h3><p className="helper-text">Average score</p></div>
        <div className="card" style={{ textAlign: 'center' }}><h3>{bestPct}%</h3><p className="helper-text">Best score</p></div>
      </div>

      {bySection.length > 0 && (
        <div className="card mt-1">
          <h3>By subject</h3>
          {bySection.map(s => (
            <div key={s.section_name} className="mt-1">
              <div className="flex-between"><span>{s.section_name}</span><span className="helper-text">{s.avg_pct}% · {s.tests_taken} tests</span></div>
              <div style={{ height: 8, borderRadius: 999, background: 'var(--border)', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${s.avg_pct}%`, background: 'linear-gradient(135deg, var(--accent), var(--accent-deep))' }} />
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="card mt-1">
        <h3>Weak chapters</h3>
        {weakChapters.length === 0 && <p className="helper-text">No repeated mistakes yet — keep taking tests to surface weak spots.</p>}
        {weakChapters.map(w => (
          <div key={w.section_name + w.chapter_name} className="chapter-row">
            <span>{w.chapter_name} <span className="helper-text">({w.section_name})</span></span>
            <span className="chip chip-reference">{w.mistake_count} mistakes</span>
          </div>
        ))}
      </div>

      <div className="card mt-1">
        <h3>Recent scores</h3>
        {recentScores.length === 0 && <p className="helper-text">No tests attempted yet.</p>}
        {recentScores.map((r, i) => (
          <div key={i} className="chapter-row">
            <span><strong>{r.title}</strong> <span className="chip chip-reference">{r.test_type}</span><br />
              <span className="helper-text">{new Date(r.submitted_at).toLocaleString()}</span></span>
            <span><strong>{r.score}/{r.total}</strong> <span className="helper-text">({r.pct}%)</span></span>
          </div>
        ))}
      </div>
    </div>
  );
}
