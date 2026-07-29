import type { NextResponse } from "next/server";

import {
  getPendingAbsenceExplanationGroups,
  userRequiresAbsenceExplanation,
} from "@/lib/attendance/absence-explanation";
import {
  getCachedAbsenceGroups,
  invalidateAbsenceExplanationCache,
  setCachedAbsenceGroups,
} from "@/lib/attendance/absence-explanation-cache";
import { setAbsenceGateCookie } from "@/lib/attendance/absence-gate-cookie";
import { roleRequiresAbsenceExplanationGate } from "@/lib/attendance/absence-gate";
import { resolveAttendanceEmployee } from "@/lib/attendance/employee";
import type { SessionUser } from "@/types/auth";

export { invalidateAbsenceExplanationCache };

export async function getPendingAbsenceGroupsForUser(
  user: SessionUser,
  options?: { forceRefresh?: boolean },
) {
  if (!roleRequiresAbsenceExplanationGate(user.role)) {
    return [];
  }

  const employee = await resolveAttendanceEmployee(user);
  if (!employee?.attendanceSpreadsheetId) {
    return [];
  }

  if (!options?.forceRefresh) {
    const cached = getCachedAbsenceGroups(employee.employeeId);
    if (cached) return cached;
  }

  const groups = await getPendingAbsenceExplanationGroups(employee);
  setCachedAbsenceGroups(employee.employeeId, groups);
  return groups;
}

export async function syncAbsenceGateForUser(
  user: SessionUser,
  options?: { forceRefresh?: boolean },
): Promise<boolean> {
  const groups = await getPendingAbsenceGroupsForUser(user, options);
  return groups.length > 0;
}

export async function applyAbsenceGateCookie(
  res: NextResponse,
  user: SessionUser,
  options?: { forceRefresh?: boolean },
): Promise<boolean> {
  if (!roleRequiresAbsenceExplanationGate(user.role)) {
    setAbsenceGateCookie(res, false);
    return false;
  }

  const required = await syncAbsenceGateForUser(user, options);
  setAbsenceGateCookie(res, required);
  return required;
}

export async function checkAbsenceGateForUser(user: SessionUser): Promise<boolean> {
  if (!roleRequiresAbsenceExplanationGate(user.role)) {
    return false;
  }

  const employee = await resolveAttendanceEmployee(user);
  if (!employee?.attendanceSpreadsheetId) {
    return false;
  }

  const cached = getCachedAbsenceGroups(employee.employeeId);
  if (cached) {
    return cached.length > 0;
  }

  return userRequiresAbsenceExplanation(employee);
}
