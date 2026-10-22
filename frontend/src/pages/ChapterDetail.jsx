import React, { useEffect, useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { api } from '../api.js';
import NoteModal from '../components/NoteModal.jsx';
import { IconDocument, IconVideo, IconArrowLeft, materialIconFor, LEVELS } from '../components/Icons.jsx';

export default function ChapterDetail() {
  const { sectionId, bookId, chapterId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  // location.state is only present when the user navigated here from the
  // chapter list. A bookmark, refresh, or shared URL arrives with none of
  // it -- in that case we fetch the chapter, its section and its book from
  // the API instead of rendering blank header/back-button context.
  const [chapterName, setChapterName] = useState(location.state?.chapterName || '');
  const [book, setBook] = useState(location.state?.book || null);
  const [sectionName, setSectionName] = useState(location.state?.sectionName || '');
  const [level, setLevel] = useState(location.state?.level || null);
  const [levelLabel, setLevelLabel] = useState(location.state?.levelLabel || '');

  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [activeNote, setActiveNote] = useState(null);

  useEffect(() => {
    api(`/api/books/${bookId}/chapters/${chapterId}`).then(async (res) => {
      setData(res);
      if (!location.state && res.chapter) {
        setChapterName(res.chapter.name);
        try {
          const [sections, books] = await Promise.all([
            api('/api/sections'),
            api(`/api/sections/${res.chapter.section_id}/books`),
          ]);
          const section = sections.find(s => s.id === res.chapter.section_id);
          const matchedBook = books.find(b => b.id === Number(bookId));
          if (section) setSectionName(section.name);
          if (matchedBook) {
            setBook(matchedBook);
            const levelInfo = LEVELS.find(l => l.key === matchedBook.type);
            setLevel(matchedBook.type);
            setLevelLabel(levelInfo?.label || '');
          }
        } catch {
          // Non-fatal -- chapter content itself already loaded. Back button
          // still works via sectionId/bookId from the URL, just without the
          // nicer state-restored labels.
        }
      }
    }).catch(err => setError(err.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
