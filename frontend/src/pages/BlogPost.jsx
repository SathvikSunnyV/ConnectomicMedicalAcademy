import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';

export default function BlogPost() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { showToast } = useToast();

  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { load(); }, [id]);
  function load() {
    api(`/api/blogs/${id}`).then(p => { setPost(p); setTitle(p.title); setContent(p.content); }).catch(() => {}).finally(() => setLoading(false));
  }

  const isAuthor = currentUser && post && currentUser.id === post.author_id;
  const canDelete = isAuthor; // admin moderates from the Admin Portal instead of the student-facing view

  async function handleSave(e) {
    e.preventDefault();
    if (!title.trim() || !content.trim()) { showToast('Title and content are required.', 'error'); return; }
    setBusy(true);
    try {
      await api(`/api/blogs/${id}`, { method: 'PUT', body: JSON.stringify({ title, content }) });
      showToast('Post updated.');
      setEditing(false);
      load();
    } catch (err) { showToast(err.message, 'error'); } finally { setBusy(false); }
  }

  async function handleDelete() {
    if (!confirm('Delete this post? This cannot be undone.')) return;
    try {
      await api(`/api/blogs/${id}`, { method: 'DELETE' });
      showToast('Post deleted.');
      navigate('/blog');
    } catch (err) { showToast(err.message, 'error'); }
  }

  if (loading) return <div className="page"><div className="spinner" /></div>;
  if (!post) return <div className="page"><p className="helper-text">Post not found.</p></div>;

  return (
    <div className="page">
      <Link className="helper-text" to="/blog">← Back to Blog</Link>

      {editing ? (
        <div className="card mt-1">
          <form onSubmit={handleSave}>
            <div className="field-group">
              <label className="field-label">Title</label>
              <input className="field" value={title} onChange={e => setTitle(e.target.value)} />
            </div>
            <div className="field-group">
              <label className="field-label">Content</label>
              <textarea rows={10} value={content} onChange={e => setContent(e.target.value)} />
            </div>
            <button className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
            <button type="button" className="btn btn-outline" style={{ marginLeft: '0.5rem' }} onClick={() => setEditing(false)}>Cancel</button>
          </form>
        </div>
      ) : (
        <div className="card mt-1">
          <div className="flex-between">
            <h2>{post.title}</h2>
            <span>
              {isAuthor && <button className="btn btn-outline btn-sm" onClick={() => setEditing(true)}>Edit</button>}
              {canDelete && <button className="btn btn-danger btn-sm" style={{ marginLeft: '0.4rem' }} onClick={handleDelete}>Delete</button>}
            </span>
          </div>
          <p className="helper-text">
            {post.author_name} · {new Date(post.created_at).toLocaleString()}
            {post.updated_at !== post.created_at && ' (edited)'}
          </p>
          <p style={{ whiteSpace: 'pre-wrap' }}>{post.content}</p>
        </div>
      )}
    </div>
  );
}