"use client";

import { useEffect } from "react";

const OPEN_TABS_KEY = "exhibyte_open_tabs";
const TAB_ID_KEY = "exhibyte_tab_id";
const PENDING_LOGOUT_KEY = "exhibyte_pending_logout"; // localStorage — survives tab close
const HEARTBEAT_MS = 2000;
const STALE_MS = 8000;

function readOpenTabs(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(OPEN_TABS_KEY) ?? "{}") as Record<string, number>;
  } catch {
    return {};
  }
}

function writeOpenTabs(tabs: Record<string, number>) {
  localStorage.setItem(OPEN_TABS_KEY, JSON.stringify(tabs));
}

function pruneStaleTabs(tabs: Record<string, number>, now: number) {
  for (const [id, ts] of Object.entries(tabs)) {
    if (now - ts > STALE_MS) delete tabs[id];
  }
}

function getTabId(): string {
  let tabId = sessionStorage.getItem(TAB_ID_KEY);
  if (!tabId) {
    tabId = crypto.randomUUID();
    sessionStorage.setItem(TAB_ID_KEY, tabId);
  }
  return tabId;
}

function touchTab(tabId: string) {
  const now = Date.now();
  const tabs = readOpenTabs();
  pruneStaleTabs(tabs, now);
  tabs[tabId] = now;
  writeOpenTabs(tabs);
}

function unregisterTab(tabId: string) {
  const tabs = readOpenTabs();
  delete tabs[tabId];
  pruneStaleTabs(tabs, Date.now());
  writeOpenTabs(tabs);
  return tabs;
}

/** Ends session when the user closed all tabs and opened the app again. */
export async function finalizePendingSessionLogout(): Promise<void> {
  if (!localStorage.getItem(PENDING_LOGOUT_KEY)) return;
  localStorage.removeItem(PENDING_LOGOUT_KEY);

  const tabs = readOpenTabs();
  pruneStaleTabs(tabs, Date.now());
  if (Object.keys(tabs).length > 0) return;

  await fetch("/api/auth/logout", {
    method: "POST",
    credentials: "include",
  });
}

/** Clears tab-tracking keys after explicit sign-out. */
export function clearSessionTabState() {
  localStorage.removeItem(OPEN_TABS_KEY);
  localStorage.removeItem(PENDING_LOGOUT_KEY);
  sessionStorage.removeItem(TAB_ID_KEY);
}

/**
 * Ends the session when the last app tab closes. Refresh keeps the session
 * (pageshow cancels a pending logout). Reopening after close requires login.
 */
export function SessionTabGuard() {
  useEffect(() => {
    const tabId = getTabId();

    touchTab(tabId);
    const heartbeat = window.setInterval(() => touchTab(tabId), HEARTBEAT_MS);

    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) return;
      if (localStorage.getItem(PENDING_LOGOUT_KEY)) {
        localStorage.removeItem(PENDING_LOGOUT_KEY);
        touchTab(tabId);
      }
    };

    const onPageHide = () => {
      const remaining = unregisterTab(tabId);
      if (Object.keys(remaining).length > 0) return;
      localStorage.setItem(PENDING_LOGOUT_KEY, "1");
    };

    window.addEventListener("pageshow", onPageShow);
    window.addEventListener("pagehide", onPageHide);

    return () => {
      window.clearInterval(heartbeat);
      window.removeEventListener("pageshow", onPageShow);
      window.removeEventListener("pagehide", onPageHide);
    };
  }, []);

  return null;
}
