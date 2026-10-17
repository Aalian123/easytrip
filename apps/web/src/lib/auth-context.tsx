'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Role } from '@easytrip/shared';
import { API_URL, api, refreshAccessToken, setAccessToken } from './api';

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  riderId: string | null;
}

interface AuthState {
  user: SessionUser | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // A page reload has no token in memory, only the refresh cookie.
    let active = true;
    refreshAccessToken()
      .then(async (token) => {
        if (!active) return;
        if (!token) {
          setUser(null);
          return;
        }
        const me = await api<SessionUser>('/auth/me').catch(() => null);
        if (active) setUser(me);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const response = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.message ?? 'Email or password is incorrect');
    setAccessToken(payload.accessToken);
    setUser(payload.user);
  }, []);

  const signOut = useCallback(async () => {
    await fetch(`${API_URL}/auth/logout`, { method: 'POST', credentials: 'include' }).catch(() => undefined);
    setAccessToken(null);
    setUser(null);
    router.push('/login');
  }, [router]);

  const value = useMemo(() => ({ user, loading, signIn, signOut }), [user, loading, signIn, signOut]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}

/** Roles that may change data, as opposed to read it. */
export function canManageFleet(role: Role | undefined): boolean {
  return role === 'ADMIN' || role === 'FLEET_MANAGER';
}

/** Deleting removes history, so it belongs to administrators alone. */
export function canDelete(role: Role | undefined): boolean {
  return role === 'ADMIN';
}

export function canManageMoney(role: Role | undefined): boolean {
  return role === 'ADMIN' || role === 'ACCOUNTS';
}
