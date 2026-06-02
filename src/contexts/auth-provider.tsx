"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  clearSessionTabState,
  finalizePendingSessionLogout,
  SessionTabGuard,
} from "@/components/auth/session-tab-guard";
import {
  isAccountInactiveRedirectError,
  redirectToAccountInactive,
} from "@/lib/account-inactive-client";
import { clearSupportChatHistory } from "@/components/support/support-chat-history";
import { parseJsonResponse } from "@/lib/api/json-response";
import type { SessionUser } from "@/types/auth";

type AuthContextValue = {
  user: SessionUser | null;
  loading: boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

async function fetchSessionUser(): Promise<{
  user: SessionUser | null;
  inactive?: boolean;
}> {
  await finalizePendingSessionLogout();
  const res = await fetch("/api/auth/me", { credentials: "include" });
  const parsed = await parseJsonResponse<{
    user: SessionUser | null;
    inactive?: boolean;
  }>(res);
  if (parsed.data) return parsed.data;
  return { user: null };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const data = await fetchSessionUser();

      if (data.inactive) {
        setUser(null);
        setLoading(false);
        redirectToAccountInactive();
        return;
      }

      setUser(data.user ?? null);
      setLoading(false);
    } catch (error) {
      if (isAccountInactiveRedirectError(error)) return;
      setUser(null);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const data = await fetchSessionUser();
        if (cancelled) return;

        if (data.inactive) {
          setUser(null);
          setLoading(false);
          redirectToAccountInactive();
          return;
        }

        setUser(data.user ?? null);
        setLoading(false);
      } catch (error) {
        if (cancelled || isAccountInactiveRedirectError(error)) return;
        setUser(null);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const logout = useCallback(async () => {
    await clearSupportChatHistory();
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    clearSessionTabState();
    setUser(null);
    window.location.href = "/login";
  }, []);

  const value = useMemo(
    () => ({ user, loading, refresh, logout }),
    [user, loading, refresh, logout],
  );

  return (
    <AuthContext.Provider value={value}>
      <SessionTabGuard />
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
