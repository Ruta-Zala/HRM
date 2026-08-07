import {
  getAttendanceSpreadsheetIdFromRow,
  resolveAttendanceEmployeeBySheetRow,
} from "@/lib/attendance/employee";
import { sheetRowToForm } from "@/lib/employee";
import { listAllEmployeeRows } from "@/lib/employees/repository";

export type LeaveReviewEmployee = {
  sheetRow: number;
  employeeId: string;
  employeeName: string;
  email: string;
  attendanceSpreadsheetId: string;
};

export async function findEmployeeByEmployeeId(
  employeeId: string,
): Promise<LeaveReviewEmployee | null> {
  const trimmed = employeeId.trim();
  if (!trimmed) return null;

  const records = await listAllEmployeeRows();
  for (const record of records) {
    const form = sheetRowToForm(record.headers, record.row);
    if (form.employeeId.trim() !== trimmed) continue;

    return {
      sheetRow: record.sheetRow,
      employeeId: form.employeeId.trim(),
      employeeName: form.name.trim() || "Employee",
      email: form.email.trim(),
      attendanceSpreadsheetId: getAttendanceSpreadsheetIdFromRow(record.headers, record.row),
    };
  }

  return null;
}

export async function findEmployeeByAttendanceSpreadsheetId(
  attendanceSpreadsheetId: string,
): Promise<LeaveReviewEmployee | null> {
  const trimmed = attendanceSpreadsheetId.trim();
  if (!trimmed) return null;

  const records = await listAllEmployeeRows();
  for (const record of records) {
    const spreadsheetId = getAttendanceSpreadsheetIdFromRow(record.headers, record.row);
    if (spreadsheetId !== trimmed) continue;

    const form = sheetRowToForm(record.headers, record.row);
    return {
      sheetRow: record.sheetRow,
      employeeId: form.employeeId.trim(),
      employeeName: form.name.trim() || "Employee",
      email: form.email.trim(),
      attendanceSpreadsheetId: spreadsheetId,
    };
  }

  return null;
}

export async function getEmployeeNotificationContext(sheetRow: number) {
  return resolveAttendanceEmployeeBySheetRow(sheetRow);
}

export async function getEmployeeEmailBySheetRow(sheetRow: number): Promise<string | null> {
  if (sheetRow < 2) return null;

  const records = await listAllEmployeeRows();
  const record = records.find((entry) => entry.sheetRow === sheetRow);
  if (!record) return null;

  const form = sheetRowToForm(record.headers, record.row);
  const email = form.email.trim();
  return email || null;
}
