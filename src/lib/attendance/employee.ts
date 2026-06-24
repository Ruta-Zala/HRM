import {
  getSheetHeaders,
  headerToFormKey,
  sheetRowToForm,
  sheetRowToRange,
  withSheetRowUpdatedAt,
} from "@/lib/employee";
import { resolveEmployeeRecordForSession } from "@/lib/auth/employee-record";
import { setAttendanceSpreadsheetIdOnRow } from "@/lib/attendance/spreadsheet-id";
import {
  findAttendanceSpreadsheetInFolder,
  getOrCreateEmployeeAttendanceSpreadsheet,
} from "@/lib/google/attendance-sheets";
import { createEmployeeFolderStructure, getParentFolderId } from "@/lib/google/drive";
import { getDrive } from "@/lib/google/drive-auth";
import {
  EMPLOYEE_SHEET_RANGE,
  getSheetHeadersData,
  readSheet,
  updateSheetRow,
} from "@/lib/google/sheets";
import { canManageEmployees } from "@/lib/auth/roles";
import type { SessionUser } from "@/types/auth";

export type AttendanceEmployeeContext = {
  employeeId: string;
  employeeName: string;
  attendanceSpreadsheetId: string;
  sheetRow: number;
  birthdayDate: string;
};

export function getAttendanceSpreadsheetIdFromRow(headers: string[], row: string[]): string {
  const directIndex = headers.findIndex((h) => headerToFormKey(h) === "attendanceSpreadsheetId");
  if (directIndex >= 0) {
    return String(row[directIndex] ?? "").trim();
  }

  const fallbackIndex = headers.findIndex((header) => {
    const key = header
      .trim()
      .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
      .replace(/\s+/g, "_")
      .toLowerCase();
    return key.includes("attendance") && key.includes("spreadsheet") && key.includes("id");
  });

  return fallbackIndex >= 0 ? String(row[fallbackIndex] ?? "").trim() : "";
}

async function isActiveSpreadsheet(spreadsheetId: string): Promise<boolean> {
  const trimmed = spreadsheetId.trim();
  if (!trimmed) return false;
  try {
    const drive = await getDrive();
    const file = await drive.files.get({
      fileId: trimmed,
      fields: "id,trashed",
      supportsAllDrives: true,
    });
    return Boolean(file.data.id) && file.data.trashed !== true;
  } catch {
    return false;
  }
}

export async function resolveAttendanceEmployee(
  user: SessionUser,
): Promise<AttendanceEmployeeContext | null> {
  const record = await resolveEmployeeRecordForSession(user);
  if (!record) return null;

  const form = sheetRowToForm(record.headers, record.row);
  const employeeId = form.employeeId.trim();
  const employeeName = form.name.trim() || user.name;
  let attendanceSpreadsheetId = getAttendanceSpreadsheetIdFromRow(record.headers, record.row);
  if (attendanceSpreadsheetId && !(await isActiveSpreadsheet(attendanceSpreadsheetId))) {
    attendanceSpreadsheetId = "";
  }

  const parentFolderId = await resolveEmployeeFolderId(form.documentsFolderId, {
    employeeId,
    employeeName,
  });

  if (!attendanceSpreadsheetId && parentFolderId) {
    attendanceSpreadsheetId =
      (await findAttendanceSpreadsheetInFolder(parentFolderId, employeeId, employeeName)) ?? "";
  }

  if (!attendanceSpreadsheetId) {
    if (!employeeId || !parentFolderId) return null;

    attendanceSpreadsheetId = await getOrCreateEmployeeAttendanceSpreadsheet(
      employeeId,
      employeeName,
      parentFolderId,
      form.birthdayDate,
    );
  }

  const persistedId = getAttendanceSpreadsheetIdFromRow(record.headers, record.row);
  if (persistedId !== attendanceSpreadsheetId) {
    const headers = await getSheetHeadersData();
    const updatedRow = withSheetRowUpdatedAt(
      record.headers,
      setAttendanceSpreadsheetIdOnRow(record.headers, record.row, attendanceSpreadsheetId),
    );

    await updateSheetRow(sheetRowToRange(record.sheetRow, headers.length), [updatedRow]);
  }

  return {
    employeeId,
    employeeName,
    attendanceSpreadsheetId,
    sheetRow: record.sheetRow,
    birthdayDate: form.birthdayDate.trim(),
  };
}

async function resolveEmployeeFolderId(
  documentsFolderId: string,
  employee: { employeeId: string; employeeName: string },
): Promise<string | null> {
  if (documentsFolderId.trim()) {
    const parent = await getParentFolderId(documentsFolderId.trim());
    if (parent) return parent;
  }

  if (!employee.employeeId.trim()) return null;

  const folders = await createEmployeeFolderStructure(employee.employeeId, employee.employeeName);
  return folders.employeeFolderId ?? null;
}

/** Resolve attendance context for the signed-in user or a target employee (HR only). */
export async function resolveAttendanceEmployeeForTarget(
  user: SessionUser,
  targetSheetRow?: number,
): Promise<AttendanceEmployeeContext | null> {
  if (targetSheetRow == null || targetSheetRow === user.sheetRow) {
    return resolveAttendanceEmployee(user);
  }

  if (!canManageEmployees(user.role)) {
    return resolveAttendanceEmployee(user);
  }

  const raw = await readSheet(EMPLOYEE_SHEET_RANGE);
  if (targetSheetRow < 2 || targetSheetRow > raw.length) return null;

  const headers = getSheetHeaders(raw);
  const row = raw[targetSheetRow - 1] ?? [];
  const form = sheetRowToForm(headers, row);
  const employeeId = form.employeeId.trim();
  const employeeName = form.name.trim() || "Employee";

  let attendanceSpreadsheetId = getAttendanceSpreadsheetIdFromRow(headers, row);
  if (attendanceSpreadsheetId && !(await isActiveSpreadsheet(attendanceSpreadsheetId))) {
    attendanceSpreadsheetId = "";
  }
  const parentFolderId = await resolveEmployeeFolderId(form.documentsFolderId, {
    employeeId,
    employeeName,
  });

  if (!attendanceSpreadsheetId && parentFolderId) {
    attendanceSpreadsheetId =
      (await findAttendanceSpreadsheetInFolder(parentFolderId, employeeId, employeeName)) ?? "";
  }

  if (!attendanceSpreadsheetId) {
    if (!employeeId || !parentFolderId) return null;
    attendanceSpreadsheetId = await getOrCreateEmployeeAttendanceSpreadsheet(
      employeeId,
      employeeName,
      parentFolderId,
      form.birthdayDate,
    );
  }

  const persistedId = getAttendanceSpreadsheetIdFromRow(headers, row);
  if (persistedId !== attendanceSpreadsheetId) {
    const sheetHeaders = await getSheetHeadersData();
    const updatedRow = withSheetRowUpdatedAt(
      headers,
      setAttendanceSpreadsheetIdOnRow(headers, row, attendanceSpreadsheetId),
    );
    await updateSheetRow(sheetRowToRange(targetSheetRow, sheetHeaders.length), [updatedRow]);
  }

  return {
    employeeId,
    employeeName,
    attendanceSpreadsheetId,
    sheetRow: targetSheetRow,
    birthdayDate: form.birthdayDate.trim(),
  };
}

export async function resolveAttendanceEmployeeBySheetRow(
  sheetRow: number,
): Promise<AttendanceEmployeeContext | null> {
  const raw = await readSheet(EMPLOYEE_SHEET_RANGE);
  if (sheetRow < 2 || sheetRow > raw.length) return null;

  const headers = raw[0] as string[];
  const row = raw[sheetRow - 1] ?? [];
  const form = sheetRowToForm(headers, row);

  return {
    employeeId: form.employeeId,
    employeeName: form.name.trim() || "Employee",
    attendanceSpreadsheetId: getAttendanceSpreadsheetIdFromRow(headers, row),
    sheetRow,
    birthdayDate: form.birthdayDate.trim(),
  };
}
