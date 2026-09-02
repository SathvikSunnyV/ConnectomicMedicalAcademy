import React from 'react';
import { useNavigate } from 'react-router-dom';
import { LEVELS } from '../components/Icons.jsx';

// Entry point into all learning content -- the three top-level, independently
// organized divisions of the site: Bridge Course, MBBS Level, Reference &
// Postgraduate. Each is its own space with its own subjects/books/chapters;
// picking one here just filters everything downstream to that division.
export default function Sections() {
  const navigate = useNavigate();

  return (
    <div className="page">
      <div className="eyebrow">Choose a level</div>
      <h2>Bridge Course · MBBS Level · Reference &amp; Postgraduate · FMGE</h2>
      <p className="helper-text">Each section is organized separately -- pick where you want to study.</p>

      <div className="grid-4 mt-1">
        {LEVELS.map(({ key, label, tagline, Icon }) => (
          <div
            key={key}
            className={`card level-card level-card-${key}`}
            onClick={() => navigate(`/sections/level/${key}`, { state: { level: key, levelLabel: label } })}
          >
            <Icon className="level-card-icon" />
            <h3>{label}</h3>
            <p className="helper-text">{tagline}</p>
          </div>
        ))}
      </div>
    </div>
  );
}