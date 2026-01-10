import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

type User = {
  username?: string;
  [key: string]: unknown;
} | null;

type AuthContextType = {
  user: User;
  token: string | null;
  login: (token: string) => void;
  logout: () => void;
  isAuthenticated: boolean;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function decodeUserFromJwt(token: string): User {
  try {
    const base64 = token.split('.')[1];
    if (!base64) return null;
    const json = atob(base64.replace(/-/g, '+').replace(/_/g, '/'));
    const payload = JSON.parse(json);
    // Common username fields: sub, username, email
    const username = payload.username || payload.sub || payload.email;
    return { username, ...payload };
  } catch {
    return null;
  }
}

export const AuthProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User>(null);

  useEffect(() => {
    const stored = localStorage.getItem('token');
    if (stored) {
      setToken(stored);
      setUser(decodeUserFromJwt(stored));
    }
  }, []);

  const login = (newToken: string) => {
    localStorage.setItem('token', newToken);
    setToken(newToken);
    setUser(decodeUserFromJwt(newToken));
  };

  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
  };

  const value = useMemo<AuthContextType>(
    () => ({ user, token, login, logout, isAuthenticated: !!token }),
    [user, token]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
