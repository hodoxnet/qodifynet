"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { getAccessToken, setAccessToken, clearAccessToken, login as apiLogin, logout as apiLogout, getMe } from "@/lib/api";

type User = {
  id: string;
  email: string;
  role: string;
  partnerId?: string;
  scopes?: string[];
  name?: string;
};

type AuthContextType = {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  hasScope: (s: string) => boolean;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const token = getAccessToken();
      if (!token) { setUser(null); setLoading(false); return; }
      const me = await getMe();
      if (me?.user) {
        const u: User = { ...me.user } as any;
        setUser(u);
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await apiLogin(email, password);
    if (res?.accessToken) setAccessToken(res.accessToken);
    await load();
  }, [load]);

  const logout = useCallback(async () => {
    await apiLogout();
    clearAccessToken();
    setUser(null);
  }, []);

  const hasScope = useCallback((s: string) => {
    if (!user) return false;
    if (user.role === "ADMIN" || user.role === "SUPER_ADMIN") return true;
    return !!user.scopes?.includes(s);
  }, [user]);

  const value = useMemo(() => ({ user, loading, login, logout, hasScope }), [user, loading, login, logout, hasScope]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

