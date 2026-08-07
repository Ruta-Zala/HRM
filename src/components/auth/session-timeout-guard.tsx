"use client";

import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  canExtendSession,
  formatSessionDuration,
  sessionExpiresAt,
  sessionMaxAgeMsForRole,
  sessionWarningMsForRole,
} from "@/lib/session";
import type { SessionUser } from "@/types/auth";

type SessionTimeoutGuardProps = {
  user: SessionUser | null;
  enabled: boolean;
  onLogout: () => Promise<void>;
  /** HR / Super Admin only — returns the renewed session user. */
  onContinue?: () => Promise<SessionUser | null>;
};

/**
 * Absolute session logout from login (or last Continue for admins).
 * Employee: Sign out only. HR / Super Admin: Continue + Sign out.
 */
export function SessionTimeoutGuard({
  user,
  enabled,
  onLogout,
  onContinue,
}: SessionTimeoutGuardProps) {
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [continuing, setContinuing] = useState(false);
  const loggingOutRef = useRef(false);
  const onLogoutRef = useRef(onLogout);

  useEffect(() => {
    onLogoutRef.current = onLogout;
  }, [onLogout]);

  useEffect(() => {
    if (!enabled || !user) {
      return;
    }

    const expiresAt = sessionExpiresAt(user);
    if (expiresAt == null) {
      loggingOutRef.current = true;
      void onLogoutRef.current();
      return;
    }

    loggingOutRef.current = false;
    const warningMs = sessionWarningMsForRole(user.role);

    const tick = () => {
      if (loggingOutRef.current) return;
      const remainingMs = expiresAt - Date.now();
      if (remainingMs <= 0) {
        loggingOutRef.current = true;
        void onLogoutRef.current();
        return;
      }
      if (remainingMs <= warningMs) {
        setSecondsLeft(Math.max(1, Math.ceil(remainingMs / 1000)));
      } else {
        setSecondsLeft(null);
      }
    };

    const initial = window.setTimeout(tick, 0);
    const id = window.setInterval(tick, 1000);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(id);
    };
  }, [enabled, user]);

  if (!enabled || !user || secondsLeft == null) return null;

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  const countdown =
    minutes > 0 ? `${minutes}:${seconds.toString().padStart(2, "0")}` : `${seconds}s`;
  const sessionLabel = formatSessionDuration(sessionMaxAgeMsForRole(user.role));
  const showContinue = canExtendSession(user.role) && Boolean(onContinue);

  async function handleContinue() {
    if (!onContinue || continuing) return;
    setContinuing(true);
    try {
      await onContinue();
      setSecondsLeft(null);
    } finally {
      setContinuing(false);
    }
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="border-ex-border bg-ex-elevated fixed right-4 bottom-4 z-100 max-w-sm rounded-xl border p-4 shadow-xl"
    >
      <p className="text-ex-text text-sm font-medium">Session ending soon</p>
      <p className="text-ex-muted mt-1 text-sm">
        You will be signed out in <span className="text-ex-text font-medium">{countdown}</span>.
        Sessions last {sessionLabel} from login
        {showContinue ? " (or last Continue)" : ""}. Any work already saved stays in the system.
      </p>
      <div className="mt-3 flex flex-wrap justify-end gap-2">
        {showContinue ? (
          <Button
            type="button"
            size="sm"
            disabled={continuing}
            onClick={() => void handleContinue()}
          >
            {continuing ? "Continuing…" : "Continue"}
          </Button>
        ) : null}
        <Button type="button" variant="outline" size="sm" onClick={() => void onLogout()}>
          Sign out now
        </Button>
      </div>
    </div>
  );
}
