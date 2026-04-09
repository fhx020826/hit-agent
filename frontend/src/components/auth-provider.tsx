"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { api, TOKEN_KEY, type CurrentUser, type UserProfile } from "@/lib/api";

type RegisterPayload = {
  role: "teacher" | "student";
  account: string;
  password: string;
  confirm_password: string;
  profile: Omit<UserProfile, "updated_at">;
};

type LoginPayload = {
  role: "admin" | "teacher" | "student";
  account: string;
  password: string;
};

type AuthContextValue = {
  user: CurrentUser | null;
  loading: boolean;
  isAuthenticated: boolean;
  login: (payload: LoginPayload) => Promise<CurrentUser>;
  register: (payload: RegisterPayload) => Promise<CurrentUser>;
  refresh: () => Promise<CurrentUser | null>;
  logout: () => Promise<void>;
  updateUser: (user: CurrentUser) => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function persistToken(token: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(TOKEN_KEY, token);
}

function clearToken() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(TOKEN_KEY);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    if (typeof window === "undefined") {
      setLoading(false);
      return null;
    }
    const token = window.localStorage.getItem(TOKEN_KEY);
    if (!token) {
      setUser(null);
      setLoading(false);
      return null;
    }
    try {
      const current = await api.me();
      setUser(current);
      return current;
    } catch {
      clearToken();
      setUser(null);
      return null;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    loading,
    isAuthenticated: Boolean(user),
    login: async (payload) => {
      const result = await api.login(payload);
      persistToken(result.token);
      setUser(result.user);
      return result.user;
    },
    register: async (payload) => {
      const result = await api.register(payload);
      persistToken(result.token);
      setUser(result.user);
      return result.user;
    },
    refresh,
    logout: async () => {
      try {
        await api.logout();
      } catch {
        // ignore logout failures and clear local state
      } finally {
        clearToken();
        setUser(null);
      }
    },
    updateUser: (nextUser) => setUser(nextUser),
  }), [user, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth 必须在 AuthProvider 内使用");
  }
  return context;
}
