import React, { useEffect, useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { api } from '../api.js';
import { BOOK_ICON_MAP, IconBook, IconArrowLeft, IconArrowRight, IconVideo, materialIconFor } from '../components/Icons.jsx';

export default function BookDetail() {
  const { sectionId, bookId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [book, setBook] = useState(location.state?.book || null);
  const sectionName = location.state?.sectionName || '';
  const [chapters, setChapters] = useState(null);
  const [general, setGeneral] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      api(`/api/sections/${sectionId}/chapters`),
      api(`/api/books/${bookId}/general`),
      book ? Promise.resolve(book) : api(`/api/sections/${sectionId}/books`).then(list => list.find(b => String(b.id) === String(bookId)))
    ]).then(([ch, gen, b]) => {
      setChapters(ch);
      setGeneral(gen);
      if (!book) setBook(b);
    }).catch(err => setError(err.message));
  }, [sectionId, bookId]);

  const BookTypeIcon = BOOK_ICON_MAP[book?.type] || IconBook;

  return (
    <div className="page">
      <button className="nav-btn" onClick={() => navigate(`/sections/${sectionId}`, { state: { name: sectionName } })}><IconArrowLeft /> Back</button>
      <h2 className="mt-1 icon-row"><BookTypeIcon />{book?.title}</h2>
      <p className="helper-text">{book?.description}</p>

      <div className="card mt-1">
        <h3>General resources</h3>
        {general ? (
          <>
            <div>
              {general.materials.length
                ? general.materials.map(m => {
                    const MatIcon = materialIconFor(m.material_type);
                    return (
                      <a key={m.id} className="btn btn-outline btn-sm" style={{ margin: '0.2rem' }} href={m.external_url} target="_blank" rel="noopener noreferrer">
                        <MatIcon /> {m.title}
                      </a>
                    );
                  })
                : <p className="helper-text">No general materials yet.</p>}
            </div>
            <div className="mt-1">
              {general.lectures.length
                ? general.lectures.map(l => (
                    <a key={l.id} className="btn btn-outline btn-sm" style={{ margin: '0.2rem' }} href={l.url} target="_blank" rel="noopener noreferrer">
                      <IconVideo /> {l.title}
                    </a>
                  ))
                : <p className="helper-text">No general lecture videos yet.</p>}
            </div>
          </>
        ) : <div className="spinner" />}
      </div>

      <div className="card mt-1">
        <h3>Chapters</h3>
        {error && <p className="helper-text">{error}</p>}
        {!chapters && !error && <div className="spinner" />}
        <div className="mt-1">
          {chapters?.map(c => (
            <div
              key={c.id}
              className="chapter-row"
              onClick={() => navigate(`/sections/${sectionId}/books/${bookId}/chapters/${c.id}`, { state: { chapterName: c.name, book, sectionName } })}
            >
              <span>{c.name}</span><IconArrowRight className="helper-text" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
