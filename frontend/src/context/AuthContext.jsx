import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api } from '../api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null); // { email, role, name, onboarding_done, profile }
  const [impersonating, setImpersonating] = useState(false);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    const token = localStorage.getItem('cma_token');
    if (!token) { setCurrentUser(null); setLoading(false); return; }
    try {
      const data = await api('/api/me');
      setCurrentUser({ ...data.user, profile: data.profile });
      setImpersonating(!!data.impersonating);
    } catch {
      localStorage.removeItem('cma_token');
      setCurrentUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refreshUser(); }, [refreshUser]);

  function loginWithToken(token) {
    localStorage.setItem('cma_token', token);
    return refreshUser();
  }

  function logout() {
    localStorage.removeItem('cma_token');
    localStorage.removeItem('cma_admin_token');
    setCurrentUser(null);
    setImpersonating(false);
  }

  // Admin "View as": keep the admin's own token stashed separately so we
  // can restore it, and swap the active session token for the target
  // user's impersonation token.
  function startImpersonation(impersonationToken) {
    const adminToken = localStorage.getItem('cma_token');
    localStorage.setItem('cma_admin_token', adminToken);
    localStorage.setItem('cma_token', impersonationToken);
    return refreshUser();
  }

  function exitImpersonation() {
    const adminToken = localStorage.getItem('cma_admin_token');
    if (adminToken) {
      localStorage.setItem('cma_token', adminToken);
      localStorage.removeItem('cma_admin_token');
    }
    return refreshUser();
  }

  return (
    <AuthContext.Provider value={{ currentUser, loading, impersonating, loginWithToken, logout, startImpersonation, exitImpersonation, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
