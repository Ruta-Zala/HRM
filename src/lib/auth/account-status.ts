import { headerToFormKey, isEmployeeStatusActive } from "@/lib/employee";
import type { SessionUser } from "@/types/auth";

import { resolveEmployeeRecordForSession } from "./employee-record";

export type SessionAccountActivity = "active" | "inactive" | "unknown";

/**
 * Resolve account activity with a fail-open `unknown` state for transient
 * Sheets/network issues. This prevents accidental logout during brief outages.
 */
export async function getSessionUserActivity(user: SessionUser): Promise<SessionAccountActivity> {
  try {
    const record = await resolveEmployeeRecordForSession(user);
    if (!record) return "unknown";

    const { headers, row } = record;
    const statusIndex = headers.findIndex((h) => headerToFormKey(h) === "status");
    if (statusIndex < 0) return "unknown";

    const rawStatus = String(row[statusIndex] ?? "");
    return isEmployeeStatusActive(rawStatus) ? "active" : "inactive";
  } catch (error) {
    console.warn("[auth/account-status] status check failed, using unknown:", error);
    return "unknown";
  }
}

/** Whether the employee row linked to this session is Active. */
export async function isSessionUserActive(user: SessionUser): Promise<boolean> {
  const activity = await getSessionUserActivity(user);
  return activity !== "inactive";
}
