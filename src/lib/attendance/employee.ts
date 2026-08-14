import {
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
import { getSheetHeadersData, updateSheetRow } from "@/lib/google/sheets";
import { ROLES } from "@/app/consts/common";
import { canManageEmployees } from "@/lib/auth/roles";
import { isAttendanceOnFirebase } from "@/lib/attendance/repository";
import { getEmployeeBySheetRow, type EmployeeRowRecord } from "@/lib/employees/repository";
import type { SessionUser } from "@/types/auth";

export type AttendanceEmployeeContext = {
  employeeId: string;
  employeeName: string;
  attendanceSpreadsheetId: string;
  sheetRow: number;
  birthdayDate: string;
  /** ISO timestamp or date when the employee record was created in HRM. */
  createdAt: string;
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

export async function isAttendanceSpreadsheetAccessible(spreadsheetId: string): Promise<boolean> {
  const trimmed = spreadsheetId.trim();
  if (!trimmed) return false;
  try {
    const drive = await getDrive();
    const file = await drive.files.get({
      fileId: trimmed,
      fields: "id,trashed",
      supportsAllDrives: true,
    });
    const fileData = file.data as { id?: string | null; trashed?: boolean | null };
    return Boolean(fileData.id) && fileData.trashed !== true;
  } catch {
    return false;
  }
}

async function buildAttendanceEmployeeContext(
  record: EmployeeRowRecord,
  options?: { nameFallback?: string; createIfMissing?: boolean; requireSpreadsheet?: boolean },
): Promise<AttendanceEmployeeContext | null> {
  const form = sheetRowToForm(record.headers, record.row);
  const employeeId = form.employeeId.trim();
  const employeeName = form.name.trim() || options?.nameFallback || "Employee";
  if (!employeeId) return null;

  if (isAttendanceOnFirebase()) {
    return {
      employeeId,
      employeeName,
      attendanceSpreadsheetId: getAttendanceSpreadsheetIdFromRow(record.headers, record.row),
      sheetRow: record.sheetRow,
      birthdayDate: form.birthdayDate.trim(),
      createdAt: form.createdAt.trim(),
    };
  }

  const attendanceSpreadsheetId = await resolveAttendanceSpreadsheetIdForRow({
    headers: record.headers,
    row: record.row,
    sheetRow: record.sheetRow,
    employeeId,
    employeeName,
    documentsFolderId: form.documentsFolderId,
    birthdayDate: form.birthdayDate,
    createIfMissing: options?.createIfMissing,
  });

  if (options?.requireSpreadsheet !== false && !attendanceSpreadsheetId) return null;

  return {
    employeeId,
    employeeName,
    attendanceSpreadsheetId,
    sheetRow: record.sheetRow,
    birthdayDate: form.birthdayDate.trim(),
    createdAt: form.createdAt.trim(),
  };
}

export async function resolveAttendanceEmployee(
  user: SessionUser,
): Promise<AttendanceEmployeeContext | null> {
  const record = await resolveEmployeeRecordForSession(user);
  if (!record) return null;
  return buildAttendanceEmployeeContext(record, {
    nameFallback: user.name,
    createIfMissing: true,
  });
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

  const record = await getEmployeeBySheetRow(targetSheetRow);
  if (!record) return null;

  const form = sheetRowToForm(record.headers, record.row);
  if (form.role.trim().toLowerCase() === ROLES.SUPER_ADMIN) {
    return null;
  }

  return buildAttendanceEmployeeContext(record, { createIfMissing: true });
}

export async function resolveAttendanceEmployeeBySheetRow(
  sheetRow: number,
): Promise<AttendanceEmployeeContext | null> {
  const record = await getEmployeeBySheetRow(sheetRow);
  if (!record) return null;
  return buildAttendanceEmployeeContext(record, {
    createIfMissing: false,
    requireSpreadsheet: false,
  });
}

/**
 * Resolve an employee's attendance spreadsheet the same way punch/manual APIs do:
 * stored ID → accessibility check → search employee folder → optional create.
 * Used by payroll so Attend Days is not stuck at 0 when the Employees sheet ID is blank/stale.
 */
export async function resolveAttendanceSpreadsheetIdForRow(params: {
  headers: string[];
  row: string[];
  sheetRow: number;
  employeeId: string;
  employeeName: string;
  documentsFolderId: string;
  birthdayDate?: string;
  /** When false (e.g. payroll reads), never create an empty attendance workbook. */
  createIfMissing?: boolean;
  /** Ignore the Employees-sheet ID and resolve from the employee Drive folder. */
  preferFolderSearch?: boolean;
}): Promise<string> {
  let attendanceSpreadsheetId = params.preferFolderSearch
    ? ""
    : getAttendanceSpreadsheetIdFromRow(params.headers, params.row);
  if (
    attendanceSpreadsheetId &&
    !(await isAttendanceSpreadsheetAccessible(attendanceSpreadsheetId))
  ) {
    attendanceSpreadsheetId = "";
  }

  const parentFolderId = await resolveEmployeeFolderId(params.documentsFolderId, {
    employeeId: params.employeeId,
    employeeName: params.employeeName,
  });

  if (!attendanceSpreadsheetId && parentFolderId) {
    attendanceSpreadsheetId =
      (await findAttendanceSpreadsheetInFolder(
        parentFolderId,
        params.employeeId,
        params.employeeName,
      )) ?? "";
  }

  if (!attendanceSpreadsheetId && params.createIfMissing !== false) {
    if (!params.employeeId || !parentFolderId) return "";
    attendanceSpreadsheetId = await getOrCreateEmployeeAttendanceSpreadsheet(
      params.employeeId,
      params.employeeName,
      parentFolderId,
      params.birthdayDate ?? "",
    );
  }

  if (!attendanceSpreadsheetId) return "";

  const persistedId = getAttendanceSpreadsheetIdFromRow(params.headers, params.row);
  if (persistedId !== attendanceSpreadsheetId) {
    const sheetHeaders = await getSheetHeadersData();
    const updatedRow = withSheetRowUpdatedAt(
      params.headers,
      setAttendanceSpreadsheetIdOnRow(params.headers, params.row, attendanceSpreadsheetId),
    );
    await updateSheetRow(sheetRowToRange(params.sheetRow, sheetHeaders.length), [updatedRow]);
  }

  return attendanceSpreadsheetId;
}
