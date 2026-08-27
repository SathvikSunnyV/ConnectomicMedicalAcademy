import React, { useEffect, useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { api } from '../api.js';
import NoteModal from '../components/NoteModal.jsx';
import { IconDocument, IconVideo, IconArrowLeft, materialIconFor } from '../components/Icons.jsx';

export default function ChapterDetail() {
  const { sectionId, bookId, chapterId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const chapterName = location.state?.chapterName || '';
  const book = location.state?.book;
  const sectionName = location.state?.sectionName || '';
  const level = location.state?.level || null;
  const levelLabel = location.state?.levelLabel || '';

  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [activeNote, setActiveNote] = useState(null);

  useEffect(() => {
    api(`/api/books/${bookId}/chapters/${chapterId}`).then(setData).catch(err => setError(err.message));
  }, [bookId, chapterId]);

  return (
    <div className="page">
      <button
        className="nav-btn"
        onClick={() => navigate(`/sections/${sectionId}/books/${bookId}`, { state: { book, sectionName, level, levelLabel } })}
      >
        <IconArrowLeft /> Back to chapters
      </button>
      <h2 className="mt-1">{chapterName}</h2>

      {error && <p className="helper-text">{error}</p>}
      {!data && !error && <div className="spinner" />}

      {data && (
        <>
          <div className="card mt-1">
            <h3 className="icon-row"><IconDocument />Notes</h3>
            {data.notes.length
              ? data.notes.map(n => (
                  <button key={n.id} className="btn btn-outline btn-sm" style={{ margin: '0.2rem' }} onClick={() => setActiveNote(n)}>
                    <IconDocument /> {n.title}
                  </button>
                ))
              : <p className="helper-text">No notes yet for this chapter.</p>}
          </div>

          <div className="card mt-1">
            <h3 className="icon-row"><IconDocument />Materials</h3>
            {data.materials.length
              ? data.materials.map(m => {
                  const MatIcon = materialIconFor(m.material_type);
                  return (
                    <a key={m.id} className="btn btn-outline btn-sm" style={{ margin: '0.2rem' }} href={m.external_url} target="_blank" rel="noopener noreferrer">
                      <MatIcon /> {m.title}
                    </a>
                  );
                })
              : <p className="helper-text">No materials yet for this chapter.</p>}
          </div>

          <div className="card mt-1">
            <h3 className="icon-row"><IconVideo />Lecture videos</h3>
            {data.lectures.length
              ? data.lectures.map(l => (
                  <a key={l.id} className="btn btn-outline btn-sm" style={{ margin: '0.2rem' }} href={l.url} target="_blank" rel="noopener noreferrer">
                    <IconVideo /> {l.title}
                  </a>
                ))
              : <p className="helper-text">No lecture videos yet for this chapter.</p>}
          </div>
        </>
      )}

      <NoteModal note={activeNote} onClose={() => setActiveNote(null)} />
    </div>
  );
}
