import React, { useEffect, useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { api } from '../api.js';
import { SECTION_ICON_MAP, BOOK_ICON_MAP, IconBook, IconArrowLeft } from '../components/Icons.jsx';

export default function SectionDetail() {
  const { sectionId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [sectionName, setSectionName] = useState(location.state?.name || '');
  const [books, setBooks] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api(`/api/sections/${sectionId}/books`).then(setBooks).catch(err => setError(err.message));
    if (!sectionName) {
      api('/api/sections').then(list => {
        const match = list.find(s => String(s.id) === String(sectionId));
        if (match) setSectionName(match.name);
      }).catch(() => {});
    }
  }, [sectionId]);

  const SectionIcon = SECTION_ICON_MAP[sectionName] || IconBook;

  return (
    <div className="page">
      <button className="nav-btn" onClick={() => navigate('/sections')}><IconArrowLeft /> All sections</button>
      <h2 className="mt-1 icon-row"><SectionIcon className="section-icon" style={{ marginBottom: 0 }} />{sectionName}</h2>
      {error && <p className="helper-text">{error}</p>}
      {!books && !error && <div className="spinner" />}
      <div className="grid-2 mt-1">
        {books?.map(b => {
          const BookIcon = BOOK_ICON_MAP[b.type] || IconBook;
          return (
            <div
              key={b.id}
              className="card book-card"
              onClick={() => navigate(`/sections/${sectionId}/books/${b.id}`, { state: { book: b, sectionName } })}
            >
              <span className={`chip chip-${b.type}`}>{b.type === 'mbbs' ? 'MBBS Level' : 'Reference'}</span>
              <h3 className="mt-1 icon-row"><BookIcon />{b.title}</h3>
              <p className="helper-text">{b.description}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
