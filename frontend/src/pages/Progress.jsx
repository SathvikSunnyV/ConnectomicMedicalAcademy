import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { IconChart } from '../components/Icons.jsx';

function SubjectBarChart({ bySection }) {
  const width = 600, height = 220, padding = 36;
  const barGap = 24;
  const barWidth = (width - padding * 2 - barGap * (bySection.length - 1)) / bySection.length;
  const scaleY = v => height - padding - (v / 100) * (height - padding * 2);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 'auto' }}>
      {[0, 25, 50, 75, 100].map(v => (
        <g key={v}>
          <line x1={padding} x2={width - padding} y1={scaleY(v)} y2={scaleY(v)} stroke="var(--border)" strokeWidth="1" />
          <text x={padding - 8} y={scaleY(v) + 4} fontSize="10" textAnchor="end" fill="var(--ink-soft)">{v}%</text>
        </g>
      ))}
      {bySection.map((s, i) => {
        const x = padding + i * (barWidth + barGap);
        const y = scaleY(s.avg_pct);
        const barHeight = height - padding - y;
        return (
          <g key={s.section_name}>
            <rect x={x} y={y} width={barWidth} height={barHeight} rx="6" fill="var(--accent)" />
            <text x={x + barWidth / 2} y={y - 6} fontSize="11" textAnchor="middle" fill="var(--ink)" fontWeight="600">{s.avg_pct}%</text>
            <text x={x + barWidth / 2} y={height - padding + 16} fontSize="10" textAnchor="middle" fill="var(--ink-soft)">{s.section_name}</text>
          </g>
        );
      })}
    </svg>
  );
}

function ScoreTrendChart({ recentScores }) {
  const points = [...recentScores].reverse(); // oldest -> newest, left to right
  const width = 600, height = 200, padding = 36;
  const scaleX = i => padding + (points.length === 1 ? 0 : (i / (points.length - 1)) * (width - padding * 2));
  const scaleY = v => height - padding - (v / 100) * (height - padding * 2);
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${scaleX(i)} ${scaleY(p.pct)}`).join(' ');

  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 'auto' }}>
      {[0, 25, 50, 75, 100].map(v => (
        <g key={v}>
          <line x1={padding} x2={width - padding} y1={scaleY(v)} y2={scaleY(v)} stroke="var(--border)" strokeWidth="1" />
          <text x={padding - 8} y={scaleY(v) + 4} fontSize="10" textAnchor="end" fill="var(--ink-soft)">{v}%</text>
        </g>
      ))}
      <path d={path} fill="none" stroke="var(--accent-deep)" strokeWidth="2.5" />
      {points.map((p, i) => (
        <circle key={i} cx={scaleX(i)} cy={scaleY(p.pct)} r="4" fill="var(--accent-deep)">
          <title>{p.title}: {p.pct}%</title>
        </circle>
      ))}
    </svg>
  );
}

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
          <SubjectBarChart bySection={bySection} />
        </div>
      )}

      {recentScores.length > 1 && (
        <div className="card mt-1">
          <h3>Score trend</h3>
          <ScoreTrendChart recentScores={recentScores} />
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