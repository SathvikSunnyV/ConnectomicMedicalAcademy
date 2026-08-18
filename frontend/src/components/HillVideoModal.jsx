import React, { useRef } from 'react';
import { IconClose } from './Icons.jsx';

export default function HillVideoModal({ video, onClose }) {
  const videoRef = useRef(null);
  if (!video) return null;

  function handleOverlayClick(e) {
    if (e.target === e.currentTarget) onClose();
  }

  return (
    <div className="modal-overlay" onClick={handleOverlayClick}>
      <div className="modal-panel" style={{ maxWidth: 720 }}>
        <button className="modal-close" onClick={onClose}><IconClose /></button>
        <h3 style={{ marginBottom: '0.75rem' }}>{video.title}</h3>
        <video ref={videoRef} src={video.url} controls autoPlay style={{ width: '100%', borderRadius: 10, display: 'block', background: '#000' }} />
      </div>
    </div>
  );
}
