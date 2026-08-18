import React from 'react';
import { IconClose } from './Icons.jsx';

export default function NoteModal({ note, onClose }) {
  if (!note) return null;

  function handleOverlayClick(e) {
    if (e.target === e.currentTarget) onClose();
  }

  return (
    <div className="modal-overlay modal-fullscreen" onClick={handleOverlayClick}>
      <div className="modal-panel">
        <button className="modal-close" onClick={onClose}><IconClose /></button>
        <h3 style={{ marginBottom: '0.75rem' }}>{note.title}</h3>
        <iframe
          className="note-iframe"
          srcDoc={note.html_content}
          sandbox="allow-scripts allow-same-origin"
          title={note.title}
        />
      </div>
    </div>
  );
}
