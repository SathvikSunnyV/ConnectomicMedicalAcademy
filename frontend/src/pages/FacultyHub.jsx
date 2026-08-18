import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
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

  useEffect(() => { api('/api/sections').then(setSections).catch(() => {}); loadMine(); }, []);

  useEffect(() => {
    if (!sectionId) { setBooks([]); setChapters([]); return; }
    api(`/api/sections/${sectionId}/books`).then(setBooks).catch(() => {});
    api(`/api/sections/${sectionId}/chapters`).then(setChapters).catch(() => {});
  }, [sectionId]);

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

          <AddNoteForm bookId={bookId} chapterId={chapterId} onSaved={loadMine} />
          <AddMaterialForm bookId={bookId} chapterId={chapterId} onSaved={loadMine} />
          <AddLectureForm bookId={bookId} chapterId={chapterId} onSaved={loadMine} />

          <MyContentList title="Your notes" items={myNotes} onChanged={loadMine}
            renderMeta={n => `${n.section_name} · ${n.book_title} · ${n.chapter_name}`}
            onDelete={id => api(`/api/faculty/notes/${id}`, { method: 'DELETE' })}
          />
          <MyContentList title="Your materials" items={myMaterials} onChanged={loadMine}
            renderMeta={m => `${m.section_name} · ${m.book_title}${m.chapter_name ? ' · ' + m.chapter_name : ' · whole book'} · ${m.material_type}`}
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
    const [url, setUrl] = useState('');
    const [busy, setBusy] = useState(false);

    async function handleSubmit(e) {
      e.preventDefault();
      if (!bookId) { showToast('Select a section and book above first.', 'error'); return; }
      if (!title.trim() || !url.trim()) { showToast('Title and URL are required.', 'error'); return; }
      setBusy(true);
      try {
        await api('/api/faculty/materials', { method: 'POST', body: JSON.stringify({ bookId, chapterId: chapterId || null, title, materialType: type, externalUrl: url }) });
        showToast('Material saved.');
        setTitle(''); setUrl('');
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
              <label className="field-label">URL</label>
              <input className="field" value={url} onChange={e => setUrl(e.target.value)} />
            </div>
          </div>
          <p className="helper-text">Leave chapter as "whole book" above for a general resource, or pick a chapter for a chapter-specific one.</p>
          <button className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save material'}</button>
        </form>
      </div>
    );
  }

  function AddLectureForm({ bookId, chapterId, onSaved }) {
    const [title, setTitle] = useState('');
    const [url, setUrl] = useState('');
    const [busy, setBusy] = useState(false);

    async function handleSubmit(e) {
      e.preventDefault();
      if (!bookId) { showToast('Select a section and book above first.', 'error'); return; }
      if (!title.trim() || !url.trim()) { showToast('Title and URL are required.', 'error'); return; }
      setBusy(true);
      try {
        await api('/api/faculty/lectures', { method: 'POST', body: JSON.stringify({ bookId, chapterId: chapterId || null, title, url }) });
        showToast('Lecture saved.');
        setTitle(''); setUrl('');
        onSaved();
      } catch (err) {
        showToast(err.message, 'error');
      } finally { setBusy(false); }
    }

    return (
      <div className="card">
        <h3>Add a lecture video</h3>
        <form onSubmit={handleSubmit}>
          <div className="field-group">
            <label className="field-label">Title</label>
            <input className="field" value={title} onChange={e => setTitle(e.target.value)} />
          </div>
          <div className="field-group">
            <label className="field-label">Video URL</label>
            <input className="field" value={url} onChange={e => setUrl(e.target.value)} />
          </div>
          <button className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save lecture'}</button>
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

    return (
      <>
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

    useEffect(() => { load(); }, [testId]);
    function load() { api(`/api/faculty/tests/${testId}/questions`).then(setData).catch(() => {}); }

    async function addQuestion(qId) {
      try { await api(`/api/faculty/tests/${testId}/questions`, { method: 'POST', body: JSON.stringify({ questionId: qId }) }); load(); }
      catch (err) { showToast(err.message, 'error'); }
    }
    async function removeQuestion(qId) {
      try { await api(`/api/faculty/tests/${testId}/questions/${qId}`, { method: 'DELETE' }); load(); }
      catch (err) { showToast(err.message, 'error'); }
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
