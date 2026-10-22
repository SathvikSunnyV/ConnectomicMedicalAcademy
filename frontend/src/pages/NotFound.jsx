import React from 'react';
import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="page" style={{ textAlign: 'center' }}>
      <h2 className="mt-1">Page not found</h2>
      <p className="helper-text">The page you're looking for doesn't exist or may have moved.</p>
      <Link to="/" className="btn btn-primary mt-1">Back to home</Link>
    </div>
  );
}
