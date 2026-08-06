import { getSheetHeaders } from "@/lib/employee";
import { EMPLOYEE_SHEET_RANGE, readSheet } from "@/lib/google/sheets";
import type { SessionUser } from "@/types/auth";

import type { EmployeeRowRecord } from "./firestore";

export async function getEmployeeBySheetRowFromSheets(
  sheetRow: number,
): Promise<EmployeeRowRecord | null> {
  const raw = await readSheet(EMPLOYEE_SHEET_RANGE);
  if (sheetRow < 2 || sheetRow > raw.length) return null;
  const headers = getSheetHeaders(raw);
  return {
    sheetRow,
    headers,
    row: raw[sheetRow - 1] ?? [],
  };
}

export async function findEmployeeByLoginFromSheets(
  login: string,
): Promise<EmployeeRowRecord | null> {
  const loginNorm = login.trim().toLowerCase();
  if (!loginNorm) return null;

  const raw = await readSheet(EMPLOYEE_SHEET_RANGE);
  const headers = getSheetHeaders(raw);
  const { sheetRowToForm } = await import("@/lib/employee");

  for (let index = 1; index < raw.length; index++) {
    const row = raw[index] ?? [];
    const form = sheetRowToForm(headers, row);
    const email = form.email.trim().toLowerCase();
    const username = form.username.trim().toLowerCase();
    if (email === loginNorm || (username && username === loginNorm)) {
      return { sheetRow: index + 1, headers, row };
    }
  }

  return null;
}

export async function resolveEmployeeRecordForSessionFromSheets(
  user: SessionUser,
): Promise<EmployeeRowRecord | null> {
  if (user.sheetRow != null && user.sheetRow >= 2) {
    const byRow = await getEmployeeBySheetRowFromSheets(user.sheetRow);
    if (byRow) return byRow;
  }

  return findEmployeeByLoginFromSheets(user.email);
}
