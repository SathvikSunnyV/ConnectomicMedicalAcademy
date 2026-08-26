import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { IconDocument } from '../components/Icons.jsx';

export default function BlogFeed() {
  const { currentUser } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { load(); }, []);
  function load() { api('/api/blogs').then(setPosts).catch(() => {}).finally(() => setLoading(false)); }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!title.trim() || !content.trim()) { showToast('Title and content are required.', 'error'); return; }
    setBusy(true);
    try {
      await api('/api/blogs', { method: 'POST', body: JSON.stringify({ title, content }) });
      showToast('Post published.');
      setTitle(''); setContent(''); setShowForm(false);
      load();
    } catch (err) { showToast(err.message, 'error'); } finally { setBusy(false); }
  }

  async function handleDelete(e, id) {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm('Delete this post? This cannot be undone.')) return;
    try {
      await api(`/api/blogs/${id}`, { method: 'DELETE' });
      showToast('Post deleted.');
      load();
    } catch (err) { showToast(err.message, 'error'); }
  }

  return (
    <div className="page">
      <div className="flex-between">
        <h2 className="icon-row"><IconDocument />Student Blog</h2>
        {currentUser?.role === 'student' && (
          <button className="btn btn-primary btn-sm" onClick={() => setShowForm(s => !s)}>
            {showForm ? 'Cancel' : 'Write a post'}
          </button>
        )}
      </div>

      {showForm && (
        <div className="card">
          <h3>New post</h3>
          <form onSubmit={handleSubmit}>
            <div className="field-group">
              <label className="field-label">Title</label>
              <input className="field" value={title} onChange={e => setTitle(e.target.value)} />
            </div>
            <div className="field-group">
              <label className="field-label">Content</label>
              <textarea rows={8} value={content} onChange={e => setContent(e.target.value)} placeholder="Write about anything — study tips, a tough case, a rant, whatever's on your mind." />
            </div>
            <button className="btn btn-primary" disabled={busy}>{busy ? 'Publishing…' : 'Publish'}</button>
          </form>
        </div>
      )}

      {loading && <div className="spinner" />}
      {!loading && posts.length === 0 && <p className="helper-text">No posts yet — be the first to write one.</p>}
      {posts.map(p => {
        const canDelete = currentUser?.id === p.author_id; // authors only here -- admin moderates from the Admin Portal instead
        return (
          <div key={p.id} className="card" style={{ marginTop: '1rem', cursor: 'pointer' }} onClick={() => navigate(`/blog/${p.id}`)}>
            <div className="flex-between">
              <h3 style={{ margin: 0 }}><Link to={`/blog/${p.id}`} onClick={e => e.stopPropagation()}>{p.title}</Link></h3>
              {canDelete && <button className="btn btn-danger btn-sm" onClick={e => handleDelete(e, p.id)}>Delete</button>}
            </div>
            <p className="helper-text" style={{ margin: 0 }}>{p.author_name} · {new Date(p.created_at).toLocaleDateString()}</p>
          </div>
        );
      })}
    </div>
  );
}