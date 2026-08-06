import type { AttendanceEmployeeContext } from "@/lib/attendance/employee";
import { isFirebaseDailyStorage } from "@/lib/storage/backend";

import { firestoreAttendanceRepository } from "./firestore";
import { computeLiveWorkedMs, sheetsAttendanceRepository } from "./sheets";
import type { AttendanceRepository, AttendanceStorageRef } from "./types";

export type { AttendanceRepository, AttendanceStorageRef } from "./types";
export { computeLiveWorkedMs };

export function getAttendanceStorageBackend(): "firebase" | "sheets" {
  return isFirebaseDailyStorage() ? "firebase" : "sheets";
}

export function isAttendanceOnFirebase(): boolean {
  return isFirebaseDailyStorage();
}

export function getAttendanceRepository(): AttendanceRepository {
  return isAttendanceOnFirebase() ? firestoreAttendanceRepository : sheetsAttendanceRepository;
}

export function toAttendanceStorageRef(employee: AttendanceEmployeeContext): AttendanceStorageRef {
  return {
    employeeId: employee.employeeId,
    spreadsheetId: employee.attendanceSpreadsheetId,
  };
}

export function hasAttendanceStorage(employee: AttendanceEmployeeContext | null): boolean {
  if (!employee?.employeeId) return false;
  if (isAttendanceOnFirebase()) return true;
  return Boolean(employee.attendanceSpreadsheetId?.trim());
}
