"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  clearSessionTabState,
  finalizePendingSessionLogout,
  SessionTabGuard,
} from "@/components/auth/session-tab-guard";
import { SessionTimeoutGuard } from "@/components/auth/session-timeout-guard";
import {
  isAccountInactiveRedirectError,
  redirectToAccountInactive,
} from "@/lib/account-inactive-client";
import { parseJsonResponse } from "@/lib/api/json-response";
import type { SessionUser } from "@/types/auth";

type AuthContextValue = {
  user: SessionUser | null;
  loading: boolean;
  refresh: () => Promise<void>;
  logout: (options?: { redirectTo?: string }) => Promise<void>;
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

  const logout = useCallback(async (options?: { redirectTo?: string }) => {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    clearSessionTabState();
    setUser(null);
    window.location.href = options?.redirectTo ?? "/login";
  }, []);

  const sessionTimeoutLogout = useCallback(async () => {
    await logout({ redirectTo: "/login" });
  }, [logout]);

  const extendSession = useCallback(async (): Promise<SessionUser | null> => {
    const res = await fetch("/api/auth/extend", {
      method: "POST",
      credentials: "include",
    });
    const parsed = await parseJsonResponse<{
      ok?: boolean;
      user?: SessionUser;
      inactive?: boolean;
    }>(res);

    if (parsed.data?.inactive) {
      setUser(null);
      redirectToAccountInactive();
      return null;
    }

    if (!res.ok || !parsed.data?.ok || !parsed.data.user) {
      return null;
    }

    setUser(parsed.data.user);
    return parsed.data.user;
  }, []);

  const value = useMemo(
    () => ({ user, loading, refresh, logout }),
    [user, loading, refresh, logout],
  );

  return (
    <AuthContext.Provider value={value}>
      <SessionTabGuard />
      <SessionTimeoutGuard
        user={user}
        enabled={Boolean(user) && !loading}
        onLogout={sessionTimeoutLogout}
        onContinue={extendSession}
      />
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
