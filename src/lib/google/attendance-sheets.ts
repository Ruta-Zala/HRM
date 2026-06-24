import type { LeaveBucketType } from "@/lib/attendance/leave-bucket-layout";
import {
  getLeaveBucketTemplateRows,
  isCurrentLeaveBucketHeaders,
  LEAVE_BUCKET_COLUMN_COUNT,
  LEAVE_BUCKET_COLUMN_GROUPS,
  LEAVE_BUCKET_HEADERS,
  migrateLeaveBucketRows,
  normalizeLeaveBucketRow,
} from "@/lib/attendance/leave-bucket-layout";
import { applyLeaveBucketRowFormats } from "@/lib/attendance/leave-bucket-format";
import { LEAVE_STATUS } from "@/lib/attendance/leave-status";
import {
  ATTENDANCE_COL,
  ATTENDANCE_HEADERS,
  ATTENDANCE_LAST_COLUMN,
  EARLY_LEAVE_REASON_MIN_LENGTH,
  IMPORT_DEFAULT_BREAK,
  OVERTIME_APPROVAL,
  WORK_MODE,
  WORK_MODE_OPTIONS,
  WORKING_STATUS,
} from "@/lib/attendance/constants";
import {
  computeAttendanceMetrics,
  formatClockTime,
  formatDuration,
  formatIsoDate,
  formatSheetDateLiteral,
  monthlySheetTitle,
  normalizeSheetDate,
  parseDurationToMs,
  resolveLiveBreakMs,
  parseSheetClockTime,
  parseTimeOnDate,
} from "@/lib/attendance/time";

import { formatDriveError, getDrive, getSheetsClient } from "./drive-auth";
import {
  applySheetHeaderFormatByTitle,
  applySheetHeaderFormatForTitles,
  applySheetHeaderRowFormat,
} from "./sheet-format";

const attendanceSpreadsheetLocks = new Map<string, Promise<string>>();
const yearSpreadsheetIdCache = new Map<string, string>();
const attendanceSpreadsheetMetaCache = new Map<
  string,
  {
    name: string;
    parentFolderId: string | null;
    employeeSlug: string;
    legacyRootName: string;
    sourceYear: number | null;
  }
>();

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const isQuotaError = (error: unknown): boolean => {
  const text = String(
    (error as { message?: string })?.message ??
      (error as { errors?: Array<{ message?: string }> })?.errors?.[0]?.message ??
      "",
  ).toLowerCase();
  return text.includes("quota") || text.includes("rate limit") || text.includes("429");
};

async function withQuotaRetry<T>(fn: () => Promise<T>): Promise<T> {
  const delays = [400, 1000, 2200];
  let lastError: unknown;
  for (let attempt = 0; attempt <= delays.length; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (!isQuotaError(error) || attempt === delays.length) break;
      await sleep(delays[attempt]);
    }
  }
  throw lastError;
}

function parseAttendanceFileName(name: string): {
  sourceYear: number | null;
  employeeSlug: string;
  legacyRootName: string;
} {
  const trimmed = name.trim();
  const yearPrefixed = trimmed.match(/^(\d{4})-(.+)$/);
  if (yearPrefixed) {
    const parsedYear = Number.parseInt(yearPrefixed[1], 10);
    const employeeSlug = yearPrefixed[2].trim();
    return {
      sourceYear: Number.isFinite(parsedYear) ? parsedYear : null,
      employeeSlug,
      legacyRootName: employeeSlug.split("-").join(" - ") + " - Attendance",
    };
  }

  const legacyYearSuffixed = trimmed.match(/^(.*)\s-\s(\d{4})$/);
  const legacyRootName = legacyYearSuffixed ? legacyYearSuffixed[1].trim() : trimmed;
  const parsedYear = legacyYearSuffixed ? Number.parseInt(legacyYearSuffixed[2], 10) : NaN;
  const withoutAttendance = legacyRootName.replace(/\s-\sAttendance$/i, "").trim();
  const employeeSlug = withoutAttendance.replace(/\s*-\s*/g, "-");

  return {
    sourceYear: Number.isFinite(parsedYear) ? parsedYear : null,
    employeeSlug,
    legacyRootName,
  };
}

async function getAttendanceSpreadsheetMeta(spreadsheetId: string): Promise<{
  name: string;
  parentFolderId: string | null;
  employeeSlug: string;
  legacyRootName: string;
  sourceYear: number | null;
}> {
  const cached = attendanceSpreadsheetMetaCache.get(spreadsheetId);
  if (cached) return cached;
  const drive = await getDrive();
  const file = await withQuotaRetry(() =>
    drive.files.get({
      fileId: spreadsheetId,
      fields: "name,parents",
      supportsAllDrives: true,
    }),
  );
  const name = file.data.name ?? "Attendance";
  const parentFolderId = file.data.parents?.[0] ?? null;
  const parsed = parseAttendanceFileName(name);
  const meta = {
    name,
    parentFolderId,
    employeeSlug: parsed.employeeSlug,
    legacyRootName: parsed.legacyRootName,
    sourceYear: parsed.sourceYear,
  };
  attendanceSpreadsheetMetaCache.set(spreadsheetId, meta);
  return meta;
}

async function resolveYearSpreadsheetId(baseSpreadsheetId: string, year: number): Promise<string> {
  const cacheKey = `${baseSpreadsheetId}:${year}`;
  const cached = yearSpreadsheetIdCache.get(cacheKey);
  if (cached) return cached;

  const meta = await getAttendanceSpreadsheetMeta(baseSpreadsheetId);
  const parentFolderId = meta.parentFolderId;
  if (!parentFolderId) {
    yearSpreadsheetIdCache.set(cacheKey, baseSpreadsheetId);
    return baseSpreadsheetId;
  }

  if (meta.sourceYear === year) {
    yearSpreadsheetIdCache.set(cacheKey, baseSpreadsheetId);
    return baseSpreadsheetId;
  }

  const targetName = `${year}-${meta.employeeSlug}`;
  if (targetName === meta.name) {
    yearSpreadsheetIdCache.set(cacheKey, baseSpreadsheetId);
    return baseSpreadsheetId;
  }

  const drive = await getDrive();
  const query = [
    "mimeType = 'application/vnd.google-apps.spreadsheet'",
    "trashed = false",
    `'${parentFolderId}' in parents`,
    `name = '${targetName.replace(/'/g, "\\'")}'`,
  ].join(" and ");
  const existing = await withQuotaRetry(() =>
    drive.files.list({
      q: query,
      fields: "files(id,createdTime)",
      orderBy: "createdTime",
      pageSize: 1,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    }),
  );
  const foundId = existing.data.files?.[0]?.id;
  if (foundId) {
    yearSpreadsheetIdCache.set(cacheKey, foundId);
    return foundId;
  }

  // Backward compatibility: reuse old naming format if it already exists.
  const legacyTargetName = `${meta.legacyRootName} - ${year}`;
  const legacyQuery = [
    "mimeType = 'application/vnd.google-apps.spreadsheet'",
    "trashed = false",
    `'${parentFolderId}' in parents`,
    `name = '${legacyTargetName.replace(/'/g, "\\'")}'`,
  ].join(" and ");
  const legacyExisting = await withQuotaRetry(() =>
    drive.files.list({
      q: legacyQuery,
      fields: "files(id,createdTime)",
      orderBy: "createdTime",
      pageSize: 1,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    }),
  );
  const legacyId = legacyExisting.data.files?.[0]?.id;
  if (legacyId) {
    yearSpreadsheetIdCache.set(cacheKey, legacyId);
    return legacyId;
  }

  const created = await withQuotaRetry(() =>
    drive.files.create({
      requestBody: {
        name: targetName,
        mimeType: "application/vnd.google-apps.spreadsheet",
        parents: [parentFolderId],
      },
      fields: "id",
      supportsAllDrives: true,
    }),
  );
  const createdId = created.data.id;
  if (!createdId) throw new Error(`Failed to create attendance spreadsheet for year ${year}`);
  yearSpreadsheetIdCache.set(cacheKey, createdId);
  return createdId;
}

async function resolveSpreadsheetForDate(baseSpreadsheetId: string, date: Date): Promise<string> {
  const year = date.getFullYear();
  if (!Number.isFinite(year)) return baseSpreadsheetId;
  return resolveYearSpreadsheetId(baseSpreadsheetId, year);
}

async function listYearlySpreadsheetIds(baseSpreadsheetId: string): Promise<string[]> {
  const meta = await getAttendanceSpreadsheetMeta(baseSpreadsheetId);
  if (!meta.parentFolderId) return [baseSpreadsheetId];
  const drive = await getDrive();
  const query = [
    "mimeType = 'application/vnd.google-apps.spreadsheet'",
    "trashed = false",
    `'${meta.parentFolderId}' in parents`,
  ].join(" and ");

  const yearlyFiles = await withQuotaRetry(() =>
    drive.files.list({
      q: query,
      fields: "files(id,name)",
      pageSize: 100,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    }),
  );

  const ids = new Set<string>([baseSpreadsheetId]);
  for (const file of yearlyFiles.data.files ?? []) {
    const name = file.name ?? "";
    const parsed = parseAttendanceFileName(name);
    const isLegacyPatternMatch = name.startsWith(`${meta.legacyRootName} - `);
    if (
      file.id &&
      parsed.sourceYear != null &&
      (parsed.employeeSlug === meta.employeeSlug || isLegacyPatternMatch)
    ) {
      ids.add(file.id);
    }
  }
  return [...ids];
}

export type AttendanceRow = {
  sheetRow: number;
  date: string;
  workMode: string;
  punchIn: string;
  punchOut: string;
  breakStart: string;
  breakEnd: string;
  totalBreakTime: string;
  workingHours: string;
  status: string;
  overtime: string;
  earlyLeaveReason: string;
  dailyUpdate: string;
  isOvertimeApproved: string;
};

function applyAttendanceMetrics(rowValues: string[], baseDate: Date): void {
  const punchOut = (rowValues[ATTENDANCE_COL.punchOut] ?? "").trim();
  const workMode = rowValues[ATTENDANCE_COL.workMode] ?? WORK_MODE.FULL_DAY_ONSITE;
  const metrics = computeAttendanceMetrics({
    punchIn: rowValues[ATTENDANCE_COL.punchIn] ?? "",
    punchOut: rowValues[ATTENDANCE_COL.punchOut] ?? "",
    totalBreakTime: rowValues[ATTENDANCE_COL.totalBreakTime] ?? "",
    baseDate,
    punchedOut: Boolean(punchOut),
    workMode,
  });

  if (punchOut) {
    rowValues[ATTENDANCE_COL.workingHours] = metrics.workingHours;
    rowValues[ATTENDANCE_COL.overtime] = metrics.overtime;
    rowValues[ATTENDANCE_COL.status] = resolveAttendanceStatus(
      metrics.status,
      rowValues[ATTENDANCE_COL.isOvertimeApproved] ?? OVERTIME_APPROVAL.NOT_CONSIDERED,
      metrics.overtime,
    );
  } else {
    rowValues[ATTENDANCE_COL.overtime] = "—";
    rowValues[ATTENDANCE_COL.status] = WORKING_STATUS.IN_PROGRESS;
  }
}

function resolveAttendanceStatus(
  baseStatus: string,
  overtimeApproval: string,
  overtimeValue: string,
): string {
  const approval = overtimeApproval.trim();
  const overtime = overtimeValue.trim();
  const hasPositiveOvertime =
    overtime.length > 0 && overtime !== "—" && !overtime.startsWith("-") && /\d/.test(overtime);

  if (!hasPositiveOvertime) {
    return baseStatus;
  }

  if (approval === OVERTIME_APPROVAL.PENDING) return WORKING_STATUS.OVERTIME_REQUESTED;
  if (approval === OVERTIME_APPROVAL.ACCEPTED) return WORKING_STATUS.OVERTIME_APPROVED;
  if (approval === OVERTIME_APPROVAL.REJECTED) return WORKING_STATUS.OVERTIME_REJECTED;
  return baseStatus;
}

function rowFromValues(values: string[], sheetRow: number): AttendanceRow {
  const dateStr = normalizeSheetDate(values[ATTENDANCE_COL.date] ?? "");
  const baseDate = dateStr ? new Date(dateStr) : new Date();
  const punchOut = values[ATTENDANCE_COL.punchOut] ?? "";
  const punchedOut = Boolean(punchOut.trim());

  const metrics = computeAttendanceMetrics({
    punchIn: values[ATTENDANCE_COL.punchIn] ?? "",
    punchOut,
    totalBreakTime: values[ATTENDANCE_COL.totalBreakTime] ?? "",
    baseDate,
    punchedOut,
    workMode: values[ATTENDANCE_COL.workMode] ?? WORK_MODE.FULL_DAY_ONSITE,
  });

  return {
    sheetRow,
    date: dateStr,
    workMode: values[ATTENDANCE_COL.workMode] ?? WORK_MODE.FULL_DAY_ONSITE,
    punchIn: values[ATTENDANCE_COL.punchIn] ?? "",
    punchOut,
    breakStart: values[ATTENDANCE_COL.breakStart] ?? "",
    breakEnd: values[ATTENDANCE_COL.breakEnd] ?? "",
    totalBreakTime: values[ATTENDANCE_COL.totalBreakTime] ?? "",
    workingHours: punchedOut ? metrics.workingHours : "",
    status: punchedOut
      ? resolveAttendanceStatus(
          metrics.status,
          values[ATTENDANCE_COL.isOvertimeApproved] ?? OVERTIME_APPROVAL.NOT_CONSIDERED,
          metrics.overtime,
        )
      : (values[ATTENDANCE_COL.status] ?? WORKING_STATUS.IN_PROGRESS),
    overtime: punchedOut ? metrics.overtime : "—",
    earlyLeaveReason: values[ATTENDANCE_COL.earlyLeaveReason] ?? "",
    dailyUpdate: values[ATTENDANCE_COL.dailyUpdate] ?? "",
    isOvertimeApproved:
      values[ATTENDANCE_COL.isOvertimeApproved] ?? OVERTIME_APPROVAL.NOT_CONSIDERED,
  };
}

export function attendanceSpreadsheetFileName(employeeId: string, employeeName: string): string {
  return `${employeeId} - ${employeeName} - Attendance`;
}

function attendanceYearSpreadsheetFileName(
  employeeId: string,
  employeeName: string,
  year: number = new Date().getFullYear(),
): string {
  return `${year}-${employeeId}-${employeeName}`;
}

/** Reuse an existing attendance file in the employee folder (avoids duplicates). */
export async function findAttendanceSpreadsheetInFolder(
  parentFolderId: string,
  employeeId: string,
  employeeName: string,
): Promise<string | null> {
  const drive = await getDrive();
  const slug = `${employeeId}-${employeeName}`.toLowerCase();
  const legacyName = attendanceSpreadsheetFileName(employeeId, employeeName).toLowerCase();
  const query = [
    "mimeType = 'application/vnd.google-apps.spreadsheet'",
    "trashed = false",
    `'${parentFolderId}' in parents`,
  ].join(" and ");

  const response = await drive.files.list({
    q: query,
    fields: "files(id,name,createdTime)",
    orderBy: "createdTime desc",
    pageSize: 100,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });

  const files = response.data.files ?? [];
  const yearPattern = /^\d{4}-.+$/;

  for (const file of files) {
    const name = (file.name ?? "").trim().toLowerCase();
    if (!file.id || !name) continue;
    if (yearPattern.test(name) && name.endsWith(slug)) return file.id;
  }

  for (const file of files) {
    const name = (file.name ?? "").trim().toLowerCase();
    if (!file.id || !name) continue;
    if (name === legacyName) return file.id;
  }

  return null;
}

export async function getOrCreateEmployeeAttendanceSpreadsheet(
  employeeId: string,
  employeeName: string,
  parentFolderId: string,
  birthdayDate = "",
): Promise<string> {
  const lockKey = `${parentFolderId}:${employeeId}`;
  const existing = attendanceSpreadsheetLocks.get(lockKey);
  if (existing) return existing;

  const promise = (async () => {
    const found = await findAttendanceSpreadsheetInFolder(parentFolderId, employeeId, employeeName);
    if (found) return found;
    return createEmployeeAttendanceSpreadsheet(
      employeeId,
      employeeName,
      parentFolderId,
      birthdayDate,
    );
  })();

  attendanceSpreadsheetLocks.set(lockKey, promise);
  try {
    return await promise;
  } finally {
    attendanceSpreadsheetLocks.delete(lockKey);
  }
}

export async function createEmployeeAttendanceSpreadsheet(
  employeeId: string,
  employeeName: string,
  parentFolderId: string,
  birthdayDate = "",
): Promise<string> {
  const title = attendanceYearSpreadsheetFileName(employeeId, employeeName);
  const sheetName = monthlySheetTitle();

  try {
    const drive = await getDrive();
    const created = await drive.files.create({
      requestBody: {
        name: title,
        mimeType: "application/vnd.google-apps.spreadsheet",
        parents: [parentFolderId],
      },
      fields: "id",
      supportsAllDrives: true,
    });

    const spreadsheetId = created.data.id;
    if (!spreadsheetId) {
      throw new Error("Failed to create attendance spreadsheet in Drive");
    }

    const sheetsApi = await getSheetsClient();
    const meta = await sheetsApi.spreadsheets.get({
      spreadsheetId,
      fields: "sheets.properties",
    });
    const defaultSheetId = meta.data.sheets?.[0]?.properties?.sheetId;

    if (defaultSheetId != null) {
      await sheetsApi.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [
            {
              updateSheetProperties: {
                properties: { sheetId: defaultSheetId, title: sheetName },
                fields: "title",
              },
            },
          ],
        },
      });
    }

    await sheetsApi.spreadsheets.values.update({
      spreadsheetId,
      range: `${sheetName}!A1:${ATTENDANCE_LAST_COLUMN}1`,
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [ATTENDANCE_HEADERS as unknown as string[]],
      },
    });

    const sheetId = defaultSheetId ?? (await getSheetId(spreadsheetId, sheetName));
    if (sheetId != null) {
      await applySheetHeaderRowFormat(sheetsApi, spreadsheetId, sheetId, ATTENDANCE_HEADERS.length);
    }
    await applyWorkModeDropdownByTitle(spreadsheetId, sheetName);
    await applyOvertimeApprovalDropdownByTitle(spreadsheetId, sheetName);
    await ensureLeaveBucketSheet(spreadsheetId, { birthdayDate });

    return spreadsheetId;
  } catch (error) {
    throw formatDriveError(error);
  }
}

const LEAVE_BUCKET_SHEET_NAME = "Leave Bucket";
const LEAVE_BUCKET_SHEET_RANGE = "A:X";

async function ensureLeaveBucketLayout(spreadsheetId: string): Promise<void> {
  const sheetsApi = await getSheetsClient();
  const existingId = await getSheetId(spreadsheetId, LEAVE_BUCKET_SHEET_NAME);
  if (existingId == null) return;

  const response = await sheetsApi.spreadsheets.values.get({
    spreadsheetId,
    range: `${LEAVE_BUCKET_SHEET_NAME}!${LEAVE_BUCKET_SHEET_RANGE}`,
  });

  const values = response.data.values ?? [];
  if (values.length === 0 || isCurrentLeaveBucketHeaders(values[0] ?? [])) {
    return;
  }

  const migrated = migrateLeaveBucketRows(values);

  await sheetsApi.spreadsheets.values.update({
    spreadsheetId,
    range: `${LEAVE_BUCKET_SHEET_NAME}!A1:X${Math.max(migrated.length, 13)}`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: migrated },
  });

  await applySheetHeaderFormatByTitle(
    spreadsheetId,
    LEAVE_BUCKET_SHEET_NAME,
    LEAVE_BUCKET_COLUMN_COUNT,
  );
}

export async function ensureLeaveBucketSheet(
  spreadsheetId: string,
  options?: { birthdayDate?: string },
): Promise<void> {
  const sheetsApi = await getSheetsClient();
  const existingId = await getSheetId(spreadsheetId, LEAVE_BUCKET_SHEET_NAME);
  if (existingId != null) return;

  await sheetsApi.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [{ addSheet: { properties: { title: LEAVE_BUCKET_SHEET_NAME } } }],
    },
  });

  await sheetsApi.spreadsheets.values.update({
    spreadsheetId,
    range: `${LEAVE_BUCKET_SHEET_NAME}!A1:X13`,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: getLeaveBucketTemplateRows(options?.birthdayDate ?? ""),
    },
  });

  await applySheetHeaderFormatByTitle(
    spreadsheetId,
    LEAVE_BUCKET_SHEET_NAME,
    LEAVE_BUCKET_COLUMN_COUNT,
  );
}

function normalizeLeaveBucketType(value: string): LeaveBucketType {
  const normalized = value.trim().toLowerCase();

  if (normalized === "paid" || normalized === "paid leave") return "paid";
  if (normalized === "casual" || normalized === "casual leave") return "casual";
  if (normalized === "sick" || normalized === "sick leave" || normalized === "sl") return "sick";
  if (normalized === "birthday" || normalized === "birthday leave") return "birthday";
  return "unpaid";
}

function formatLeaveBucketDate(date: Date) {
  const day = date.getDate();
  const month = date.getMonth() + 1;
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

function formatLeaveDurationLabel(duration: "full" | "half_am" | "half_pm") {
  if (duration === "half_am") return "Half Day (AM)";
  if (duration === "half_pm") return "Half Day (PM)";
  return "Full Day";
}

// function parsePlainDate(value: string): Date | null {
//   const trimmed = value.trim();
//   if (!trimmed) return null;

//   const slashMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
//   if (slashMatch) {
//     const month = Number(slashMatch[1]);
//     const day = Number(slashMatch[2]);
//     const year = Number(slashMatch[3]);
//     const date = new Date(year, month - 1, day);
//     if (!Number.isNaN(date.getTime())) return date;
//   }

//   const isoDate = new Date(trimmed);
//   if (!Number.isNaN(isoDate.getTime())) return isoDate;

//   return null;
// }

function normalizeMonthName(value: string): string {
  const trimmed = value.trim().toLowerCase();
  const monthMap: Record<string, string> = {
    january: "January",
    february: "February",
    march: "March",
    april: "April",
    may: "May",
    june: "June",
    july: "July",
    august: "August",
    september: "September",
    october: "October",
    november: "November",
    december: "December",
    jan: "January",
    feb: "February",
    mar: "March",
    apr: "April",
    jun: "June",
    jul: "July",
    aug: "August",
    sep: "September",
    oct: "October",
    nov: "November",
    dec: "December",
  };
  return monthMap[trimmed] ?? value;
}

function parseDelimitedRows(content: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < content.length; i++) {
    const ch = content[i];
    const next = content[i + 1];

    if (ch === '"') {
      if (inQuotes && next === '"') {
        cell += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (!inQuotes && (ch === "," || ch === "\t")) {
      row.push(cell.trim());
      cell = "";
      continue;
    }

    if (!inQuotes && (ch === "\n" || ch === "\r")) {
      if (ch === "\r" && next === "\n") i++;
      row.push(cell.trim());
      const hasAnyValue = row.some((c) => c.length > 0);
      if (hasAnyValue) rows.push(row);
      row = [];
      cell = "";
      continue;
    }

    cell += ch;
  }

  row.push(cell.trim());
  if (row.some((c) => c.length > 0)) rows.push(row);
  return rows;
}

function findNextEmptySlot(
  rows: string[][],
  colIndex: number,
  allowUnlimitedRows = false,
): number | null {
  for (let i = 1; i < rows.length; i++) {
    const monthLabel = String(rows[i]?.[0] ?? "").trim();
    if (!monthLabel) continue;

    const cell = String(rows[i]?.[colIndex] ?? "").trim();
    if (!cell) return i;
  }

  if (!allowUnlimitedRows) {
    return null;
  }

  for (let i = 1; i < rows.length; i++) {
    const monthLabel = String(rows[i]?.[0] ?? "").trim();
    if (monthLabel) continue;

    const cell = String(rows[i]?.[colIndex] ?? "").trim();
    if (!cell) return i;
  }

  const newRow = new Array(LEAVE_BUCKET_COLUMN_COUNT).fill("");
  rows.push(newRow);
  return rows.length - 1;
}

function findNextBirthdayApplySlot(rows: string[][]): number | null {
  const columns = LEAVE_BUCKET_COLUMN_GROUPS.birthday;

  for (let i = 1; i < rows.length; i++) {
    rows[i] = normalizeLeaveBucketRow(rows[i]);
    const date = String(rows[i][columns.date] ?? "").trim();
    const status = String(rows[i][columns.status] ?? "").trim();
    if (date && !status) return i;
  }

  return findNextEmptySlot(rows, columns.date, false);
}

function applyLeaveDatesToRows(
  rows: string[][],
  leaveType: LeaveBucketType,
  dates: Date[],
  duration: "full" | "half_am" | "half_pm",
  reason: string,
): Array<{ rowIndex: number; leaveType: LeaveBucketType }> {
  const columns = LEAVE_BUCKET_COLUMN_GROUPS[leaveType];
  const allowUnlimitedRows = leaveType === "unpaid";
  const durationLabel = formatLeaveDurationLabel(duration);
  const appliedRows: Array<{ rowIndex: number; leaveType: LeaveBucketType }> = [];

  for (const date of dates) {
    const rowIndex =
      leaveType === "birthday"
        ? findNextBirthdayApplySlot(rows)
        : findNextEmptySlot(rows, columns.date, allowUnlimitedRows);

    if (rowIndex == null) {
      throw new Error(`No available slot in ${leaveType} leave column.`);
    }

    rows[rowIndex] = normalizeLeaveBucketRow(rows[rowIndex]);
    rows[rowIndex][columns.date] = formatLeaveBucketDate(date);
    if (columns.duration != null) {
      rows[rowIndex][columns.duration] = durationLabel;
    }
    if (columns.reason != null) {
      rows[rowIndex][columns.reason] = reason;
    }
    rows[rowIndex][columns.status] = LEAVE_STATUS.APPLIED;
    rows[rowIndex][columns.rejectReason] = "";

    appliedRows.push({ rowIndex, leaveType });
  }

  return appliedRows;
}

export async function addLeaveDatesToBucket(
  spreadsheetId: string,
  leaveType: string,
  dates: Date[],
  duration: "full" | "half_am" | "half_pm" = "full",
  reason = "",
): Promise<void> {
  const targetType = normalizeLeaveBucketType(leaveType);
  await addGroupedLeaveDatesToBucket(
    spreadsheetId,
    [{ leaveType: targetType, dates }],
    duration,
    reason,
  );
}

export async function addGroupedLeaveDatesToBucket(
  spreadsheetId: string,
  groups: Array<{ leaveType: LeaveBucketType; dates: Date[] }>,
  duration: "full" | "half_am" | "half_pm" = "full",
  reason = "",
): Promise<void> {
  const sheetsApi = await getSheetsClient();
  await ensureLeaveBucketSheet(spreadsheetId);
  await ensureLeaveBucketLayout(spreadsheetId);

  const response = await sheetsApi.spreadsheets.values.get({
    spreadsheetId,
    range: `${LEAVE_BUCKET_SHEET_NAME}!${LEAVE_BUCKET_SHEET_RANGE}`,
  });

  const values = response.data.values ?? getLeaveBucketTemplateRows();
  const rows = migrateLeaveBucketRows(values).map((row) => normalizeLeaveBucketRow(row));
  const appliedRows: Array<{ rowIndex: number; leaveType: LeaveBucketType }> = [];

  for (const group of groups) {
    if (group.dates.length === 0) continue;
    appliedRows.push(
      ...applyLeaveDatesToRows(rows, group.leaveType, group.dates, duration, reason),
    );
  }

  await sheetsApi.spreadsheets.values.update({
    spreadsheetId,
    range: `${LEAVE_BUCKET_SHEET_NAME}!A1:X${rows.length}`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: rows },
  });

  await applyLeaveBucketRowFormats(
    spreadsheetId,
    appliedRows.map((entry) => ({
      ...entry,
      status: LEAVE_STATUS.APPLIED,
    })),
  );
}

export async function readLeaveBucketRows(spreadsheetId: string): Promise<string[][]> {
  const sheetsApi = await getSheetsClient();
  await ensureLeaveBucketSheet(spreadsheetId);
  await ensureLeaveBucketLayout(spreadsheetId);

  const response = await sheetsApi.spreadsheets.values.get({
    spreadsheetId,
    range: `${LEAVE_BUCKET_SHEET_NAME}!${LEAVE_BUCKET_SHEET_RANGE}`,
  });

  const values = response.data.values ?? getLeaveBucketTemplateRows();
  return migrateLeaveBucketRows(values).map((row) => normalizeLeaveBucketRow(row));
}

export async function importLeaveBucketCsv(spreadsheetId: string, content: string): Promise<void> {
  await ensureLeaveBucketSheet(spreadsheetId);
  await ensureLeaveBucketLayout(spreadsheetId);

  const rows = parseDelimitedRows(content);
  if (rows.length < 2) {
    throw new Error("CSV must contain a header row and at least one data row.");
  }

  const headers = rows[0].map((value) => value.trim().toLowerCase());
  const monthIndex = headers.findIndex((header) => header.includes("month"));

  if (monthIndex === -1) {
    throw new Error("Leave bucket CSV must contain a Month column.");
  }

  const findHeaderIndex = (label: string) => {
    const normalized = label.trim().toLowerCase();
    const exact = headers.findIndex((header) => header === normalized);
    if (exact >= 0) return exact;
    return headers.findIndex((header) => header.includes(normalized));
  };

  const leaveTypes = Object.keys(LEAVE_BUCKET_COLUMN_GROUPS) as LeaveBucketType[];
  const columnIndexes = Object.fromEntries(
    leaveTypes.map((type) => {
      const columns = LEAVE_BUCKET_COLUMN_GROUPS[type];
      return [
        type,
        {
          date: findHeaderIndex(LEAVE_BUCKET_HEADERS[columns.date]),
          duration:
            columns.duration != null ? findHeaderIndex(LEAVE_BUCKET_HEADERS[columns.duration]) : -1,
          reason:
            columns.reason != null ? findHeaderIndex(LEAVE_BUCKET_HEADERS[columns.reason]) : -1,
          status: findHeaderIndex(LEAVE_BUCKET_HEADERS[columns.status]),
          rejectReason: findHeaderIndex(LEAVE_BUCKET_HEADERS[columns.rejectReason]),
        },
      ];
    }),
  ) as Record<
    LeaveBucketType,
    {
      date: number;
      duration: number;
      reason: number;
      status: number;
      rejectReason: number;
    }
  >;

  const legacyDurationIndex = headers.findIndex(
    (header) => header === "duration" || header.endsWith(" duration"),
  );
  const legacyReasonIndex = headers.findIndex(
    (header) => header === "reason" || header.endsWith(" reason"),
  );

  const sheetsApi = await getSheetsClient();
  const response = await sheetsApi.spreadsheets.values.get({
    spreadsheetId,
    range: `${LEAVE_BUCKET_SHEET_NAME}!${LEAVE_BUCKET_SHEET_RANGE}`,
  });

  const existingValues = migrateLeaveBucketRows(
    response.data.values ?? getLeaveBucketTemplateRows(),
  ).map((row) => normalizeLeaveBucketRow(row));
  const resultValues = existingValues.map((row) => row.slice());
  const monthIndexMap = new Map<string, number>();
  for (let i = 1; i < resultValues.length; i++) {
    const month = String(resultValues[i][0] ?? "")
      .trim()
      .toLowerCase();
    if (month) monthIndexMap.set(month, i);
  }

  const normalizeCellValues = (cell: string) =>
    cell
      .split(/[,;]+/)
      .map((item) => item.trim())
      .filter((item) => item && item !== "0/1")
      .map((item) => item.replace(/\s+/g, " ").trim());

  const setColumn = (
    targetRowIndex: number,
    columnIndex: number,
    columnValue: string | undefined,
  ) => {
    if (columnIndex < 0) return;
    const items = normalizeCellValues(String(columnValue ?? ""));
    if (items.length === 0) return;
    const current = String(resultValues[targetRowIndex][columnIndex] ?? "").trim();
    const existing = current.length ? current.split(/\s*,\s*/).filter(Boolean) : [];
    for (const item of items) {
      if (!existing.includes(item)) existing.push(item);
    }
    resultValues[targetRowIndex][columnIndex] = existing.join(", ");
  };

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const monthRaw = String(row[monthIndex] ?? "").trim();
    const month = normalizeMonthName(monthRaw).toLowerCase();
    const targetRowIndex = monthIndexMap.get(month);
    if (targetRowIndex == null) continue;

    for (const type of leaveTypes) {
      const indexes = columnIndexes[type];
      const sheetColumns = LEAVE_BUCKET_COLUMN_GROUPS[type];

      setColumn(targetRowIndex, sheetColumns.date, row[indexes.date]);

      const durationValue = String(
        indexes.duration >= 0 ? row[indexes.duration] : row[legacyDurationIndex],
      ).trim();
      if (durationValue && sheetColumns.duration != null) {
        resultValues[targetRowIndex][sheetColumns.duration] = durationValue;
      }

      const reasonValue = String(
        indexes.reason >= 0 ? row[indexes.reason] : row[legacyReasonIndex],
      ).trim();
      if (reasonValue && sheetColumns.reason != null) {
        resultValues[targetRowIndex][sheetColumns.reason] = reasonValue;
      }

      const statusValue = String(row[indexes.status] ?? "").trim();
      if (statusValue) {
        resultValues[targetRowIndex][sheetColumns.status] = statusValue;
      }

      const rejectValue = String(row[indexes.rejectReason] ?? "").trim();
      if (rejectValue) {
        resultValues[targetRowIndex][sheetColumns.rejectReason] = rejectValue;
      }
    }
  }

  await sheetsApi.spreadsheets.values.update({
    spreadsheetId,
    range: `${LEAVE_BUCKET_SHEET_NAME}!A1:X${resultValues.length}`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: resultValues },
  });
}

async function getSheetId(spreadsheetId: string, title: string): Promise<number | null> {
  const sheetsApi = await getSheetsClient();
  const meta = await sheetsApi.spreadsheets.get({
    spreadsheetId,
    fields: "sheets.properties",
  });

  const normalized = title.trim().toLowerCase();
  const sheet = meta.data.sheets?.find(
    (s) => (s.properties?.title ?? "").trim().toLowerCase() === normalized,
  );
  return sheet?.properties?.sheetId ?? null;
}

async function applyWorkModeDropdownByTitle(
  spreadsheetId: string,
  sheetTitle: string,
): Promise<void> {
  const sheetsApi = await getSheetsClient();
  const meta = await sheetsApi.spreadsheets.get({
    spreadsheetId,
    fields: "sheets(properties(sheetId,title),conditionalFormats)",
  });
  const normalized = sheetTitle.trim().toLowerCase();
  const targetSheet = meta.data.sheets?.find(
    (s) => (s.properties?.title ?? "").trim().toLowerCase() === normalized,
  );
  const sheetId = targetSheet?.properties?.sheetId;
  if (sheetId == null) return;

  const workModeColumnStart = ATTENDANCE_COL.workMode;
  const workModeColumnEnd = ATTENDANCE_COL.workMode + 1;
  const hasRulesAlready = (targetSheet?.conditionalFormats ?? []).some((rule) => {
    const range = rule.ranges?.[0];
    const condition = rule.booleanRule?.condition;
    return (
      range?.sheetId === sheetId &&
      range.startColumnIndex === workModeColumnStart &&
      range.endColumnIndex === workModeColumnEnd &&
      condition?.type === "TEXT_EQ"
    );
  });

  const workModeColors: Record<string, { red: number; green: number; blue: number }> = {
    [WORK_MODE.WFH]: { red: 0.86, green: 0.93, blue: 1 },
    [WORK_MODE.WFH_HALF_DAY]: { red: 0.82, green: 0.9, blue: 1 },
    [WORK_MODE.FULL_DAY_LEAVE]: { red: 1, green: 0.9, blue: 0.9 },
    [WORK_MODE.PUBLIC_HOLIDAY]: { red: 0.95, green: 0.88, blue: 1 },
    [WORK_MODE.WEEKEND_HOLIDAY]: { red: 0.92, green: 0.92, blue: 0.92 },
    [WORK_MODE.FULL_DAY_ONSITE]: { red: 0.86, green: 0.97, blue: 0.89 },
    [WORK_MODE.HALF_DAY_LEAVE]: { red: 1, green: 0.95, blue: 0.83 },
    [WORK_MODE.SL]: { red: 1, green: 0.9, blue: 0.95 },
  };

  const requests = [
    {
      setDataValidation: {
        range: {
          sheetId,
          startRowIndex: 1,
          startColumnIndex: workModeColumnStart,
          endColumnIndex: workModeColumnEnd,
        },
        rule: {
          condition: {
            type: "ONE_OF_LIST",
            values: WORK_MODE_OPTIONS.map((mode) => ({ userEnteredValue: mode })),
          },
          strict: true,
          showCustomUi: true,
        },
      },
    },
    ...(!hasRulesAlready
      ? WORK_MODE_OPTIONS.map((mode, index) => ({
          addConditionalFormatRule: {
            index,
            rule: {
              ranges: [
                {
                  sheetId,
                  startRowIndex: 1,
                  startColumnIndex: workModeColumnStart,
                  endColumnIndex: workModeColumnEnd,
                },
              ],
              booleanRule: {
                condition: {
                  type: "TEXT_EQ",
                  values: [{ userEnteredValue: mode }],
                },
                format: {
                  backgroundColor: workModeColors[mode],
                  textFormat: { bold: true },
                },
              },
            },
          },
        }))
      : []),
  ];

  await sheetsApi.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: { requests },
  });
}

async function applyOvertimeApprovalDropdownByTitle(
  spreadsheetId: string,
  sheetTitle: string,
): Promise<void> {
  const sheetsApi = await getSheetsClient();
  const meta = await sheetsApi.spreadsheets.get({
    spreadsheetId,
    fields: "sheets(properties(sheetId,title))",
  });
  const normalized = sheetTitle.trim().toLowerCase();
  const targetSheet = meta.data.sheets?.find(
    (s) => (s.properties?.title ?? "").trim().toLowerCase() === normalized,
  );
  const sheetId = targetSheet?.properties?.sheetId;
  if (sheetId == null) return;

  await sheetsApi.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          setDataValidation: {
            range: {
              sheetId,
              startRowIndex: 1,
              startColumnIndex: ATTENDANCE_COL.isOvertimeApproved,
              endColumnIndex: ATTENDANCE_COL.isOvertimeApproved + 1,
            },
            rule: {
              condition: {
                type: "ONE_OF_LIST",
                values: [
                  { userEnteredValue: OVERTIME_APPROVAL.ACCEPTED },
                  { userEnteredValue: OVERTIME_APPROVAL.REJECTED },
                  { userEnteredValue: OVERTIME_APPROVAL.PENDING },
                  { userEnteredValue: OVERTIME_APPROVAL.NOT_CONSIDERED },
                ],
              },
              strict: true,
              showCustomUi: true,
            },
          },
        },
      ],
    },
  });
}

export async function listMonthlySheets(spreadsheetId: string): Promise<string[]> {
  const sheetsApi = await getSheetsClient();
  const meta = await sheetsApi.spreadsheets.get({
    spreadsheetId,
    fields: "sheets.properties.title",
  });

  return (
    meta.data.sheets
      ?.map((s) => s.properties?.title ?? "")
      .filter((title) => /^[A-Za-z]{3}-\d{4}$/.test(title)) ?? []
  );
}

async function ensureAttendanceHeaderRow(spreadsheetId: string, sheetTitle: string): Promise<void> {
  const sheetsApi = await getSheetsClient();
  const response = await sheetsApi.spreadsheets.values.get({
    spreadsheetId,
    range: `'${sheetTitle}'!A1:${ATTENDANCE_LAST_COLUMN}1`,
  });
  const row = response.data.values?.[0] ?? [];
  const expected = ATTENDANCE_HEADERS as unknown as string[];
  const isLegacyWithoutWorkMode =
    row.length === expected.length - 1 &&
    (row[0] ?? "").trim() === "Date" &&
    (row[1] ?? "").trim() === "Punch In";

  if (isLegacyWithoutWorkMode) {
    const sheetId = await getSheetId(spreadsheetId, sheetTitle);
    if (sheetId != null) {
      await sheetsApi.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [
            {
              insertDimension: {
                range: {
                  sheetId,
                  dimension: "COLUMNS",
                  startIndex: ATTENDANCE_COL.workMode,
                  endIndex: ATTENDANCE_COL.workMode + 1,
                },
                inheritFromBefore: false,
              },
            },
          ],
        },
      });

      const dataRows = await sheetsApi.spreadsheets.values.get({
        spreadsheetId,
        range: `'${sheetTitle}'!A2:A`,
      });
      const existingDataRows = (dataRows.data.values ?? []).length;
      if (existingDataRows > 0) {
        await sheetsApi.spreadsheets.values.update({
          spreadsheetId,
          range: `'${sheetTitle}'!B2:B${existingDataRows + 1}`,
          valueInputOption: "USER_ENTERED",
          requestBody: {
            values: Array.from({ length: existingDataRows }, () => [WORK_MODE.FULL_DAY_ONSITE]),
          },
        });
      }
    }
  }

  const refreshedHeader = await sheetsApi.spreadsheets.values.get({
    spreadsheetId,
    range: `'${sheetTitle}'!A1:${ATTENDANCE_LAST_COLUMN}1`,
  });
  const updatedRow = refreshedHeader.data.values?.[0] ?? [];
  const needsUpdate =
    updatedRow.length < expected.length ||
    expected.some((header, i) => (updatedRow[i] ?? "").trim() !== header);

  if (needsUpdate) {
    await sheetsApi.spreadsheets.values.update({
      spreadsheetId,
      range: `'${sheetTitle}'!A1:${ATTENDANCE_LAST_COLUMN}1`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [expected] },
    });
  }

  await applySheetHeaderFormatByTitle(spreadsheetId, sheetTitle, ATTENDANCE_HEADERS.length);
  await applyWorkModeDropdownByTitle(spreadsheetId, sheetTitle);
  await applyOvertimeApprovalDropdownByTitle(spreadsheetId, sheetTitle);
}

export async function ensureMonthlySheet(
  spreadsheetId: string,
  date: Date = new Date(),
): Promise<string> {
  const title = monthlySheetTitle(date);
  const existingId = await getSheetId(spreadsheetId, title);
  if (existingId != null) {
    await ensureAttendanceHeaderRow(spreadsheetId, title);
    return title;
  }

  const sheetsApi = await getSheetsClient();
  const meta = await sheetsApi.spreadsheets.get({
    spreadsheetId,
    fields: "sheets.properties",
  });
  const sheets = meta.data.sheets ?? [];

  const defaultSheet = sheets.find((s) => {
    const t = s.properties?.title ?? "";
    return t === "Employees" || /^Sheet\d+$/.test(t);
  });

  if (sheets.length === 1 && defaultSheet?.properties?.sheetId != null) {
    await sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            updateSheetProperties: {
              properties: {
                sheetId: defaultSheet.properties.sheetId,
                title,
              },
              fields: "title",
            },
          },
        ],
      },
    });
  } else {
    await sheetsApi.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            addSheet: {
              properties: { title },
            },
          },
        ],
      },
    });
  }

  await sheetsApi.spreadsheets.values.update({
    spreadsheetId,
    range: `${title}!A1:${ATTENDANCE_LAST_COLUMN}1`,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [ATTENDANCE_HEADERS as unknown as string[]],
    },
  });

  await applySheetHeaderFormatByTitle(spreadsheetId, title, ATTENDANCE_HEADERS.length);
  await applyWorkModeDropdownByTitle(spreadsheetId, title);
  await applyOvertimeApprovalDropdownByTitle(spreadsheetId, title);
  await ensureLeaveBucketSheet(spreadsheetId);

  return title;
}

/** Apply standard header styling to every monthly tab (existing + new). */
export async function formatAllAttendanceMonthlyHeaders(spreadsheetId: string): Promise<void> {
  const titles = await listMonthlySheets(spreadsheetId);
  for (const sheetTitle of titles) {
    await ensureAttendanceHeaderRow(spreadsheetId, sheetTitle);
  }
  if (titles.length > 0) {
    await applySheetHeaderFormatForTitles(spreadsheetId, titles, ATTENDANCE_HEADERS.length);
  }
}

async function readMonthlyRows(spreadsheetId: string, sheetTitle: string): Promise<string[][]> {
  const sheetsApi = await getSheetsClient();
  const response = await sheetsApi.spreadsheets.values.get({
    spreadsheetId,
    range: `'${sheetTitle}'!A:${ATTENDANCE_LAST_COLUMN}`,
  });

  return response.data.values ?? [];
}

function findTodayRow(rows: string[][], today: string): { row: string[]; sheetRow: number } | null {
  const target = normalizeSheetDate(today);

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i] ?? [];
    const rowDate = normalizeSheetDate(row[ATTENDANCE_COL.date] ?? "");
    if (rowDate === target) {
      return { row, sheetRow: i + 1 };
    }
  }

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i] ?? [];
    const punchIn = (row[ATTENDANCE_COL.punchIn] ?? "").trim();
    const punchOut = (row[ATTENDANCE_COL.punchOut] ?? "").trim();
    const rowDate = normalizeSheetDate(row[ATTENDANCE_COL.date] ?? "");
    if (!rowDate && punchIn && !punchOut) {
      return { row, sheetRow: i + 1 };
    }
  }

  return null;
}

export async function getTodayAttendance(
  spreadsheetId: string,
  date: Date = new Date(),
): Promise<AttendanceRow | null> {
  const targetSpreadsheetId = await resolveSpreadsheetForDate(spreadsheetId, date);
  const sheetTitle = await ensureMonthlySheet(targetSpreadsheetId, date);
  const rows = await readMonthlyRows(targetSpreadsheetId, sheetTitle);
  const today = formatIsoDate(date);
  const found = findTodayRow(rows, today);
  if (!found) return null;
  return rowFromValues(found.row, found.sheetRow);
}

async function updateAttendanceRow(
  spreadsheetId: string,
  sheetTitle: string,
  sheetRow: number,
  values: string[],
): Promise<void> {
  const sheetsApi = await getSheetsClient();
  await sheetsApi.spreadsheets.values.update({
    spreadsheetId,
    range: `'${sheetTitle}'!A${sheetRow}:${ATTENDANCE_LAST_COLUMN}${sheetRow}`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [values] },
  });
}

function buildRowValues(existing: string[] | undefined, date: Date): string[] {
  const base = [...(existing ?? [])];
  while (base.length < ATTENDANCE_HEADERS.length) base.push("");
  if (!normalizeSheetDate(base[ATTENDANCE_COL.date] ?? "")) {
    base[ATTENDANCE_COL.date] = formatSheetDateLiteral(date);
  }
  if (!(base[ATTENDANCE_COL.workMode] ?? "").trim()) {
    base[ATTENDANCE_COL.workMode] = WORK_MODE.FULL_DAY_ONSITE;
  }
  if (!(base[ATTENDANCE_COL.isOvertimeApproved] ?? "").trim()) {
    base[ATTENDANCE_COL.isOvertimeApproved] = OVERTIME_APPROVAL.NOT_CONSIDERED;
  }
  return base;
}

async function ensureSheetHasRows(
  spreadsheetId: string,
  sheetTitle: string,
  requiredRow: number,
): Promise<void> {
  const sheetsApi = await getSheetsClient();
  const meta = await sheetsApi.spreadsheets.get({
    spreadsheetId,
    fields: "sheets.properties(sheetId,title,gridProperties.rowCount)",
  });
  const normalized = sheetTitle.trim().toLowerCase();
  const targetSheet = meta.data.sheets?.find(
    (s) => (s.properties?.title ?? "").trim().toLowerCase() === normalized,
  );
  const sheetId = targetSheet?.properties?.sheetId;
  const rowCount = targetSheet?.properties?.gridProperties?.rowCount ?? 0;
  if (sheetId == null || rowCount >= requiredRow) return;

  await sheetsApi.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          appendDimension: {
            sheetId,
            dimension: "ROWS",
            length: requiredRow - rowCount,
          },
        },
      ],
    },
  });
}

export async function punchIn(
  spreadsheetId: string,
  date: Date = new Date(),
  options?: { workMode?: string },
): Promise<AttendanceRow> {
  const targetSpreadsheetId = await resolveSpreadsheetForDate(spreadsheetId, date);
  const sheetTitle = await ensureMonthlySheet(targetSpreadsheetId, date);
  const rows = await readMonthlyRows(targetSpreadsheetId, sheetTitle);
  const today = formatIsoDate(date);
  const found = findTodayRow(rows, today);

  if (found?.row[ATTENDANCE_COL.punchIn]?.trim()) {
    throw new Error("Already punched in today");
  }

  const now = formatClockTime(date);
  const rowValues = buildRowValues(found?.row, date);
  rowValues[ATTENDANCE_COL.workMode] =
    options?.workMode?.trim() || rowValues[ATTENDANCE_COL.workMode] || WORK_MODE.FULL_DAY_ONSITE;
  rowValues[ATTENDANCE_COL.punchIn] = now;
  rowValues[ATTENDANCE_COL.overtime] = "—";
  rowValues[ATTENDANCE_COL.status] = WORKING_STATUS.IN_PROGRESS;
  rowValues[ATTENDANCE_COL.breakStart] = "";
  rowValues[ATTENDANCE_COL.breakEnd] = "";
  rowValues[ATTENDANCE_COL.totalBreakTime] = "";

  const targetRow = found?.sheetRow ?? Math.max(rows.length + 1, 2);
  await updateAttendanceRow(targetSpreadsheetId, sheetTitle, targetRow, rowValues);

  return rowFromValues(rowValues, targetRow);
}

export async function punchOut(
  spreadsheetId: string,
  date: Date = new Date(),
  options?: { earlyLeaveReason?: string; dailyUpdate?: string },
): Promise<AttendanceRow> {
  const targetSpreadsheetId = await resolveSpreadsheetForDate(spreadsheetId, date);
  const sheetTitle = await ensureMonthlySheet(targetSpreadsheetId, date);
  const rows = await readMonthlyRows(targetSpreadsheetId, sheetTitle);
  const today = formatIsoDate(date);
  const found = findTodayRow(rows, today);

  if (!found?.row[ATTENDANCE_COL.punchIn]?.trim()) {
    throw new Error("Punch in first before punching out");
  }
  if (found.row[ATTENDANCE_COL.punchOut]?.trim()) {
    throw new Error("Already punched out today");
  }
  if (found.row[ATTENDANCE_COL.breakStart]?.trim() && !found.row[ATTENDANCE_COL.breakEnd]?.trim()) {
    throw new Error("End your break before punching out");
  }

  const rowValues = [...found.row];
  while (rowValues.length < ATTENDANCE_HEADERS.length) rowValues.push("");

  rowValues[ATTENDANCE_COL.punchOut] = formatClockTime(date);
  applyAttendanceMetrics(rowValues, date);

  const status = rowValues[ATTENDANCE_COL.status] ?? "";
  if (status === WORKING_STATUS.SHORT) {
    const reason = options?.earlyLeaveReason?.trim() ?? "";
    if (!reason) {
      throw new Error("Please provide a reason for leaving early");
    }
    if (reason.length < EARLY_LEAVE_REASON_MIN_LENGTH) {
      throw new Error(
        `Early leave reason must be at least ${EARLY_LEAVE_REASON_MIN_LENGTH} characters`,
      );
    }
    rowValues[ATTENDANCE_COL.earlyLeaveReason] = reason;
  } else {
    rowValues[ATTENDANCE_COL.earlyLeaveReason] = "";
  }
  rowValues[ATTENDANCE_COL.dailyUpdate] = options?.dailyUpdate?.trim() ?? "";

  await updateAttendanceRow(targetSpreadsheetId, sheetTitle, found.sheetRow, rowValues);

  return rowFromValues(rowValues, found.sheetRow);
}

export async function startBreak(
  spreadsheetId: string,
  date: Date = new Date(),
): Promise<AttendanceRow> {
  const targetSpreadsheetId = await resolveSpreadsheetForDate(spreadsheetId, date);
  const sheetTitle = await ensureMonthlySheet(targetSpreadsheetId, date);
  const rows = await readMonthlyRows(targetSpreadsheetId, sheetTitle);
  const today = formatIsoDate(date);
  const found = findTodayRow(rows, today);

  if (!found?.row[ATTENDANCE_COL.punchIn]?.trim()) {
    throw new Error("Punch in first before starting a break");
  }
  if (found.row[ATTENDANCE_COL.punchOut]?.trim()) {
    throw new Error("Cannot start a break after punch out");
  }
  if ((found.row[ATTENDANCE_COL.workMode] ?? "").trim() === WORK_MODE.HALF_DAY_LEAVE) {
    throw new Error("Break is not allowed for Half Day Leave");
  }
  if (found.row[ATTENDANCE_COL.breakStart]?.trim() && !found.row[ATTENDANCE_COL.breakEnd]?.trim()) {
    throw new Error("Already on break");
  }

  const rowValues = [...found.row];
  while (rowValues.length < ATTENDANCE_HEADERS.length) rowValues.push("");

  rowValues[ATTENDANCE_COL.breakStart] = formatClockTime(date);
  rowValues[ATTENDANCE_COL.breakEnd] = "";

  await updateAttendanceRow(targetSpreadsheetId, sheetTitle, found.sheetRow, rowValues);

  return rowFromValues(rowValues, found.sheetRow);
}

export async function endBreak(
  spreadsheetId: string,
  date: Date = new Date(),
): Promise<AttendanceRow> {
  const targetSpreadsheetId = await resolveSpreadsheetForDate(spreadsheetId, date);
  const sheetTitle = await ensureMonthlySheet(targetSpreadsheetId, date);
  const rows = await readMonthlyRows(targetSpreadsheetId, sheetTitle);
  const today = formatIsoDate(date);
  const found = findTodayRow(rows, today);

  if (!found?.row[ATTENDANCE_COL.breakStart]?.trim()) {
    throw new Error("No active break to end");
  }
  if (found.row[ATTENDANCE_COL.breakEnd]?.trim()) {
    throw new Error("No active break to end");
  }

  const rowValues = [...found.row];
  while (rowValues.length < ATTENDANCE_HEADERS.length) rowValues.push("");

  const breakEnd = formatClockTime(date);
  rowValues[ATTENDANCE_COL.breakEnd] = breakEnd;

  const breakStartMs = parseTimeOnDate(rowValues[ATTENDANCE_COL.breakStart], date);
  const breakEndMs = parseTimeOnDate(breakEnd, date);
  const breakMs =
    breakStartMs != null && breakEndMs != null && breakEndMs > breakStartMs
      ? breakEndMs - breakStartMs
      : 0;

  const existingBreakMs = parseDurationToMs(rowValues[ATTENDANCE_COL.totalBreakTime] ?? "");
  rowValues[ATTENDANCE_COL.totalBreakTime] = formatDuration(existingBreakMs + breakMs);
  rowValues[ATTENDANCE_COL.breakStart] = "";
  rowValues[ATTENDANCE_COL.breakEnd] = "";

  await updateAttendanceRow(targetSpreadsheetId, sheetTitle, found.sheetRow, rowValues);

  return rowFromValues(rowValues, found.sheetRow);
}

export async function getMonthAttendance(
  spreadsheetId: string,
  year: number,
  monthIndex: number,
): Promise<AttendanceRow[]> {
  const date = new Date(year, monthIndex, 1);
  const targetSpreadsheetId = await resolveSpreadsheetForDate(spreadsheetId, date);
  const sheetTitle = monthlySheetTitle(date);
  const sheetId = await getSheetId(targetSpreadsheetId, sheetTitle);
  if (sheetId == null) return [];

  const rows = await readMonthlyRows(targetSpreadsheetId, sheetTitle);
  const records: AttendanceRow[] = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i] ?? [];
    if (!(row[ATTENDANCE_COL.date] ?? "").trim()) continue;
    records.push(rowFromValues(row, i + 1));
  }

  return records;
}

export async function updateAttendanceField(
  spreadsheetId: string,
  dateIso: string,
  field: keyof typeof ATTENDANCE_COL,
  value: string,
): Promise<AttendanceRow> {
  const [year, month] = dateIso.split("-").map((p) => parseInt(p, 10));
  const date = new Date(year, (month || 1) - 1, 1);
  const targetSpreadsheetId = await resolveSpreadsheetForDate(spreadsheetId, date);
  const sheetTitle = monthlySheetTitle(date);
  const rows = await readMonthlyRows(targetSpreadsheetId, sheetTitle);
  const found = findTodayRow(rows, dateIso);

  if (!found) {
    throw new Error("Attendance record not found for correction date");
  }

  const rowValues = [...found.row];
  while (rowValues.length < ATTENDANCE_HEADERS.length) rowValues.push("");

  const col = ATTENDANCE_COL[field];
  rowValues[col] = value;

  if (rowValues[ATTENDANCE_COL.punchIn] && rowValues[ATTENDANCE_COL.punchOut]) {
    applyAttendanceMetrics(rowValues, new Date(dateIso));
  }

  await updateAttendanceRow(targetSpreadsheetId, sheetTitle, found.sheetRow, rowValues);

  return rowFromValues(rowValues, found.sheetRow);
}

export async function updateDailyUpdate(
  spreadsheetId: string,
  dateIso: string,
  dailyUpdate: string,
): Promise<AttendanceRow> {
  return updateAttendanceField(spreadsheetId, dateIso, "dailyUpdate", dailyUpdate.trim());
}

export async function updateOvertimeApproval(
  spreadsheetId: string,
  dateIso: string,
  overtimeApproval: string,
): Promise<AttendanceRow> {
  return updateAttendanceField(
    spreadsheetId,
    dateIso,
    "isOvertimeApproved",
    overtimeApproval.trim(),
  );
}

export async function importAttendanceRecords(
  spreadsheetId: string,
  records: Array<{
    dateIso: string;
    punchIn: string;
    punchOut: string;
    dailyUpdate?: string;
    workMode?: string;
  }>,
): Promise<{ imported: number; updated: number }> {
  const isHolidayMode = (mode: string): boolean => {
    const normalized = mode.trim().toLowerCase();
    return (
      normalized === WORK_MODE.WEEKEND_HOLIDAY.toLowerCase() ||
      normalized === WORK_MODE.PUBLIC_HOLIDAY.toLowerCase()
    );
  };
  const isLeaveMode = (mode: string): boolean => {
    const normalized = mode.trim().toLowerCase();
    return (
      normalized === WORK_MODE.FULL_DAY_LEAVE.toLowerCase() ||
      normalized === WORK_MODE.HALF_DAY_LEAVE.toLowerCase() ||
      normalized === WORK_MODE.HALF_DAY_PAID_LEAVE.toLowerCase() ||
      normalized === WORK_MODE.HALF_DAY_UNPAID_LEAVE.toLowerCase() ||
      normalized === WORK_MODE.PAID_LEAVE.toLowerCase() ||
      normalized === WORK_MODE.SICK_LEAVE.toLowerCase() ||
      normalized === WORK_MODE.CASUAL_LEAVE.toLowerCase() ||
      normalized === WORK_MODE.UNPAID_LEAVE.toLowerCase() ||
      normalized === WORK_MODE.SL.toLowerCase()
    );
  };
  let imported = 0;
  let updated = 0;
  if (!records.length) return { imported, updated };

  const grouped = new Map<string, { targetSpreadsheetId: string; records: typeof records }>();
  for (const record of records) {
    const [year, month] = record.dateIso.split("-");
    const yearNum = parseInt(year, 10);
    const targetSpreadsheetId = Number.isFinite(yearNum)
      ? await resolveYearSpreadsheetId(spreadsheetId, yearNum)
      : spreadsheetId;
    const key = `${targetSpreadsheetId}:${year}-${month}`;
    const group = grouped.get(key) ?? { targetSpreadsheetId, records: [] };
    const list = group.records;
    list.push(record);
    grouped.set(key, group);
  }

  const sheetsApi = await getSheetsClient();

  for (const group of grouped.values()) {
    const { targetSpreadsheetId, records: monthRecords } = group;
    const sampleDate = new Date(monthRecords[0].dateIso);
    const sheetTitle = await withQuotaRetry(() =>
      ensureMonthlySheet(targetSpreadsheetId, sampleDate),
    );
    const existingRows = await withQuotaRetry(() =>
      readMonthlyRows(targetSpreadsheetId, sheetTitle),
    );
    const rowIndexByDate = new Map<string, number>();
    for (let i = 1; i < existingRows.length; i++) {
      const dateIso = normalizeSheetDate(existingRows[i]?.[ATTENDANCE_COL.date] ?? "");
      if (dateIso) rowIndexByDate.set(dateIso, i + 1);
    }

    let nextRow = Math.max(existingRows.length + 1, 2);
    const data: Array<{ range: string; values: string[][] }> = [];
    for (const record of monthRecords) {
      const baseDate = new Date(record.dateIso);
      const existingSheetRow = rowIndexByDate.get(record.dateIso);
      const existing = existingSheetRow != null ? existingRows[existingSheetRow - 1] : undefined;
      const rowValues = buildRowValues(existing, baseDate);
      rowValues[ATTENDANCE_COL.workMode] =
        record.workMode?.trim() || rowValues[ATTENDANCE_COL.workMode] || WORK_MODE.FULL_DAY_ONSITE;
      rowValues[ATTENDANCE_COL.punchIn] = record.punchIn;
      rowValues[ATTENDANCE_COL.punchOut] = record.punchOut;
      rowValues[ATTENDANCE_COL.dailyUpdate] = record.dailyUpdate?.trim() ?? "";
      rowValues[ATTENDANCE_COL.breakStart] = "";
      rowValues[ATTENDANCE_COL.breakEnd] = "";
      rowValues[ATTENDANCE_COL.totalBreakTime] =
        rowValues[ATTENDANCE_COL.workMode] === WORK_MODE.HALF_DAY_LEAVE ? "" : IMPORT_DEFAULT_BREAK;

      const hasIn = record.punchIn.trim().length > 0;
      const hasOut = record.punchOut.trim().length > 0;
      const normalizedMode = rowValues[ATTENDANCE_COL.workMode] ?? "";
      if (isHolidayMode(normalizedMode)) {
        rowValues[ATTENDANCE_COL.breakStart] = "";
        rowValues[ATTENDANCE_COL.breakEnd] = "";
        rowValues[ATTENDANCE_COL.totalBreakTime] = "";
        rowValues[ATTENDANCE_COL.workingHours] = "";
        rowValues[ATTENDANCE_COL.status] = "";
        rowValues[ATTENDANCE_COL.overtime] = "";
      } else if (isLeaveMode(normalizedMode) && !hasIn && !hasOut) {
        rowValues[ATTENDANCE_COL.breakStart] = "";
        rowValues[ATTENDANCE_COL.breakEnd] = "";
        rowValues[ATTENDANCE_COL.totalBreakTime] = "";
        rowValues[ATTENDANCE_COL.workingHours] = "";
        rowValues[ATTENDANCE_COL.status] = WORKING_STATUS.ON_LEAVE;
        rowValues[ATTENDANCE_COL.overtime] = "";
      } else if (!hasIn && !hasOut) {
        rowValues[ATTENDANCE_COL.breakStart] = "";
        rowValues[ATTENDANCE_COL.breakEnd] = "";
        rowValues[ATTENDANCE_COL.totalBreakTime] = "";
        rowValues[ATTENDANCE_COL.workingHours] = "";
        rowValues[ATTENDANCE_COL.status] = "";
        rowValues[ATTENDANCE_COL.overtime] = "";
      } else if (hasOut) {
        applyAttendanceMetrics(rowValues, baseDate);
      } else {
        rowValues[ATTENDANCE_COL.overtime] = "—";
        rowValues[ATTENDANCE_COL.status] = WORKING_STATUS.IN_PROGRESS;
        rowValues[ATTENDANCE_COL.workingHours] = "";
      }

      const targetRow = existingSheetRow ?? nextRow++;
      data.push({
        range: `'${sheetTitle}'!A${targetRow}:${ATTENDANCE_LAST_COLUMN}${targetRow}`,
        values: [rowValues],
      });

      if (existingSheetRow != null) updated++;
      else imported++;
    }

    const maxTargetRow = data.reduce((max, entry) => {
      const match = entry.range.match(/!A(\d+):/);
      const row = match ? Number.parseInt(match[1], 10) : 0;
      return Math.max(max, row);
    }, 0);
    if (maxTargetRow > 0) {
      await withQuotaRetry(() => ensureSheetHasRows(targetSpreadsheetId, sheetTitle, maxTargetRow));
    }

    await withQuotaRetry(() =>
      sheetsApi.spreadsheets.values.batchUpdate({
        spreadsheetId: targetSpreadsheetId,
        requestBody: {
          valueInputOption: "USER_ENTERED",
          data,
        },
      }),
    );
  }

  for (const targetSpreadsheetId of new Set(grouped.values().map((g) => g.targetSpreadsheetId))) {
    await withQuotaRetry(() => formatAllAttendanceMonthlyHeaders(targetSpreadsheetId));
  }

  return { imported, updated };
}

export async function listAttendanceMonthlySheetsAcrossYears(
  spreadsheetId: string,
): Promise<string[]> {
  const spreadsheetIds = await listYearlySpreadsheetIds(spreadsheetId);
  const unique = new Set<string>();
  for (const targetSpreadsheetId of spreadsheetIds) {
    const titles = await listMonthlySheets(targetSpreadsheetId);
    for (const title of titles) unique.add(title);
  }
  return [...unique];
}

export function computeLiveWorkedMs(record: AttendanceRow, now: Date = new Date()): number {
  if (!record.punchIn.trim()) return 0;

  const baseDate = new Date(record.date);

  if (record.punchOut.trim()) {
    return computeAttendanceMetrics({
      punchIn: record.punchIn,
      punchOut: record.punchOut,
      totalBreakTime: record.totalBreakTime,
      baseDate,
      punchedOut: true,
      workMode: record.workMode,
    }).workingMs;
  }

  const punchInMs = parseSheetClockTime(record.punchIn, baseDate, { role: "in" });
  if (punchInMs == null) return 0;

  const skipBreak = record.workMode === WORK_MODE.HALF_DAY_LEAVE;
  let totalBreakMs = resolveLiveBreakMs(record.totalBreakTime, record.workMode, {
    inProgress: true,
  });

  if (!skipBreak && record.breakStart.trim() && !record.breakEnd.trim()) {
    const breakStartMs = parseSheetClockTime(record.breakStart, baseDate, {
      punchIn: record.punchIn,
      role: "out",
    });
    if (breakStartMs != null) {
      totalBreakMs += Math.max(0, now.getTime() - breakStartMs);
    }
  }

  return Math.max(0, now.getTime() - punchInMs - totalBreakMs);
}
