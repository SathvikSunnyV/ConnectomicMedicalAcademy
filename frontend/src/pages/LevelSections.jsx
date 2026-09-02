import React, { useEffect, useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { api } from '../api.js';
import { SECTION_ICON_MAP, IconBook, IconArrowLeft, LEVELS, BRIDGE_SUBSECTIONS, STANDARD_SUBSECTIONS } from '../components/Icons.jsx';

export default function LevelSections() {
  const { level } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const levelInfo = LEVELS.find(l => l.key === level);
  const levelLabel = location.state?.levelLabel || levelInfo?.label || level;
  const allowedSubjects = level === 'bridge' ? BRIDGE_SUBSECTIONS : STANDARD_SUBSECTIONS;

  const [sections, setSections] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api('/api/sections').then(setSections).catch(err => setError(err.message));
  }, []);

  const visibleSections = sections?.filter(s => allowedSubjects.includes(s.name));

  return (
    <div className="page">
      <button className="nav-btn" onClick={() => navigate('/sections')}><IconArrowLeft /> All levels</button>
      <div className="eyebrow mt-1">{levelLabel}</div>
      <h2>{allowedSubjects.join(' · ')}</h2>
      {error && <p className="helper-text">{error}</p>}
      {!sections && !error && <div className="spinner" />}
      <div className="grid-4 mt-1">
        {visibleSections?.map(s => {
          const Icon = SECTION_ICON_MAP[s.name] || IconBook;
          return (
            <div
              key={s.id}
              className="card section-card section-icon-card"
              onClick={() => navigate(`/sections/${s.id}`, { state: { name: s.name, level, levelLabel } })}
            >
              <Icon className="section-icon" />
              <h3>{s.name}</h3>
              <p className="helper-text">{levelLabel}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}