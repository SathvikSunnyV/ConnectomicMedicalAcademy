import React from 'react';
import { IconClose } from './Icons.jsx';
import { useEscapeToClose } from '../hooks/useEscapeToClose.js';

export default function NoteModal({ note, onClose }) {
  useEscapeToClose(onClose, !!note);
  if (!note) return null;

  function handleOverlayClick(e) {
    if (e.target === e.currentTarget) onClose();
  }

  return (
    <div className="modal-overlay modal-fullscreen" onClick={handleOverlayClick}>
      <div className="modal-panel">
        <button className="modal-close" onClick={onClose}><IconClose /><span className="sr-only">Close</span></button>
        <h3 style={{ marginBottom: '0.75rem' }}>{note.title}</h3>
        {/* SECURITY: sandbox="" (no allow-* flags) is deliberate. Chapter notes
            are faculty-authored HTML; the empty sandbox gives the frame an
            opaque origin and blocks scripts, forms, popups and top navigation.
            Do NOT add allow-scripts or allow-same-origin -- together they let
            the note escape the sandbox and read the student's session token.
            The server-side sanitiser and CSP are the other two layers. */}
        <iframe
          className="note-iframe"
          srcDoc={note.html_content}
          sandbox=""
          title={note.title}
        />
      </div>
    </div>
  );
}
