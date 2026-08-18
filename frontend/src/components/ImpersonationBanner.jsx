import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function ImpersonationBanner() {
  const { impersonating, currentUser, exitImpersonation } = useAuth();
  const navigate = useNavigate();
  if (!impersonating) return null;

  async function handleExit() {
    await exitImpersonation();
    navigate('/admin');
  }

  return (
    <div className="impersonation-banner">
      Viewing as {currentUser?.name} ({currentUser?.role}) — Admin impersonation mode
      <button className="btn btn-sm btn-outline" onClick={handleExit}>Exit</button>
    </div>
  );
}
