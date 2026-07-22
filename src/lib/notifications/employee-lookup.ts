import {
  getAttendanceSpreadsheetIdFromRow,
  resolveAttendanceEmployeeBySheetRow,
} from "@/lib/attendance/employee";
import { getSheetHeaders, sheetRowToForm } from "@/lib/employee";
import { EMPLOYEE_SHEET_RANGE, readSheet } from "@/lib/google/sheets";

export async function findEmployeeByAttendanceSpreadsheetId(
  attendanceSpreadsheetId: string,
): Promise<{
  sheetRow: number;
  employeeId: string;
  employeeName: string;
  email: string;
} | null> {
  const trimmed = attendanceSpreadsheetId.trim();
  if (!trimmed) return null;

  const raw = await readSheet(EMPLOYEE_SHEET_RANGE);
  const headers = getSheetHeaders(raw);

  for (let i = 1; i < raw.length; i++) {
    const row = raw[i] ?? [];
    const spreadsheetId = getAttendanceSpreadsheetIdFromRow(headers, row);
    if (spreadsheetId !== trimmed) continue;

    const form = sheetRowToForm(headers, row);
    return {
      sheetRow: i + 1,
      employeeId: form.employeeId.trim(),
      employeeName: form.name.trim() || "Employee",
      email: form.email.trim(),
    };
  }

  return null;
}

export async function getEmployeeNotificationContext(sheetRow: number) {
  return resolveAttendanceEmployeeBySheetRow(sheetRow);
}

export async function getEmployeeEmailBySheetRow(sheetRow: number): Promise<string | null> {
  const raw = await readSheet(EMPLOYEE_SHEET_RANGE);
  if (sheetRow < 2 || sheetRow > raw.length) return null;

  const headers = getSheetHeaders(raw);
  const row = raw[sheetRow - 1] ?? [];
  const form = sheetRowToForm(headers, row);
  const email = form.email.trim();

  return email || null;
}
