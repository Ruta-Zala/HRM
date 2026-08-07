import type { AttendanceEmployeeContext } from "@/lib/attendance/employee";
import type { LeaveBucketType } from "@/lib/attendance/leave-bucket-layout";
import { isFirebaseDailyStorage } from "@/lib/storage/backend";

import { firestoreLeaveBucketRepository } from "./firestore";
import { sheetsLeaveBucketRepository } from "./sheets";
import type { LeaveBucketRepository, LeaveBucketStorageRef } from "./types";

export type { LeaveBucketRepository, LeaveBucketStorageRef } from "./types";

export function isLeaveBucketOnFirebase(): boolean {
  return isFirebaseDailyStorage();
}

export function getLeaveBucketRepository(): LeaveBucketRepository {
  return isLeaveBucketOnFirebase() ? firestoreLeaveBucketRepository : sheetsLeaveBucketRepository;
}

export function toLeaveBucketStorageRef(employee: {
  employeeId: string;
  attendanceSpreadsheetId?: string;
}): LeaveBucketStorageRef {
  return {
    employeeId: employee.employeeId,
    spreadsheetId: employee.attendanceSpreadsheetId,
  };
}

export function hasLeaveBucketStorage(
  employee: Pick<AttendanceEmployeeContext, "employeeId" | "attendanceSpreadsheetId"> | null,
): boolean {
  if (!employee?.employeeId?.trim()) return false;
  if (isLeaveBucketOnFirebase()) return true;
  return Boolean(employee.attendanceSpreadsheetId?.trim());
}

export async function readLeaveBucketRows(ref: LeaveBucketStorageRef): Promise<string[][]> {
  return getLeaveBucketRepository().readRows(ref);
}

export async function addGroupedLeaveDatesToBucket(
  ref: LeaveBucketStorageRef,
  groups: Array<{ leaveType: LeaveBucketType; dates: Date[] }>,
  duration: "full" | "half_am" | "half_pm" = "full",
  reason = "",
): Promise<void> {
  await getLeaveBucketRepository().addGroupedLeaveDates(ref, groups, duration, reason);
}

export async function importLeaveBucketCsv(
  ref: LeaveBucketStorageRef,
  content: string,
): Promise<void> {
  await getLeaveBucketRepository().importCsv(ref, content);
}

export async function saveLeaveBucketRows(
  ref: LeaveBucketStorageRef,
  rows: string[][],
): Promise<void> {
  await getLeaveBucketRepository().saveRows(ref, rows);
}
