import React, { useEffect, useState } from 'react';
import { api, apiUpload } from '../api.js';
import { useToast } from '../context/ToastContext.jsx';
import { IconGraduate, IconQuiz } from '../components/Icons.jsx';

export default function FacultyHub() {
  const { showToast } = useToast();
  const [tab, setTab] = useState('content');
  const [sections, setSections] = useState([]);
  const [sectionId, setSectionId] = useState('');
  const [books, setBooks] = useState([]);
  const [bookId, setBookId] = useState('');
  const [chapters, setChapters] = useState([]);
  const [chapterId, setChapterId] = useState('');

  const [myNotes, setMyNotes] = useState([]);
  const [myMaterials, setMyMaterials] = useState([]);
  const [myLectures, setMyLectures] = useState([]);

  useEffect(() => { loadSections(); loadMine(); }, []);

  useEffect(() => {
    if (!sectionId) { setBooks([]); setChapters([]); return; }
    loadBooksAndChapters();
  }, [sectionId]);

  function loadSections() { api('/api/sections').then(setSections).catch(() => {}); }
  function loadBooksAndChapters() {
    if (!sectionId) return;
    api(`/api/sections/${sectionId}/books`).then(setBooks).catch(() => {});
    api(`/api/sections/${sectionId}/chapters`).then(setChapters).catch(() => {});
  }

  function loadMine() {
    api('/api/faculty/notes/mine').then(setMyNotes).catch(() => {});
    api('/api/faculty/materials/mine').then(setMyMaterials).catch(() => {});
    api('/api/faculty/lectures/mine').then(setMyLectures).catch(() => {});
  }

  return (
    <div className="page">
      <h2 className="icon-row"><IconGraduate />Faculty Hub</h2>

      <div className="nav-links mt-1">
        <button className={`nav-btn ${tab === 'content' ? 'active' : ''}`} onClick={() => setTab('content')}>Content</button>
        <button className={`nav-btn ${tab === 'qbank' ? 'active' : ''}`} onClick={() => setTab('qbank')}>Question Bank</button>
        <button className={`nav-btn ${tab === 'tests' ? 'active' : ''}`} onClick={() => setTab('tests')}>Grand Tests</button>
      </div>

      {tab === 'content' && (
        <>
          <div className="card mt-1">
            <h3>Working in</h3>
            <div className="grid-3">
              <div className="field-group">
                <label className="field-label" htmlFor="facSection">Section</label>
                <select id="facSection" value={sectionId} onChange={e => { setSectionId(e.target.value); setBookId(''); setChapterId(''); }}>
                  <option value="">— Select —</option>
                  {sections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div className="field-group">
                <label className="field-label" htmlFor="facBook">Book</label>
                <select id="facBook" value={bookId} onChange={e => setBookId(e.target.value)} disabled={!sectionId}>
                  <option value="">— Select —</option>
                  {books.map(b => <option key={b.id} value={b.id}>{b.title}</option>)}
                </select>
              </div>
              <div className="field-group">
                <label className="field-label" htmlFor="facChapter">Chapter</label>
                <select id="facChapter" value={chapterId} onChange={e => setChapterId(e.target.value)} disabled={!sectionId}>
                  <option value="">— Whole book (no specific chapter) —</option>
                  {chapters.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            </div>
          </div>

          <DropdownManager
            sections={sections} sectionId={sectionId} books={books} chapters={chapters}
            onSectionsChanged={loadSections} onBooksChaptersChanged={loadBooksAndChapters}
          />

          <AddNoteForm bookId={bookId} chapterId={chapterId} onSaved={loadMine} />
          <AddMaterialForm bookId={bookId} chapterId={chapterId} onSaved={loadMine} />
          <AddLectureForm bookId={bookId} chapterId={chapterId} onSaved={loadMine} />

          <MyContentList title="Your notes" items={myNotes} onChanged={loadMine}
            renderMeta={n => `${n.section_name} · ${n.book_title} · ${n.chapter_name}`}
            onDelete={id => api(`/api/faculty/notes/${id}`, { method: 'DELETE' })}
          />
          <MyContentList title="Your materials" items={myMaterials} onChanged={loadMine}
            renderMeta={m => `${m.section_name} · ${m.book_title}${m.chapter_name ? ' · ' + m.chapter_name : ' · whole book'} · ${m.material_type} (${m.source_type === 'file' ? 'uploaded file' : 'link'})`}
            onDelete={id => api(`/api/faculty/materials/${id}`, { method: 'DELETE' })}
          />
          <MyContentList title="Your lecture videos" items={myLectures} onChanged={loadMine}
            renderMeta={l => `${l.section_name} · ${l.book_title}${l.chapter_name ? ' · ' + l.chapter_name : ' · whole book'}`}
            onDelete={id => api(`/api/faculty/lectures/${id}`, { method: 'DELETE' })}
          />
        </>
      )}

      {tab === 'qbank' && <QuestionBankPanel sections={sections} />}
      {tab === 'tests' && <GrandTestsPanel />}
    </div>
  );

  function DropdownManager({ sections, sectionId, books, chapters, onSectionsChanged, onBooksChaptersChanged }) {
    const [newSectionName, setNewSectionName] = useState('');
    const [newBookTitle, setNewBookTitle] = useState('');
    const [newBookType, setNewBookType] = useState('mbbs');
    const [newChapterName, setNewChapterName] = useState('');
    const [busy, setBusy] = useState(false);

    async function addSection(e) {
      e.preventDefault();
      if (!newSectionName.trim()) return;
      setBusy(true);
      try {
        await api('/api/faculty/sections', { method: 'POST', body: JSON.stringify({ name: newSectionName }) });
        showToast('Subject created.'); setNewSectionName(''); onSectionsChanged();
      } catch (err) { showToast(err.message, 'error'); } finally { setBusy(false); }
    }
    async function deleteSection(id, name) {
      if (!confirm(`Delete "${name}"? This removes every book, chapter, note, material, lecture and question under it.`)) return;
      try { await api(`/api/faculty/sections/${id}`, { method: 'DELETE' }); showToast('Subject deleted.'); onSectionsChanged(); onBooksChaptersChanged(); }
      catch (err) { showToast(err.message, 'error'); }
    }

    async function addBook(e) {
      e.preventDefault();
      if (!sectionId) { showToast('Pick a section above first.', 'error'); return; }
      if (!newBookTitle.trim()) return;
      setBusy(true);
      try {
        await api('/api/faculty/books', { method: 'POST', body: JSON.stringify({ sectionId, type: newBookType, title: newBookTitle }) });
        showToast('Book created.'); setNewBookTitle(''); onBooksChaptersChanged();
      } catch (err) { showToast(err.message, 'error'); } finally { setBusy(false); }
    }
    async function deleteBook(id, title) {
      if (!confirm(`Delete "${title}"? This removes every note, material and lecture under it.`)) return;
      try { await api(`/api/faculty/books/${id}`, { method: 'DELETE' }); showToast('Book deleted.'); onBooksChaptersChanged(); }
      catch (err) { showToast(err.message, 'error'); }
    }

    async function addChapter(e) {
      e.preventDefault();
      if (!sectionId) { showToast('Pick a section above first.', 'error'); return; }
      if (!newChapterName.trim()) return;
      setBusy(true);
      try {
        await api('/api/faculty/chapters', { method: 'POST', body: JSON.stringify({ sectionId, name: newChapterName }) });
        showToast('Chapter created.'); setNewChapterName(''); onBooksChaptersChanged();
      } catch (err) { showToast(err.message, 'error'); } finally { setBusy(false); }
    }
    async function deleteChapter(id, name) {
      if (!confirm(`Delete "${name}"? This removes every note, material, lecture and question tied to it.`)) return;
      try { await api(`/api/faculty/chapters/${id}`, { method: 'DELETE' }); showToast('Chapter deleted.'); onBooksChaptersChanged(); }
      catch (err) { showToast(err.message, 'error'); }
    }

    return (
      <div className="card">
        <h3>Manage subjects, books & chapters</h3>
        <p className="helper-text">Full control over everything in the dropdowns above.</p>

        <div className="grid-3 mt-1">
          <div>
            <h4>Subjects</h4>
            <form onSubmit={addSection} className="flex-between" style={{ gap: '0.4rem' }}>
              <input className="field" placeholder="New subject name" value={newSectionName} onChange={e => setNewSectionName(e.target.value)} />
              <button className="btn btn-secondary btn-sm" disabled={busy}>Add</button>
            </form>
            {sections.map(s => (
              <div key={s.id} className="chapter-row">
                <span>{s.name}</span>
                <button className="btn btn-danger btn-sm" onClick={() => deleteSection(s.id, s.name)}>Delete</button>
              </div>
            ))}
          </div>

          <div>
            <h4>Books {sectionId ? '' : '(pick a subject)'}</h4>
            {sectionId && (
              <form onSubmit={addBook}>
                <input className="field" placeholder="New book title" value={newBookTitle} onChange={e => setNewBookTitle(e.target.value)} />
                <select className="mt-1" value={newBookType} onChange={e => setNewBookType(e.target.value)}>
                  <option value="mbbs">MBBS Level</option>
                  <option value="reference">Reference</option>
                </select>
                <button className="btn btn-secondary btn-sm mt-1" disabled={busy}>Add book</button>
              </form>
            )}
            {books.map(b => (
              <div key={b.id} className="chapter-row">
                <span>{b.title} <span className="helper-text">({b.type})</span></span>
                <button className="btn btn-danger btn-sm" onClick={() => deleteBook(b.id, b.title)}>Delete</button>
              </div>
            ))}
          </div>

          <div>
            <h4>Chapters {sectionId ? '' : '(pick a subject)'}</h4>
            {sectionId && (
              <form onSubmit={addChapter} className="flex-between" style={{ gap: '0.4rem' }}>
                <input className="field" placeholder="New chapter name" value={newChapterName} onChange={e => setNewChapterName(e.target.value)} />
                <button className="btn btn-secondary btn-sm" disabled={busy}>Add</button>
              </form>
            )}
            {chapters.map(c => (
              <div key={c.id} className="chapter-row">
                <span>{c.name}</span>
                <button className="btn btn-danger btn-sm" onClick={() => deleteChapter(c.id, c.name)}>Delete</button>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  function AddNoteForm({ bookId, chapterId, onSaved }) {
    const [title, setTitle] = useState('');
    const [html, setHtml] = useState('');
    const [busy, setBusy] = useState(false);

    async function handleSubmit(e) {
      e.preventDefault();
      if (!chapterId) { showToast('Notes need a specific chapter selected above.', 'error'); return; }
      if (!title.trim() || !html.trim()) { showToast('Title and HTML content are required.', 'error'); return; }
      setBusy(true);
      try {
        await api('/api/faculty/notes', { method: 'POST', body: JSON.stringify({ chapterId, bookId, title, htmlContent: html }) });
        showToast('Note saved.');
        setTitle(''); setHtml('');
        onSaved();
      } catch (err) {
        showToast(err.message, 'error');
      } finally { setBusy(false); }
    }

    return (
      <div className="card">
        <h3>Add a chapter note (HTML)</h3>
        <form onSubmit={handleSubmit}>
          <div className="field-group">
            <label className="field-label">Note title</label>
            <input className="field" value={title} onChange={e => setTitle(e.target.value)} />
          </div>
          <div className="field-group">
            <label className="field-label">HTML content</label>
            <textarea rows={8} value={html} onChange={e => setHtml(e.target.value)} placeholder="Paste the full HTML page for this note..." />
          </div>
          <button className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save note'}</button>
        </form>
      </div>
    );
  }

  function AddMaterialForm({ bookId, chapterId, onSaved }) {
    const [title, setTitle] = useState('');
    const [type, setType] = useState('link');
    const [source, setSource] = useState('link'); // 'link' | 'file'
    const [url, setUrl] = useState('');
    const [file, setFile] = useState(null);
    const [busy, setBusy] = useState(false);

    async function handleSubmit(e) {
      e.preventDefault();
      if (!bookId) { showToast('Select a section and book above first.', 'error'); return; }
      if (!title.trim()) { showToast('Title is required.', 'error'); return; }
      if (source === 'link' && !url.trim()) { showToast('Enter a link, or switch to file upload.', 'error'); return; }
      if (source === 'file' && !file) { showToast('Choose a file to upload, or switch to link.', 'error'); return; }
      setBusy(true);
      try {
        if (source === 'file') {
          const fd = new FormData();
          fd.append('bookId', bookId); if (chapterId) fd.append('chapterId', chapterId);
          fd.append('title', title); fd.append('materialType', type); fd.append('file', file);
          await apiUpload('/api/faculty/materials', fd);
        } else {
          await api('/api/faculty/materials', { method: 'POST', body: JSON.stringify({ bookId, chapterId: chapterId || null, title, materialType: type, externalUrl: url }) });
        }
        showToast('Material saved.');
        setTitle(''); setUrl(''); setFile(null);
        onSaved();
      } catch (err) {
        showToast(err.message, 'error');
      } finally { setBusy(false); }
    }

    return (
      <div className="card">
        <h3>Add a material (link / PPT / reference book)</h3>
        <form onSubmit={handleSubmit}>
          <div className="field-group">
            <label className="field-label">Title</label>
            <input className="field" value={title} onChange={e => setTitle(e.target.value)} />
          </div>
          <div className="grid-2">
            <div className="field-group">
              <label className="field-label">Type</label>
              <select value={type} onChange={e => setType(e.target.value)}>
                <option value="link">Link</option>
                <option value="ppt">PPT</option>
                <option value="book">Reference book</option>
              </select>
            </div>
            <div className="field-group">
              <label className="field-label">Source</label>
              <select value={source} onChange={e => setSource(e.target.value)}>
                <option value="link">Paste a link</option>
                <option value="file">Upload a file</option>
              </select>
            </div>
          </div>
          {source === 'link' ? (
            <div className="field-group">
              <label className="field-label">URL</label>
              <input className="field" value={url} onChange={e => setUrl(e.target.value)} />
            </div>
          ) : (
            <div className="field-group">
              <label className="field-label">File (PDF / PPT / etc., up to 100MB)</label>
              <input className="field" type="file" onChange={e => setFile(e.target.files?.[0] || null)} />
            </div>
          )}
          <p className="helper-text">Leave chapter as "whole book" above for a general resource, or pick a chapter for a chapter-specific one.</p>
          <button className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save material'}</button>
        </form>
      </div>
    );
  }

  function AddLectureForm({ bookId, chapterId, onSaved }) {
    const [title, setTitle] = useState('');
    const [file, setFile] = useState(null);
    const [busy, setBusy] = useState(false);

    async function handleSubmit(e) {
      e.preventDefault();
      if (!bookId) { showToast('Select a section and book above first.', 'error'); return; }
      if (!title.trim()) { showToast('Title is required.', 'error'); return; }
      if (!file) { showToast('Choose a video file to upload — lecture videos must be uploaded, links are not accepted.', 'error'); return; }
      setBusy(true);
      try {
        const fd = new FormData();
        fd.append('bookId', bookId); if (chapterId) fd.append('chapterId', chapterId);
        fd.append('title', title); fd.append('file', file);
        await apiUpload('/api/faculty/lectures', fd);
        showToast('Lecture uploaded.');
        setTitle(''); setFile(null);
        onSaved();
      } catch (err) {
        showToast(err.message, 'error');
      } finally { setBusy(false); }
    }

    return (
      <div className="card">
        <h3>Add a lecture video</h3>
        <p className="helper-text">Lecture videos are always uploaded to the CDN — no external links here.</p>
        <form onSubmit={handleSubmit}>
          <div className="field-group">
            <label className="field-label">Title</label>
            <input className="field" value={title} onChange={e => setTitle(e.target.value)} />
          </div>
          <div className="field-group">
            <label className="field-label">Video file (up to 1GB)</label>
            <input className="field" type="file" accept="video/*" onChange={e => setFile(e.target.files?.[0] || null)} />
          </div>
          <button className="btn btn-primary" disabled={busy}>{busy ? 'Uploading…' : 'Upload lecture'}</button>
        </form>
      </div>
    );
  }

  function MyContentList({ title, items, renderMeta, onDelete, onChanged }) {
    async function handleDelete(id) {
      if (!confirm('Delete this? This cannot be undone.')) return;
      try {
        await onDelete(id);
        showToast('Deleted.');
        onChanged();
      } catch (err) {
        showToast(err.message, 'error');
      }
    }

    return (
      <div className="card">
        <h3>{title}</h3>
        {items.length === 0 && <p className="helper-text">Nothing here yet.</p>}
        {items.map(item => (
          <div key={item.id} className="chapter-row">
            <span>
              <strong>{item.title}</strong><br />
              <span className="helper-text">{renderMeta(item)}</span>
            </span>
            <button className="btn btn-danger btn-sm" onClick={() => handleDelete(item.id)}>Delete</button>
          </div>
        ))}
      </div>
    );
  }

  function QuestionBankPanel({ sections }) {
    const { showToast } = useToast();
    const [sectionId, setSectionId] = useState('');
    const [chapters, setChapters] = useState([]);
    const [chapterId, setChapterId] = useState('');
    const [questionText, setQuestionText] = useState('');
    const [options, setOptions] = useState({ A: '', B: '', C: '', D: '' });
    const [correctAnswer, setCorrectAnswer] = useState('A');
    const [difficulty, setDifficulty] = useState('Moderate');
    const [explanation, setExplanation] = useState('');
    const [busy, setBusy] = useState(false);
    const [mine, setMine] = useState([]);
    const [statusFilter, setStatusFilter] = useState('');

    useEffect(() => {
      if (!sectionId) { setChapters([]); return; }
      api(`/api/sections/${sectionId}/chapters`).then(setChapters).catch(() => {});
    }, [sectionId]);

    useEffect(() => { loadMine(); }, [statusFilter]);

    function loadMine() {
      const qs = statusFilter ? `?status=${statusFilter}` : '';
      api(`/api/qbank/questions${qs}`).then(d => setMine(d.questions)).catch(() => {});
    }

    async function handleSubmit(e) {
      e.preventDefault();
      if (!sectionId || !chapterId) { showToast('Pick a subject and chapter first.', 'error'); return; }
      if (!questionText.trim() || !options.A.trim() || !options.B.trim() || !options.C.trim() || !options.D.trim())
        { showToast('Question text and all four options are required.', 'error'); return; }
      setBusy(true);
      try {
        await api('/api/qbank/questions', {
          method: 'POST',
          body: JSON.stringify({
            sectionId, chapterId, questionText,
            optionA: options.A, optionB: options.B, optionC: options.C, optionD: options.D,
            correctAnswer, explanation, difficulty
          })
        });
        showToast('Question submitted — pending admin approval.');
        setQuestionText(''); setOptions({ A: '', B: '', C: '', D: '' }); setExplanation('');
        loadMine();
      } catch (err) { showToast(err.message, 'error'); } finally { setBusy(false); }
    }

    async function handleDelete(id) {
      if (!confirm('Delete this question?')) return;
      try { await api(`/api/qbank/questions/${id}`, { method: 'DELETE' }); showToast('Deleted.'); loadMine(); }
      catch (err) { showToast(err.message, 'error'); }
    }

    const [bulkText, setBulkText] = useState('');
    const [bulkBusy, setBulkBusy] = useState(false);

    async function handleBulkImport(e) {
      e.preventDefault();
      let parsed;
      try { parsed = JSON.parse(bulkText); } catch { showToast('Not valid JSON — paste an array of question objects.', 'error'); return; }
      if (!Array.isArray(parsed) || parsed.length === 0) { showToast('Paste a JSON array of questions.', 'error'); return; }
      setBulkBusy(true);
      try {
        const result = await api('/api/qbank/questions/bulk', { method: 'POST', body: JSON.stringify({ questions: parsed }) });
        showToast(`Imported ${result.inserted} question(s)${result.errors.length ? `, ${result.errors.length} error(s) — check console` : ''} — pending admin approval.`);
        if (result.errors.length) console.warn('Bulk import errors:', result.errors);
        setBulkText('');
        loadMine();
      } catch (err) { showToast(err.message, 'error'); } finally { setBulkBusy(false); }
    }

    return (
      <>
        <div className="card mt-1">
          <h3>Bulk import (JSON, by chapter name)</h3>
          <p className="helper-text">Paste an array of questions keyed by chapterName — no need to look up IDs. Each item needs chapterName, questionText, optionA-D and correctAnswer (A-D); topic, explanation, difficulty and estimatedTime (seconds) are optional. These go to the approval queue like any other faculty submission.</p>
          <form onSubmit={handleBulkImport}>
            <div className="field-group">
              <textarea rows={8} value={bulkText} onChange={e => setBulkText(e.target.value)}
                placeholder={'[{"chapterName":"Laws of Motion","topic":"Second law of motion","questionText":"A body of mass 2 kg accelerates at 5 m/s^2. What is the net force acting on it?","optionA":"5 N","optionB":"10 N","optionC":"15 N","optionD":"20 N","correctAnswer":"B","explanation":"F = ma = 2 x 5 = 10 N","difficulty":"Moderate","estimatedTime":60}]'} />
            </div>
            <button className="btn btn-primary" disabled={bulkBusy}>{bulkBusy ? 'Importing…' : 'Import'}</button>
          </form>
        </div>

        <div className="card mt-1">
          <h3>Submit a question</h3>
          <p className="helper-text">New questions go to the admin approval queue before they appear in tests.</p>
          <form onSubmit={handleSubmit}>
            <div className="grid-2">
              <div className="field-group">
                <label className="field-label">Subject</label>
                <select value={sectionId} onChange={e => { setSectionId(e.target.value); setChapterId(''); }}>
                  <option value="">— Select —</option>
                  {sections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div className="field-group">
                <label className="field-label">Chapter</label>
                <select value={chapterId} onChange={e => setChapterId(e.target.value)} disabled={!sectionId}>
                  <option value="">— Select —</option>
                  {chapters.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            </div>
            <div className="field-group">
              <label className="field-label">Question</label>
              <textarea rows={3} value={questionText} onChange={e => setQuestionText(e.target.value)} />
            </div>
            <div className="grid-2">
              {['A', 'B', 'C', 'D'].map(opt => (
                <div className="field-group" key={opt}>
                  <label className="field-label">Option {opt}</label>
                  <input className="field" value={options[opt]} onChange={e => setOptions(o => ({ ...o, [opt]: e.target.value }))} />
                </div>
              ))}
            </div>
            <div className="grid-2">
              <div className="field-group">
                <label className="field-label">Correct answer</label>
                <select value={correctAnswer} onChange={e => setCorrectAnswer(e.target.value)}>
                  <option value="A">A</option><option value="B">B</option><option value="C">C</option><option value="D">D</option>
                </select>
              </div>
              <div className="field-group">
                <label className="field-label">Difficulty</label>
                <select value={difficulty} onChange={e => setDifficulty(e.target.value)}>
                  <option value="Easy">Easy</option><option value="Moderate">Moderate</option><option value="Difficult">Difficult</option>
                </select>
              </div>
            </div>
            <div className="field-group">
              <label className="field-label">Explanation (optional)</label>
              <textarea rows={2} value={explanation} onChange={e => setExplanation(e.target.value)} />
            </div>
            <button className="btn btn-primary" disabled={busy}>{busy ? 'Submitting…' : 'Submit question'}</button>
          </form>
        </div>

        <div className="card mt-1">
          <div className="flex-between">
            <h3>Your questions</h3>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ maxWidth: 180 }}>
              <option value="">All statuses</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
          {mine.length === 0 && <p className="helper-text">No questions yet.</p>}
          {mine.map(q => (
            <div key={q.id} className="chapter-row">
              <span>
                <strong>{q.question_text}</strong><br />
                <span className="helper-text">{q.section_name} · {q.chapter_name} · {q.difficulty}</span>
              </span>
              <span>
                <span className={`chip ${q.status === 'approved' ? 'chip-mbbs' : 'chip-reference'}`}>{q.status}</span>
                {q.status !== 'approved' && <button className="btn btn-danger btn-sm" style={{ marginLeft: '0.4rem' }} onClick={() => handleDelete(q.id)}>Delete</button>}
              </span>
            </div>
          ))}
        </div>
      </>
    );
  }

  function GrandTestsPanel() {
    const { showToast } = useToast();
    const [tests, setTests] = useState([]);
    const [title, setTitle] = useState('');
    const [timeLimitMin, setTimeLimitMin] = useState(60);
    const [busy, setBusy] = useState(false);
    const [editing, setEditing] = useState(null);

    useEffect(() => { loadTests(); }, []);
    function loadTests() { api('/api/faculty/tests').then(setTests).catch(() => {}); }

    async function handleCreate(e) {
      e.preventDefault();
      if (!title.trim()) { showToast('Title is required.', 'error'); return; }
      setBusy(true);
      try {
        const { test } = await api('/api/faculty/tests', { method: 'POST', body: JSON.stringify({ title, timeLimitMin }) });
        showToast('Draft created — add questions below.');
        setTitle(''); loadTests(); setEditing(test.id);
      } catch (err) { showToast(err.message, 'error'); } finally { setBusy(false); }
    }

    async function handleDeleteDraft(id) {
      if (!confirm('Delete this draft?')) return;
      try { await api(`/api/faculty/tests/${id}`, { method: 'DELETE' }); showToast('Deleted.'); loadTests(); if (editing === id) setEditing(null); }
      catch (err) { showToast(err.message, 'error'); }
    }

    return (
      <>
        <div className="card mt-1">
          <h3 className="icon-row"><IconQuiz />New grand test draft</h3>
          <form onSubmit={handleCreate}>
            <div className="grid-2">
              <div className="field-group">
                <label className="field-label">Title</label>
                <input className="field" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Mid-Term Grand Test" />
              </div>
              <div className="field-group">
                <label className="field-label">Time limit (minutes)</label>
                <input className="field" type="number" min={5} value={timeLimitMin} onChange={e => setTimeLimitMin(parseInt(e.target.value, 10) || 60)} />
              </div>
            </div>
            <button className="btn btn-primary" disabled={busy}>{busy ? 'Creating…' : 'Create draft'}</button>
          </form>
        </div>

        <div className="card mt-1">
          <h3>Your grand tests</h3>
          {tests.length === 0 && <p className="helper-text">No grand tests yet.</p>}
          {tests.map(t => (
            <div key={t.id} className="chapter-row" onClick={() => setEditing(editing === t.id ? null : t.id)}>
              <span>
                <strong>{t.title}</strong> <span className={`chip ${t.status === 'published' ? 'chip-mbbs' : 'chip-reference'}`}>{t.status}</span><br />
                <span className="helper-text">{t.question_count} questions · {t.time_limit_min} min</span>
              </span>
              {t.status === 'draft' && (
                <button className="btn btn-danger btn-sm" onClick={e => { e.stopPropagation(); handleDeleteDraft(t.id); }}>Delete</button>
              )}
            </div>
          ))}
        </div>

        {editing && <GrandTestEditor testId={editing} onPublished={() => { loadTests(); setEditing(null); }} />}
      </>
    );
  }

  function GrandTestEditor({ testId, onPublished }) {
    const { showToast } = useToast();
    const [data, setData] = useState(null);
    const [busy, setBusy] = useState(false);
    const [sections, setSections] = useState([]);
    const [chapterSectionId, setChapterSectionId] = useState('');
    const [chapters, setChapters] = useState([]);
    const [chapterId, setChapterId] = useState('');
    const [chapterCount, setChapterCount] = useState('');

    useEffect(() => { load(); api('/api/sections').then(setSections).catch(() => {}); }, [testId]);
    useEffect(() => {
      if (!chapterSectionId) { setChapters([]); return; }
      api(`/api/sections/${chapterSectionId}/chapters`).then(setChapters).catch(() => {});
    }, [chapterSectionId]);

    function load() { api(`/api/faculty/tests/${testId}/questions`).then(setData).catch(() => {}); }

    async function addQuestion(qId) {
      try { await api(`/api/faculty/tests/${testId}/questions`, { method: 'POST', body: JSON.stringify({ questionId: qId }) }); load(); }
      catch (err) { showToast(err.message, 'error'); }
    }
    async function removeQuestion(qId) {
      try { await api(`/api/faculty/tests/${testId}/questions/${qId}`, { method: 'DELETE' }); load(); }
      catch (err) { showToast(err.message, 'error'); }
    }
    async function addChapter(e) {
      e.preventDefault();
      if (!chapterId) { showToast('Pick a chapter first.', 'error'); return; }
      try {
        const result = await api(`/api/faculty/tests/${testId}/chapters`, {
          method: 'POST', body: JSON.stringify({ chapterId, questionCount: chapterCount ? parseInt(chapterCount, 10) : undefined })
        });
        showToast(`Added ${result.added} question(s) from that chapter.`);
        setChapterCount(''); load();
      } catch (err) { showToast(err.message, 'error'); }
    }
    async function publish() {
      setBusy(true);
      try { await api(`/api/faculty/tests/${testId}/publish`, { method: 'POST' }); showToast('Published — students can now take it.'); onPublished(); }
      catch (err) { showToast(err.message, 'error'); } finally { setBusy(false); }
    }

    if (!data) return <div className="card mt-1"><div className="spinner" /></div>;
    if (data.test.status === 'published') return (
      <div className="card mt-1"><p className="helper-text">This test is already published and can no longer be edited.</p></div>
    );

    return (
      <div className="card mt-1">
        <div className="flex-between">
          <h3>Editing: {data.test.title}</h3>
          <button className="btn btn-primary" disabled={busy || data.included.length === 0} onClick={publish}>Publish</button>
        </div>

        <div className="card mt-1">
          <h4>Add a whole chapter</h4>
          <p className="helper-text">Pick a chapter — leave "questions" blank to add every approved question in it, or set a number to pick that many at random.</p>
          <form onSubmit={addChapter} className="grid-3">
            <select value={chapterSectionId} onChange={e => { setChapterSectionId(e.target.value); setChapterId(''); }}>
              <option value="">— Subject —</option>
              {sections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <select value={chapterId} onChange={e => setChapterId(e.target.value)} disabled={!chapterSectionId}>
              <option value="">— Chapter —</option>
              {chapters.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <div className="flex-between" style={{ gap: '0.4rem' }}>
              <input className="field" type="number" min={1} placeholder="Questions (optional)" value={chapterCount} onChange={e => setChapterCount(e.target.value)} />
              <button className="btn btn-secondary btn-sm">Add</button>
            </div>
          </form>
        </div>

        <div className="grid-2 mt-1">
          <div>
            <h4>In this test ({data.included.length})</h4>
            {data.included.map(q => (
              <div key={q.id} className="chapter-row">
                <span><strong>{q.question_text}</strong><br /><span className="helper-text">{q.section_name} · {q.chapter_name}</span></span>
                <button className="btn btn-outline btn-sm" onClick={() => removeQuestion(q.id)}>Remove</button>
              </div>
            ))}
          </div>
          <div>
            <h4>Approved bank ({data.available.length})</h4>
            {data.available.map(q => (
              <div key={q.id} className="chapter-row">
                <span><strong>{q.question_text}</strong><br /><span className="helper-text">{q.section_name} · {q.chapter_name}</span></span>
                <button className="btn btn-secondary btn-sm" onClick={() => addQuestion(q.id)}>Add</button>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }
}