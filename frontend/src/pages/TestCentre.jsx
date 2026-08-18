import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../api.js';
import { useToast } from '../context/ToastContext.jsx';
import { IconQuiz, IconChart, IconClock } from '../components/Icons.jsx';

export default function TestCentre() {
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [sections, setSections] = useState([]);
  const [sectionId, setSectionId] = useState('');
  const [chapters, setChapters] = useState([]);
  const [chapterId, setChapterId] = useState('');
  const [busy, setBusy] = useState(false);

  const [grand, setGrand] = useState(null);
  const [history, setHistory] = useState([]);

  useEffect(() => {
    api('/api/sections').then(setSections).catch(() => {});
    api('/api/tests/grand').then(setGrand).catch(() => {});
    loadHistory();
  }, []);

  useEffect(() => {
    if (!sectionId) { setChapters([]); setChapterId(''); return; }
    api(`/api/sections/${sectionId}/chapters`).then(setChapters).catch(() => {});
  }, [sectionId]);

  function loadHistory() {
    api('/api/tests/history').then(setHistory).catch(() => {});
  }

  async function startChapterTest() {
    if (!chapterId) { showToast('Pick a chapter first.', 'error'); return; }
    setBusy(true);
    try {
      const { test } = await api('/api/tests/chapter', { method: 'POST', body: JSON.stringify({ chapterId }) });
      navigate(`/tests/${test.id}/take`);
    } catch (err) { showToast(err.message, 'error'); } finally { setBusy(false); }
  }

  async function startSubjectTest() {
    if (!sectionId) { showToast('Pick a subject first.', 'error'); return; }
    setBusy(true);
    try {
      const { test } = await api('/api/tests/subject', { method: 'POST', body: JSON.stringify({ sectionId }) });
      navigate(`/tests/${test.id}/take`);
    } catch (err) { showToast(err.message, 'error'); } finally { setBusy(false); }
  }

  function startGrandTest() {
    if (!grand?.test) return;
    if (grand.alreadyAttempted) { navigate(`/tests/attempts/${grand.attempt.id}`); return; }
    navigate(`/tests/${grand.test.id}/take`);
  }

  return (
    <div className="page">
      <div className="flex-between">
        <h2 className="icon-row"><IconQuiz />Test Centre</h2>
        <Link className="btn btn-outline btn-sm icon-row" to="/progress"><IconChart />Progress</Link>
      </div>

      <div className="grid-2">
        <div className="card">
          <h3>Chapter test</h3>
          <p className="helper-text">A focused practice test on one chapter.</p>
          <div className="field-group">
            <label className="field-label" htmlFor="tcSection">Subject</label>
            <select id="tcSection" value={sectionId} onChange={e => setSectionId(e.target.value)}>
              <option value="">— Select —</option>
              {sections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div className="field-group">
            <label className="field-label" htmlFor="tcChapter">Chapter</label>
            <select id="tcChapter" value={chapterId} onChange={e => setChapterId(e.target.value)} disabled={!sectionId}>
              <option value="">— Select —</option>
              {chapters.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <button className="btn btn-primary" disabled={busy || !chapterId} onClick={startChapterTest}>Start chapter test</button>
        </div>

        <div className="card">
          <h3>Subject test</h3>
          <p className="helper-text">A wider test drawing from every chapter in the subject.</p>
          <div className="field-group">
            <label className="field-label" htmlFor="tcSubjSection">Subject</label>
            <select id="tcSubjSection" value={sectionId} onChange={e => setSectionId(e.target.value)}>
              <option value="">— Select —</option>
              {sections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <p className="helper-text mt-1">Time limit: 45 min · up to 30 questions</p>
          <button className="btn btn-secondary mt-1" disabled={busy || !sectionId} onClick={startSubjectTest}>Start subject test</button>
        </div>
      </div>

      <div className="card mt-1">
        <h3>Grand test</h3>
        {!grand?.test && <p className="helper-text">No grand test has been published yet — check back once faculty publish one.</p>}
        {grand?.test && (
          <div className="flex-between">
            <span>
              <strong>{grand.test.title}</strong><br />
              <span className="helper-text icon-row"><IconClock />{grand.test.time_limit_min} min · {grand.test.question_count} questions</span>
              {grand.alreadyAttempted && (
                <><br /><span className="chip chip-mbbs">Completed — {grand.attempt.score}/{grand.attempt.total}</span></>
              )}
            </span>
            <button className="btn btn-primary" onClick={startGrandTest}>
              {grand.alreadyAttempted ? 'View result' : 'Start grand test'}
            </button>
          </div>
        )}
      </div>

      <div className="card mt-1">
        <h3>Your recent attempts</h3>
        {history.length === 0 && <p className="helper-text">No tests attempted yet.</p>}
        {history.map(h => (
          <div key={h.id} className="chapter-row" onClick={() => navigate(`/tests/attempts/${h.id}`)}>
            <span>
              <strong>{h.title}</strong> <span className="chip chip-reference">{h.test_type}</span><br />
              <span className="helper-text">{new Date(h.submitted_at).toLocaleString()}</span>
            </span>
            <span><strong>{h.score}/{h.total}</strong></span>
          </div>
        ))}
      </div>
    </div>
  );
}
