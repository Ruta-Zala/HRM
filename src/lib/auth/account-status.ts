import { headerToFormKey, isEmployeeStatusActive } from "@/lib/employee";
import type { SessionUser } from "@/types/auth";

import { resolveEmployeeRecordForSession } from "./employee-record";

/** Whether the employee row linked to this session is Active. */
export async function isSessionUserActive(user: SessionUser): Promise<boolean> {
  const record = await resolveEmployeeRecordForSession(user);
  if (!record) return false;

  const { headers, row } = record;
  const statusIndex = headers.findIndex((h) => headerToFormKey(h) === "status");

  if (statusIndex < 0) {
    return false;
  }

  const rawStatus = String(row[statusIndex] ?? "");
  return isEmployeeStatusActive(rawStatus);
}
