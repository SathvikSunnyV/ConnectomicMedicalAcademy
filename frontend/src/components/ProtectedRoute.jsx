import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function ProtectedRoute({ roles, children }) {
  const { currentUser, loading } = useAuth();
  if (loading) return <div className="spinner" />;
  if (!currentUser) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(currentUser.role)) return <Navigate to="/" replace />;
  if (currentUser.role === 'student' && !currentUser.onboarding_done && !roles?.includes('onboarding')) {
    return <Navigate to="/onboarding" replace />;
  }
  return children;
}
