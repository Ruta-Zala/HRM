import { getSheetHeaders, sheetRowToForm } from "@/lib/employee";
import { ensureRequiredEmployeeFormHeaders } from "@/lib/employee/form";
import { EMPLOYEE_SHEET_RANGE, readSheet } from "@/lib/google/sheets";
import type { SessionUser } from "@/types/auth";

import type { EmployeeRowRecord } from "./firestore";

function withRequiredHeaders(raw: string[][]): { headers: string[]; rows: string[][] } {
  const headers = ensureRequiredEmployeeFormHeaders(getSheetHeaders(raw));
  return { headers, rows: raw };
}

function alignRow(row: string[] | undefined, headers: string[]): string[] {
  return headers.map((_, index) => String(row?.[index] ?? ""));
}

export async function getEmployeeBySheetRowFromSheets(
  sheetRow: number,
): Promise<EmployeeRowRecord | null> {
  const raw = await readSheet(EMPLOYEE_SHEET_RANGE);
  if (sheetRow < 2 || sheetRow > raw.length) return null;
  const { headers } = withRequiredHeaders(raw);
  return {
    sheetRow,
    headers,
    row: alignRow(raw[sheetRow - 1], headers),
  };
}

export async function findEmployeeByLoginFromSheets(
  login: string,
): Promise<EmployeeRowRecord | null> {
  const loginNorm = login.trim().toLowerCase();
  if (!loginNorm) return null;

  const raw = await readSheet(EMPLOYEE_SHEET_RANGE);
  const { headers } = withRequiredHeaders(raw);

  for (let index = 1; index < raw.length; index++) {
    const row = alignRow(raw[index], headers);
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

export async function listAllEmployeeRowsFromSheets(): Promise<EmployeeRowRecord[]> {
  const raw = await readSheet(EMPLOYEE_SHEET_RANGE);
  if (raw.length < 2) return [];
  const { headers } = withRequiredHeaders(raw);
  const records: EmployeeRowRecord[] = [];

  for (let index = 1; index < raw.length; index++) {
    records.push({
      sheetRow: index + 1,
      headers,
      row: alignRow(raw[index], headers),
    });
  }

  return records;
}
