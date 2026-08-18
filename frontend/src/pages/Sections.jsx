import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { SECTION_ICON_MAP, IconBook } from '../components/Icons.jsx';

export default function Sections() {
  const [sections, setSections] = useState(null);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    api('/api/sections').then(setSections).catch(err => setError(err.message));
  }, []);

  return (
    <div className="page">
      <div className="eyebrow">Choose a section</div>
      <h2>Anatomy · Physiology · Biochemistry · Neuroscience</h2>
      {error && <p className="helper-text">{error}</p>}
      {!sections && !error && <div className="spinner" />}
      <div className="grid-4 mt-1">
        {sections?.map(s => {
          const Icon = SECTION_ICON_MAP[s.name] || IconBook;
          return (
            <div key={s.id} className="card section-card section-icon-card" onClick={() => navigate(`/sections/${s.id}`, { state: { name: s.name } })}>
              <Icon className="section-icon" />
              <h3>{s.name}</h3>
              <p className="helper-text">MBBS Level · Reference &amp; Resources</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
