"use client";

import { createContext, useCallback, useContext, useMemo, useSyncExternalStore } from "react";
import { api, readTokens, writeTokens } from "./api";
import type { AuthTokens, User } from "./types";

interface AuthContextValue {
  user: User | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

let cachedRaw: string | null = null;
let cachedTokens: AuthTokens | null = null;

function subscribe(onChange: () => void) {
  window.addEventListener("meteoroid:auth", onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener("meteoroid:auth", onChange);
    window.removeEventListener("storage", onChange);
  };
}

function snapshot(): AuthTokens | null {
  const tokens = readTokens();
  const raw = tokens ? JSON.stringify(tokens) : null;
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedTokens = tokens;
  }
  return cachedTokens;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const tokens = useSyncExternalStore(subscribe, snapshot, () => null);

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.login(email, password);
    writeTokens({
      accessToken: res.accessToken,
      refreshToken: res.refreshToken,
      expiresIn: res.expiresIn,
      expiresAt: Date.now() + res.expiresIn * 1000,
      user: res.user,
    });
  }, []);

  const logout = useCallback(async () => {
    await api.logout().catch(() => undefined);
    writeTokens(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ user: tokens?.user ?? null, isAuthenticated: !!tokens?.accessToken, login, logout }),
    [tokens, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
