import { isFirebaseDailyStorage } from "@/lib/storage/backend";
import type { SessionUser } from "@/types/auth";

import {
  findEmployeeByLogin as findEmployeeByLoginFirestore,
  getEmployeeBySheetRow as getEmployeeBySheetRowFirestore,
  listAllEmployeeRows as listAllEmployeeRowsFirestore,
  updateEmployeeRow as updateEmployeeRowFirestore,
  type EmployeeRowRecord,
} from "./firestore";
import {
  findEmployeeByLoginFromSheets,
  getEmployeeBySheetRowFromSheets,
  listAllEmployeeRowsFromSheets,
  resolveEmployeeRecordForSessionFromSheets,
} from "./sheets";

export type { EmployeeRowRecord };

export async function getEmployeeBySheetRow(sheetRow: number): Promise<EmployeeRowRecord | null> {
  if (isFirebaseDailyStorage()) {
    return getEmployeeBySheetRowFirestore(sheetRow);
  }
  return getEmployeeBySheetRowFromSheets(sheetRow);
}

export async function findEmployeeByLogin(login: string): Promise<EmployeeRowRecord | null> {
  if (isFirebaseDailyStorage()) {
    return findEmployeeByLoginFirestore(login);
  }
  return findEmployeeByLoginFromSheets(login);
}

export async function resolveEmployeeRecordForSession(
  user: SessionUser,
): Promise<EmployeeRowRecord | null> {
  if (isFirebaseDailyStorage()) {
    if (user.sheetRow != null && user.sheetRow >= 2) {
      const byRow = await getEmployeeBySheetRowFirestore(user.sheetRow);
      if (byRow) return byRow;
    }
    return findEmployeeByLoginFirestore(user.email);
  }
  return resolveEmployeeRecordForSessionFromSheets(user);
}

export async function listAllEmployeeRows(): Promise<EmployeeRowRecord[]> {
  if (isFirebaseDailyStorage()) {
    return listAllEmployeeRowsFirestore();
  }
  return listAllEmployeeRowsFromSheets();
}

export async function updateEmployeeRow(sheetRow: number, row: string[]): Promise<void> {
  if (isFirebaseDailyStorage()) {
    await updateEmployeeRowFirestore(sheetRow, row);
    return;
  }
  const { sheetRowToRange } = await import("@/lib/employee");
  const { getSheetHeadersData, updateSheetRow } = await import("@/lib/google/sheets");
  const headers = await getSheetHeadersData();
  await updateSheetRow(sheetRowToRange(sheetRow, headers.length), [row]);
}
