"use client";

import { getLangGraphPublicApiUrl } from "@/lib/langgraph/config";

export const SUPPORT_THREAD_STORAGE_KEY = "exhibyte-hrm:support-thread-id";

export function getStoredSupportThreadId(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(SUPPORT_THREAD_STORAGE_KEY);
}

export function storeSupportThreadId(threadId: string) {
  window.localStorage.setItem(SUPPORT_THREAD_STORAGE_KEY, threadId);
}

export function clearStoredSupportThreadId() {
  window.localStorage.removeItem(SUPPORT_THREAD_STORAGE_KEY);
}

export async function deleteSupportThread(threadId: string) {
  await fetch(`${getLangGraphPublicApiUrl()}/threads/${encodeURIComponent(threadId)}`, {
    method: "DELETE",
  });
}

export async function clearSupportChatHistory() {
  const threadId = getStoredSupportThreadId();

  try {
    if (threadId) {
      await deleteSupportThread(threadId);
    }
  } catch (error) {
    console.error("Unable to delete support chat thread:", error);
  } finally {
    clearStoredSupportThreadId();
  }
}
