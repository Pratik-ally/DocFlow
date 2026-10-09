'use client';
import React, { createContext, useContext, useState, useEffect, useRef, useCallback, ReactNode } from 'react';
import { useSession, signIn as nextAuthSignIn, signOut as nextAuthSignOut } from 'next-auth/react';
import { User } from '@/types';
import { authApi } from '@/services/api';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string, rememberMe?: boolean) => Promise<User>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  bridgeError: string | null;
  retrySessionBridge: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * Bridges Auth.js session → Express JWT cookie so all existing backend
 * API calls continue to work without modification.
 */
async function bridgeSession(): Promise<void> {
  const response = await fetch('/api/auth/session-bridge', { method: 'POST', credentials: 'include' });
  if (!response.ok) {
    throw new Error(`Backend session bridge failed (${response.status})`);
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const { data: session, status, update } = useSession();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [bridged, setBridged] = useState(false);
  const [bridgeError, setBridgeError] = useState<string | null>(null);
  const [bridgeRetry, setBridgeRetry] = useState(0);
  const bridgePromise = useRef<Promise<void> | null>(null);

  const ensureSessionBridge = useCallback(() => {
    if (!bridgePromise.current) {
      bridgePromise.current = bridgeSession().finally(() => {
        bridgePromise.current = null;
      });
    }
    return bridgePromise.current;
  }, []);

  // When Auth.js session is authenticated, bridge it to the Express cookie
  useEffect(() => {
    if (status === 'loading') return;

    if (status === 'authenticated' && session?.user) {
      const sessionUser = session.user as {
        id?: string; name?: string | null; email?: string | null;
        image?: string | null; role?: string;
      };
      const mapped: User = {
        id: sessionUser.id ?? '',
        name: sessionUser.name ?? '',
        email: sessionUser.email ?? '',
        role: (sessionUser.role ?? 'PATIENT') as User['role'],
        isActive: true,
      };
      if (bridged) {
        setUser(mapped);
        setLoading(false);
        return;
      }

      let active = true;
      setLoading(true);
      ensureSessionBridge()
        .then(() => {
          if (!active) return;
          setUser(mapped);
          setBridgeError(null);
          setBridged(true);
          setLoading(false);
        })
        .catch((error: unknown) => {
          if (!active) return;
          console.error('Backend session bridge failed:', error);
          setUser(null);
          setBridgeError('Could not connect your secure session to the backend.');
          setLoading(false);
        });
      return () => {
        active = false;
      };
    } else if (status === 'unauthenticated') {
      setUser(null);
      setBridged(false);
      setBridgeError(null);
      setLoading(false);
    }
  }, [status, session, bridged, bridgeRetry, ensureSessionBridge]);

  const retrySessionBridge = () => {
    setBridgeError(null);
    setLoading(true);
    setBridgeRetry((attempt) => attempt + 1);
  };

  const refreshUser = async () => {
    if (session?.user) {
      const su = session.user as { id?: string; name?: string | null; email?: string | null; role?: string };
      setUser({
        id: su.id ?? '',
        name: su.name ?? '',
        email: su.email ?? '',
        role: (su.role ?? 'PATIENT') as User['role'],
        isActive: true,
      });
    } else {
      try {
        const res = await authApi.me();
        setUser(res.data.user ?? null);
      } catch {
        setUser(null);
      }
    }
  };

  // Establish the Auth.js session first so middleware accepts protected pages.
  // Returns the user object so callers can route immediately without waiting for state.
  const login = async (email: string, password: string, _rememberMe = false): Promise<User> => {
    const result = await nextAuthSignIn('credentials', { email, password, redirect: false });
    if (!result || result.error) {
      throw new Error('Invalid email or password');
    }

    const refreshedSession = await update();
    const sessionUser = refreshedSession?.user as {
      id?: string; name?: string | null; email?: string | null; role?: string;
    } | undefined;
    if (!sessionUser?.id || !sessionUser.email) {
      throw new Error('Could not load the signed-in user session');
    }

    const u: User = {
      id: sessionUser.id,
      name: sessionUser.name ?? '',
      email: sessionUser.email,
      role: (sessionUser.role ?? 'PATIENT') as User['role'],
      isActive: true,
    };
    await ensureSessionBridge();
    setUser(u);
    setBridgeError(null);
    setBridged(true);
    setLoading(false);
    return u;
  };

  const logout = async () => {
    await authApi.logout().catch(() => {});
    await nextAuthSignOut({ redirect: false });
    setUser(null);
    setBridged(false);
    setBridgeError(null);
    window.location.href = '/login';
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refreshUser, bridgeError, retrySessionBridge }}>
      {bridgeError && (
        <div
          role="alert"
          className="fixed inset-x-0 top-0 z-[100] flex items-center justify-center gap-3 bg-red-700 px-4 py-3 text-sm text-white shadow-lg"
        >
          <span>{bridgeError} Please retry or sign in again.</span>
          <button
            type="button"
            className="rounded border border-white/60 px-3 py-1 font-semibold hover:bg-white/10"
            onClick={retrySessionBridge}
          >
            Retry
          </button>
        </div>
      )}
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
