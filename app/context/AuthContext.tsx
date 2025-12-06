'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

interface User {
  id: string;
  email: string;
  name: string;
  phone?: string;
  role: string;
  metadata?: Record<string, unknown>;
  user_metadata?: {
    name?: string;
    phone?: string;
    [key: string]: unknown;
  };
}

interface Session {
  access_token: string;
  refresh_token: string;
  expires_at: number;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isAuthenticated: boolean;
  token: string | null;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signup: (email: string, password: string, name: string, phone?: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  updateUser: (user: User) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const STORAGE_KEY = 'sphinx_fit_auth';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  // Computed values
  const isAuthenticated = !!user && !!session;
  const token = session?.access_token || null;

  // Load auth state from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const { user: storedUser, session: storedSession } = JSON.parse(stored);
        
        // Check if session is expired
        if (storedSession && storedSession.expires_at * 1000 > Date.now()) {
          setUser(storedUser);
          setSession(storedSession);
          
          // Verify session is still valid with server
          verifySession(storedSession.access_token);
        } else {
          // Session expired, clear storage
          localStorage.removeItem(STORAGE_KEY);
        }
      } catch {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
    setLoading(false);
  }, []);

  // Save auth state to localStorage when it changes
  useEffect(() => {
    if (user && session) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ user, session }));
    }
  }, [user, session]);

  const verifySession = async (token: string) => {
    try {
      const res = await fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
      } else {
        // Session invalid, clear auth state
        setUser(null);
        setSession(null);
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch (err) {
      console.error('Session verification failed:', err);
    }
  };

  const login = useCallback(async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const data = await res.json();

      if (!res.ok) {
        return { success: false, error: data.error || 'Login failed' };
      }

      setUser(data.user);
      setSession(data.session);
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ user: data.user, session: data.session }));

      return { success: true };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Connection error';
      return { success: false, error: msg };
    }
  }, []);

  const signup = useCallback(async (email: string, password: string, name: string, phone?: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name, phone })
      });

      const data = await res.json();

      if (!res.ok) {
        return { success: false, error: data.error || 'Signup failed' };
      }

      // If signup returns session directly, use it
      if (data.session && data.user) {
        setUser(data.user);
        setSession(data.session);
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ user: data.user, session: data.session }));
        return { success: true };
      }

      // If requiresLogin flag is set, user needs to login manually
      if (data.requiresLogin) {
        return login(email, password);
      }

      // Fallback: auto-login after signup
      return login(email, password);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Connection error';
      return { success: false, error: msg };
    }
  }, [login]);

  const logout = useCallback(async () => {
    try {
      if (session?.access_token) {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: { Authorization: `Bearer ${session.access_token}` }
        });
      }
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      setUser(null);
      setSession(null);
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [session]);

  const updateUser = useCallback((updatedUser: User) => {
    setUser(updatedUser);
  }, []);

  return (
    <AuthContext.Provider value={{ user, session, loading, isAuthenticated, token, login, signup, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// Helper hook to get auth headers for API calls
export function useAuthHeaders() {
  const { session } = useAuth();
  
  return {
    Authorization: session?.access_token ? `Bearer ${session.access_token}` : ''
  };
}
