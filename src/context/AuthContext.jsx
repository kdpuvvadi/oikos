import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  getCurrentUser,
  login as apiLogin,
  register as apiRegister,
  logout as apiLogout,
  updateProfile,
  setUnauthorizedHandler,
  pb
} from '../lib/api';
import { isApprovedUser } from '../lib/transactions';

const authHintCookieName = 'oikos_session';
const AuthContext = createContext(null);

function setSessionHint(enabled) {
  document.documentElement.classList.toggle('has-session', enabled);
  if (enabled) {
    document.cookie = `${authHintCookieName}=1; Path=/; SameSite=Lax`;
  } else {
    document.cookie = `${authHintCookieName}=; Path=/; Max-Age=0; SameSite=Lax`;
  }
}

export function AuthProvider({ children, onAuthCleared }) {
  const [user, setUserState] = useState(null);
  const [pendingVerificationEmail, setPendingVerificationEmail] = useState('');
  const [ready, setReady] = useState(false);

  const isAdmin = Boolean(user?.isAdmin || user?.kind === 'admin');
  const isApproved = isApprovedUser(user);

  const setUser = useCallback((nextUser) => {
    setUserState(nextUser);
    const approved = isApprovedUser(nextUser);
    const approvalPending = Boolean(nextUser?.verified && !approved);
    setSessionHint(approved);
    document.body.classList.toggle('is-authenticated', Boolean(nextUser));
    document.body.classList.toggle('is-admin', Boolean(nextUser?.isAdmin || nextUser?.kind === 'admin'));
    document.body.classList.toggle('approval-pending', approvalPending);
  }, []);

  const clearAuth = useCallback(() => {
    pb.authStore.clear();
    setUser(null);
    setPendingVerificationEmail('');
    onAuthCleared?.();
  }, [onAuthCleared, setUser]);

  useEffect(() => {
    setUnauthorizedHandler(() => clearAuth());
    return () => setUnauthorizedHandler(null);
  }, [clearAuth]);

  const refreshUser = useCallback(async () => {
    try {
      const data = await getCurrentUser();
      setPendingVerificationEmail('');
      setUser(data.user);
      return data.user;
    } catch {
      setUser(null);
      return null;
    }
  }, [setUser]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await refreshUser();
      if (!cancelled) setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshUser]);

  const login = useCallback(async (data) => {
    const result = await apiLogin(data);
    if (result.requiresVerification) return result;
    setPendingVerificationEmail('');
    setUser(result.user);
    onAuthCleared?.();
    return result;
  }, [onAuthCleared, setUser]);

  const register = useCallback(async (data) => {
    const result = await apiRegister(data);
    if (result.requiresVerification) return result;
    setPendingVerificationEmail('');
    setUser(result.user);
    onAuthCleared?.();
    return result;
  }, [onAuthCleared, setUser]);

  const logout = useCallback(async () => {
    try {
      await apiLogout();
    } finally {
      clearAuth();
    }
  }, [clearAuth]);

  const saveProfile = useCallback(async (updates) => {
    const result = await updateProfile({
      emailVisibility: user?.emailVisibility !== false,
      transactionPageSize: user?.transactionPageSize || 25,
      ...updates
    });
    setUser(result.user);
    return result.user;
  }, [setUser, user?.emailVisibility, user?.transactionPageSize]);

  const value = useMemo(() => ({
    user,
    ready,
    isAdmin,
    isApproved,
    pendingVerificationEmail,
    setPendingVerificationEmail,
    setUser,
    refreshUser,
    login,
    register,
    logout,
    saveProfile
  }), [
    user,
    ready,
    isAdmin,
    isApproved,
    pendingVerificationEmail,
    setUser,
    refreshUser,
    login,
    register,
    logout,
    saveProfile
  ]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
