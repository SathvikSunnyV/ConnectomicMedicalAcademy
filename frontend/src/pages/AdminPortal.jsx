import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { IconShield } from '../components/Icons.jsx';

export default function AdminPortal() {
  const [stats, setStats] = useState(null);
  const [tab, setTab] = useState('students');
  const [search, setSearch] = useState('');
  const [students, setStudents] = useState([]);
  const [faculty, setFaculty] = useState([]);
  const { startImpersonation } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  useEffect(() => { loadStats(); loadUsers(); }, []);
  useEffect(() => { loadUsers(); }, [search, tab]);

  function loadStats() {
    api('/api/admin/stats').then(setStats).catch(() => {});
  }

  function loadUsers() {
    const qs = search ? `?search=${encodeURIComponent(search)}` : '';
    if (tab === 'students') api(`/api/admin/students${qs}`).then(setStudents).catch(() => {});
    else api(`/api/admin/faculty${qs}`).then(setFaculty).catch(() => {});
  }

  async function handleDelete(id, label) {
    if (!confirm(`Delete ${label}? This cannot be undone.`)) return;
    try {
      await api(`/api/admin/users/${id}`, { method: 'DELETE' });
      showToast('User deleted.');
      loadUsers(); loadStats();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  async function handleImpersonate(id) {
    try {
      const data = await api(`/api/admin/impersonate/${id}`, { method: 'POST' });
      await startImpersonation(data.token);
      showToast(`Now viewing as ${data.name}.`);
      navigate(data.role === 'faculty' ? '/faculty' : '/sections');
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  const rows = tab === 'students' ? students : faculty;

  return (
    <div className="page">
      <h2 className="icon-row"><IconShield />Admin Portal</h2>

      {stats && (
        <div className="grid-3">
          <div className="card" style={{ textAlign: 'center' }}><h3>{stats.students}</h3><p className="helper-text">Students ({stats.verifiedStudents} verified)</p></div>
          <div className="card" style={{ textAlign: 'center' }}><h3>{stats.faculty}</h3><p className="helper-text">Faculty</p></div>
          <div className="card" style={{ textAlign: 'center' }}><h3>{stats.notes} / {stats.materials} / {stats.lectures}</h3><p className="helper-text">Notes / Materials / Lectures</p></div>
        </div>
      )}

      <div className="nav-links mt-1">
        <button className={`nav-btn ${tab === 'students' ? 'active' : ''}`} onClick={() => setTab('students')}>Students</button>
        <button className={`nav-btn ${tab === 'faculty' ? 'active' : ''}`} onClick={() => setTab('faculty')}>Faculty</button>
        <button className={`nav-btn ${tab === 'qbank' ? 'active' : ''}`} onClick={() => setTab('qbank')}>Question Bank</button>
      </div>

      {(tab === 'students' || tab === 'faculty') && (
        <div className="card mt-1">
          <div className="flex-between">
            <p className="helper-text">{rows.length} {tab}</p>
            <input className="field" style={{ maxWidth: 260 }} placeholder="Search by name, email or phone…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>

          <div className="mt-1">
            {rows.length === 0 && <p className="helper-text">No {tab} found.</p>}
            {rows.map(u => {
              const contact = [u.email, u.phone].filter(Boolean).join(' · ') || '—';
              const extra = tab === 'students' ? (u.phase ? ` · ${u.phase}` : '') : (u.specialization ? ` · ${u.specialization}` : '');
              return (
                <div key={u.id} className="chapter-row">
                  <span>
                    <strong>{u.name}</strong> {u.is_verified ? '' : <span className="chip chip-reference">unverified</span>}<br />
                    <span className="helper-text">{contact}{extra}</span>
                  </span>
                  <span>
                    <button className="btn btn-outline btn-sm" onClick={() => handleImpersonate(u.id)}>View as</button>
                    <button className="btn btn-danger btn-sm" style={{ marginLeft: '0.4rem' }} onClick={() => handleDelete(u.id, u.name)}>Delete</button>
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {tab === 'qbank' && <AdminQuestionBank />}
    </div>
  );
}

function AdminQuestionBank() {
  const { showToast } = useToast();
  const [stats, setStats] = useState(null);
  const [pending, setPending] = useState([]);
  const [sections, setSections] = useState([]);
  const [sectionFilter, setSectionFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [questions, setQuestions] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [bulkText, setBulkText] = useState('');
  const [bulkSectionId, setBulkSectionId] = useState('');
  const [bulkChapterId, setBulkChapterId] = useState('');
  const [bulkChapters, setBulkChapters] = useState([]);
  const [busy, setBusy] = useState(false);
  const limit = 20;

  useEffect(() => {
    api('/api/sections').then(setSections).catch(() => {});
    loadStats();
    loadPending();
  }, []);

  useEffect(() => { loadQuestions(); }, [sectionFilter, statusFilter, page]);

  useEffect(() => {
    if (!bulkSectionId) { setBulkChapters([]); return; }
    api(`/api/sections/${bulkSectionId}/chapters`).then(setBulkChapters).catch(() => {});
  }, [bulkSectionId]);

  function loadStats() { api('/api/qbank/stats').then(setStats).catch(() => {}); }
  function loadPending() { api('/api/qbank/pending').then(setPending).catch(() => {}); }
  function loadQuestions() {
    const params = new URLSearchParams();
    if (sectionFilter) params.set('sectionId', sectionFilter);
    if (statusFilter) params.set('status', statusFilter);
    params.set('page', page); params.set('limit', limit);
    api(`/api/qbank/questions?${params}`).then(d => { setQuestions(d.questions); setTotal(d.total); }).catch(() => {});
  }

  function refreshAll() { loadStats(); loadPending(); loadQuestions(); }

  async function approve(id, action) {
    try {
      await api(`/api/qbank/questions/${id}/approve`, { method: 'POST', body: JSON.stringify({ action }) });
      showToast(action === 'approve' ? 'Approved.' : 'Rejected.');
      refreshAll();
    } catch (err) { showToast(err.message, 'error'); }
  }

  async function deleteQuestion(id) {
    if (!confirm('Delete this question? This cannot be undone.')) return;
    try { await api(`/api/qbank/questions/${id}`, { method: 'DELETE' }); showToast('Deleted.'); refreshAll(); }
    catch (err) { showToast(err.message, 'error'); }
  }

  async function handleBulkImport(e) {
    e.preventDefault();
    let parsed;
    try { parsed = JSON.parse(bulkText); } catch { showToast('Not valid JSON — paste an array of question objects.', 'error'); return; }
    if (!Array.isArray(parsed) || parsed.length === 0) { showToast('Paste a JSON array of questions.', 'error'); return; }
    setBusy(true);
    try {
      const result = await api('/api/qbank/questions/bulk', {
        method: 'POST',
        body: JSON.stringify({ questions: parsed, sectionId: bulkSectionId || undefined, chapterId: bulkChapterId || undefined })
      });
      showToast(`Imported ${result.inserted} question(s)${result.errors.length ? `, ${result.errors.length} error(s)` : ''}.`);
      if (result.errors.length) console.warn('Bulk import errors:', result.errors);
      setBulkText('');
      refreshAll();
    } catch (err) { showToast(err.message, 'error'); } finally { setBusy(false); }
  }

  return (
    <>
      {stats && (
        <div className="grid-3 mt-1">
          <div className="card" style={{ textAlign: 'center' }}><h3>{stats.counts.approved}</h3><p className="helper-text">Approved</p></div>
          <div className="card" style={{ textAlign: 'center' }}><h3>{stats.counts.pending}</h3><p className="helper-text">Pending review</p></div>
          <div className="card" style={{ textAlign: 'center' }}><h3>{stats.counts.total}</h3><p className="helper-text">Total questions</p></div>
        </div>
      )}

      {pending.length > 0 && (
        <div className="card mt-1">
          <h3>Pending approval ({pending.length})</h3>
          {pending.map(q => (
            <div key={q.id} className="chapter-row">
              <span>
                <strong>{q.question_text}</strong><br />
                <span className="helper-text">{q.section_name} · {q.chapter_name} · by {q.submitted_by_name || 'unknown'}</span>
              </span>
              <span>
                <button className="btn btn-secondary btn-sm" onClick={() => approve(q.id, 'approve')}>Approve</button>
                <button className="btn btn-danger btn-sm" style={{ marginLeft: '0.4rem' }} onClick={() => approve(q.id, 'reject')}>Reject</button>
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="card mt-1">
        <h3>Bulk import (JSON)</h3>
        <p className="helper-text">Paste an array of questions — each needs questionText, optionA-D, correctAnswer (A-D); sectionId/chapterId are optional per-item if you set defaults below. Admin imports are auto-approved.</p>
        <form onSubmit={handleBulkImport}>
          <div className="grid-2">
            <div className="field-group">
              <label className="field-label">Default subject</label>
              <select value={bulkSectionId} onChange={e => { setBulkSectionId(e.target.value); setBulkChapterId(''); }}>
                <option value="">— None —</option>
                {sections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div className="field-group">
              <label className="field-label">Default chapter</label>
              <select value={bulkChapterId} onChange={e => setBulkChapterId(e.target.value)} disabled={!bulkSectionId}>
                <option value="">— None —</option>
                {bulkChapters.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>
          <div className="field-group">
            <textarea rows={6} value={bulkText} onChange={e => setBulkText(e.target.value)}
              placeholder='[{"questionText":"...","optionA":"...","optionB":"...","optionC":"...","optionD":"...","correctAnswer":"A"}]' />
          </div>
          <button className="btn btn-primary" disabled={busy}>{busy ? 'Importing…' : 'Import'}</button>
        </form>
      </div>

      <div className="card mt-1">
        <div className="flex-between">
          <h3>All questions ({total})</h3>
          <div className="grid-2" style={{ gap: '0.5rem' }}>
            <select value={sectionFilter} onChange={e => { setSectionFilter(e.target.value); setPage(1); }}>
              <option value="">All subjects</option>
              {sections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}>
              <option value="">All statuses</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
        </div>
        {questions.length === 0 && <p className="helper-text mt-1">No questions found.</p>}
        {questions.map(q => (
          <div key={q.id} className="chapter-row">
            <span>
              <strong>{q.question_text}</strong><br />
              <span className="helper-text">{q.section_name} · {q.chapter_name} · {q.difficulty} · used {q.usage_count}×</span>
            </span>
            <span>
              <span className={`chip ${q.status === 'approved' ? 'chip-mbbs' : 'chip-reference'}`}>{q.status}</span>
              <button className="btn btn-danger btn-sm" style={{ marginLeft: '0.4rem' }} onClick={() => deleteQuestion(q.id)}>Delete</button>
            </span>
          </div>
        ))}
        {total > limit && (
          <div className="flex-between mt-1">
            <button className="btn btn-outline btn-sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Previous</button>
            <span className="helper-text">Page {page} of {Math.ceil(total / limit)}</span>
            <button className="btn btn-outline btn-sm" disabled={page >= Math.ceil(total / limit)} onClick={() => setPage(p => p + 1)}>Next</button>
          </div>
        )}
      </div>
    </>
  );
}
