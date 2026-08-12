import { isFirebaseDailyStorage } from "@/lib/storage/backend";
import type { SessionUser } from "@/types/auth";

import {
  createEmployeeRowFirestore,
  deleteEmployeeRowFirestore,
  findEmployeeByLogin as findEmployeeByLoginFirestore,
  getEmployeeBySheetRow as getEmployeeBySheetRowFirestore,
  getEmployeeCountFirestore,
  getEmployeeHeadersFirestore,
  getExistingEmployeeIdsFirestore,
  listAllEmployeeRows as listAllEmployeeRowsFirestore,
  readEmployeeSheetDataFirestore,
  updateEmployeeRow as updateEmployeeRowFirestore,
} from "./firestore";
import type { EmployeeRowRecord } from "./firestore";
import {
  findEmployeeByLoginFromSheets,
  getEmployeeBySheetRowFromSheets,
  listAllEmployeeRowsFromSheets,
  resolveEmployeeRecordForSessionFromSheets,
} from "./sheets";

export type { EmployeeRowRecord } from "./firestore";

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

type SessionEmployeeCacheEntry = {
  record: EmployeeRowRecord | null;
  expiresAt: number;
};

const SESSION_EMPLOYEE_CACHE_TTL_MS = 30_000;
const sessionEmployeeCache = new Map<string, SessionEmployeeCacheEntry>();

function sessionEmployeeCacheKey(user: SessionUser): string {
  return `${user.sheetRow ?? 0}:${user.email.trim().toLowerCase()}`;
}

function readSessionEmployeeCache(user: SessionUser): EmployeeRowRecord | null | undefined {
  const entry = sessionEmployeeCache.get(sessionEmployeeCacheKey(user));
  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt) {
    sessionEmployeeCache.delete(sessionEmployeeCacheKey(user));
    return undefined;
  }
  return entry.record;
}

function writeSessionEmployeeCache(user: SessionUser, record: EmployeeRowRecord | null): void {
  sessionEmployeeCache.set(sessionEmployeeCacheKey(user), {
    record,
    expiresAt: Date.now() + SESSION_EMPLOYEE_CACHE_TTL_MS,
  });
}

export async function resolveEmployeeRecordForSession(
  user: SessionUser,
): Promise<EmployeeRowRecord | null> {
  const cached = readSessionEmployeeCache(user);
  if (cached !== undefined) return cached;

  let record: EmployeeRowRecord | null;
  if (isFirebaseDailyStorage()) {
    if (user.sheetRow != null && user.sheetRow >= 2) {
      const byRow = await getEmployeeBySheetRowFirestore(user.sheetRow);
      if (byRow) {
        record = byRow;
        writeSessionEmployeeCache(user, record);
        return record;
      }
    }
    record = await findEmployeeByLoginFirestore(user.email);
  } else {
    record = await resolveEmployeeRecordForSessionFromSheets(user);
  }

  writeSessionEmployeeCache(user, record);
  return record;
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

export async function getEmployeeSheetHeaders(): Promise<string[]> {
  if (isFirebaseDailyStorage()) {
    return getEmployeeHeadersFirestore();
  }
  const { getSheetHeadersData } = await import("@/lib/google/sheets");
  return getSheetHeadersData();
}

export async function readEmployeeSheetData(): Promise<{
  data: string[][];
  sheetRowNumbers?: number[];
}> {
  if (isFirebaseDailyStorage()) {
    return readEmployeeSheetDataFirestore();
  }
  const { EMPLOYEE_SHEET_RANGE, readSheet } = await import("@/lib/google/sheets");
  return { data: await readSheet(EMPLOYEE_SHEET_RANGE) };
}

export async function getEmployeeCount(): Promise<number> {
  if (isFirebaseDailyStorage()) {
    return getEmployeeCountFirestore();
  }
  const { getEmployeeCount: getCountFromSheets } = await import("@/lib/google/sheets");
  return getCountFromSheets();
}

export async function getExistingEmployeeIds(): Promise<string[]> {
  if (isFirebaseDailyStorage()) {
    return getExistingEmployeeIdsFirestore();
  }
  const { getExistingEmployeeIds: getIdsFromSheets } = await import("@/lib/google/sheets");
  return getIdsFromSheets();
}

/** Create employee and return the assigned sheetRow (Firestore doc id / Sheets row). */
export async function createEmployeeRow(row: string[]): Promise<number> {
  if (isFirebaseDailyStorage()) {
    return createEmployeeRowFirestore(row);
  }
  const { appendSheetRow, getEmployeeCount: getCountFromSheets } =
    await import("@/lib/google/sheets");
  const totalEmployees = await getCountFromSheets();
  await appendSheetRow([row]);
  return totalEmployees + 2;
}

export async function deleteEmployeeRow(sheetRow: number): Promise<boolean> {
  if (isFirebaseDailyStorage()) {
    return deleteEmployeeRowFirestore(sheetRow);
  }
  const { sheetRowToRange } = await import("@/lib/employee");
  const { clearSheetRange, getSheetHeadersData } = await import("@/lib/google/sheets");
  const headers = await getSheetHeadersData();
  await clearSheetRange(sheetRowToRange(sheetRow, headers.length));
  return true;
}
