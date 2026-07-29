import { randomUUID } from "node:crypto";

import type { LeaveBucketType } from "@/lib/attendance/leave-bucket-layout";
import { listLeaveApplications, type LeaveApplication } from "@/lib/attendance/leave-approvals";
import {
  ABSENCE_EXPLANATION_HEADERS,
  ABSENCE_EXPLANATION_MIN_LENGTH,
  ABSENCE_EXPLANATION_SHEET_TITLE,
  WORKING_STATUS,
  canonicalizeWorkMode,
  isPunchOptionalWorkMode,
} from "@/lib/attendance/constants";
import type { AttendanceEmployeeContext } from "@/lib/attendance/employee";
import { LEAVE_STATUS } from "@/lib/attendance/leave-status";
import { localDateIso, leaveDateToIso } from "@/lib/payroll/leave-attendance";
import { isWeekend, toIsoDate } from "@/lib/payroll/working-days";
import { listCompanyHolidays } from "@/lib/company-holiday-sheets";
import { getMonthAttendance, type AttendanceRow } from "@/lib/google/attendance-sheets";
import { getSheetsClient } from "@/lib/google/drive-auth";
import { applySheetHeaderFormatByTitle } from "@/lib/google/sheet-format";

export type AbsenceReasonType = "today_no_punch" | "rejected_leave" | "unauthorized_absence";

export type AbsenceLeaveType = LeaveBucketType | "today" | "unauthorized";

export type PendingAbsenceEntry = {
  dateIso: string;
  leaveType: AbsenceLeaveType;
  leaveRowIndex: number;
  rejectReason: string;
  duration: string;
};

export type PendingAbsenceGroup = {
  id: string;
  reasonType: AbsenceReasonType;
  dateFromIso: string;
  dateToIso: string;
  dateLabel: string;
  entries: PendingAbsenceEntry[];
};

export type AbsenceExplanationRecord = PendingAbsenceEntry & {
  id: string;
  explanation: string;
  submittedAt: string;
};

const COL = {
  id: 0,
  date: 1,
  leaveType: 2,
  leaveRowIndex: 3,
  rejectReason: 4,
  explanation: 5,
  submittedAt: 6,
} as const;

/** How many calendar months of attendance to scan (current + previous). */
const ATTENDANCE_MONTHS_TO_SCAN = 3;

let holidayDatesCache: { expiresAt: number; dates: Set<string> } | null = null;
const HOLIDAY_CACHE_TTL_MS = 5 * 60_000;

function formatDisplayDate(dateIso: string): string {
  const [year, month, day] = dateIso.split("-").map(Number);
  if (!year || !month || !day) return dateIso;
  return `${day}/${month}/${year}`;
}

function formatDateRangeLabel(fromIso: string, toIso: string): string {
  const from = formatDisplayDate(fromIso);
  const to = formatDisplayDate(toIso);
  return fromIso === toIso ? from : `${from} - ${to}`;
}

function addDaysIso(dateIso: string, days: number): string {
  const date = new Date(`${dateIso}T12:00:00`);
  date.setDate(date.getDate() + days);
  return toIsoDate(date.getFullYear(), date.getMonth() + 1, date.getDate());
}

function wasAbsentOnDate(attendance: AttendanceRow | null): boolean {
  if (!attendance) return true;

  if (attendance.punchIn?.trim() || attendance.punchOut?.trim()) {
    return false;
  }

  const workMode = canonicalizeWorkMode(attendance.workMode);
  if (isPunchOptionalWorkMode(workMode)) {
    return false;
  }

  if (attendance.status.trim() === WORKING_STATUS.ON_LEAVE) {
    return false;
  }

  return true;
}

function hasActiveLeaveForDate(leaves: LeaveApplication[]): boolean {
  return leaves.some((leave) => {
    const status = leave.status.trim().toLowerCase();
    return (
      status === LEAVE_STATUS.ACCEPTED.toLowerCase() ||
      status === LEAVE_STATUS.APPLIED.toLowerCase()
    );
  });
}

async function getSheetId(spreadsheetId: string, title: string): Promise<number | null> {
  const sheetsApi = await getSheetsClient();
  const meta = await sheetsApi.spreadsheets.get({
    spreadsheetId,
    fields: "sheets.properties(sheetId,title)",
  });
  const normalized = title.trim().toLowerCase();
  const sheet = meta.data.sheets?.find(
    (entry) => (entry.properties?.title ?? "").trim().toLowerCase() === normalized,
  );
  return sheet?.properties?.sheetId ?? null;
}

async function ensureAbsenceExplanationSheet(spreadsheetId: string): Promise<void> {
  const sheetsApi = await getSheetsClient();
  const existingId = await getSheetId(spreadsheetId, ABSENCE_EXPLANATION_SHEET_TITLE);
  if (existingId != null) return;

  await sheetsApi.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          addSheet: {
            properties: { title: ABSENCE_EXPLANATION_SHEET_TITLE },
          },
        },
      ],
    },
  });

  await sheetsApi.spreadsheets.values.update({
    spreadsheetId,
    range: `'${ABSENCE_EXPLANATION_SHEET_TITLE}'!A1:G1`,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [ABSENCE_EXPLANATION_HEADERS as unknown as string[]],
    },
  });

  await applySheetHeaderFormatByTitle(
    spreadsheetId,
    ABSENCE_EXPLANATION_SHEET_TITLE,
    ABSENCE_EXPLANATION_HEADERS.length,
  );
}

async function readAbsenceExplanationRows(spreadsheetId: string): Promise<string[][]> {
  try {
    const sheetsApi = await getSheetsClient();
    const response = await sheetsApi.spreadsheets.values.get({
      spreadsheetId,
      range: `'${ABSENCE_EXPLANATION_SHEET_TITLE}'!A:G`,
    });
    return response.data.values ?? [];
  } catch {
    return [];
  }
}

function rowToRecord(row: string[]): AbsenceExplanationRecord | null {
  const dateIso = String(row[COL.date] ?? "").trim();
  const explanation = String(row[COL.explanation] ?? "").trim();
  if (!dateIso || !explanation) return null;

  const leaveType = String(row[COL.leaveType] ?? "").trim() as AbsenceLeaveType;
  const leaveRowIndex = Number.parseInt(String(row[COL.leaveRowIndex] ?? ""), 10);

  return {
    id: String(row[COL.id] ?? "").trim(),
    dateIso,
    leaveType,
    leaveRowIndex: Number.isFinite(leaveRowIndex) ? leaveRowIndex : 0,
    rejectReason: String(row[COL.rejectReason] ?? "").trim(),
    duration: "",
    explanation,
    submittedAt: String(row[COL.submittedAt] ?? "").trim(),
  };
}

export async function listAbsenceExplanations(
  attendanceSpreadsheetId: string,
): Promise<AbsenceExplanationRecord[]> {
  const rows = await readAbsenceExplanationRows(attendanceSpreadsheetId);
  const records: AbsenceExplanationRecord[] = [];

  for (let i = 1; i < rows.length; i++) {
    const record = rowToRecord(rows[i] ?? []);
    if (record) records.push(record);
  }

  return records;
}

async function getLeaveHolidayDates(): Promise<Set<string>> {
  if (holidayDatesCache && Date.now() < holidayDatesCache.expiresAt) {
    return holidayDatesCache.dates;
  }

  const holidays = await listCompanyHolidays();
  const dates = new Set(
    holidays.filter((holiday) => holiday.type === "leave").map((holiday) => holiday.date),
  );
  holidayDatesCache = { dates, expiresAt: Date.now() + HOLIDAY_CACHE_TTL_MS };
  return dates;
}

function isScheduledWorkingDay(dateIso: string, leaveHolidayDates: Set<string>): boolean {
  const [year, month, day] = dateIso.split("-").map(Number);
  if (!year || !month || !day) return false;
  if (isWeekend(year, month, day)) return false;
  return !leaveHolidayDates.has(dateIso);
}

function listPastWorkingDates(
  untilDateExclusive: string,
  leaveHolidayDates: Set<string>,
): string[] {
  const end = new Date(`${untilDateExclusive}T12:00:00`);
  const start = new Date(end.getFullYear(), end.getMonth() - (ATTENDANCE_MONTHS_TO_SCAN - 1), 1);

  const dates: string[] = [];
  for (let cursor = new Date(start); ; cursor.setDate(cursor.getDate() + 1)) {
    const iso = toIsoDate(cursor.getFullYear(), cursor.getMonth() + 1, cursor.getDate());
    if (iso >= untilDateExclusive) break;
    if (isScheduledWorkingDay(iso, leaveHolidayDates)) {
      dates.push(iso);
    }
  }

  return dates;
}

async function buildAttendanceByDate(
  spreadsheetId: string,
  todayIso: string,
): Promise<Map<string, AttendanceRow>> {
  const today = new Date(`${todayIso}T12:00:00`);
  const monthKeys: Array<{ year: number; monthIndex: number }> = [];

  for (let offset = 0; offset < ATTENDANCE_MONTHS_TO_SCAN; offset += 1) {
    const date = new Date(today.getFullYear(), today.getMonth() - offset, 1);
    monthKeys.push({ year: date.getFullYear(), monthIndex: date.getMonth() });
  }

  const monthRows = await Promise.all(
    monthKeys.map(({ year, monthIndex }) => getMonthAttendance(spreadsheetId, year, monthIndex)),
  );

  const byDate = new Map<string, AttendanceRow>();
  for (const rows of monthRows) {
    for (const row of rows) {
      if (row.date) {
        byDate.set(row.date, row);
      }
    }
  }

  return byDate;
}

function buildLeavesByDate(applications: LeaveApplication[]): Map<string, LeaveApplication[]> {
  const leavesByDate = new Map<string, LeaveApplication[]>();

  for (const application of applications) {
    const dateIso = leaveDateToIso(application.date);
    if (!dateIso) continue;
    const existing = leavesByDate.get(dateIso) ?? [];
    existing.push(application);
    leavesByDate.set(dateIso, existing);
  }

  return leavesByDate;
}

function previousWorkingDay(dateIso: string, leaveHolidayDates: Set<string>): string | null {
  let cursor = addDaysIso(dateIso, -1);
  for (let step = 0; step < 14; step += 1) {
    if (isScheduledWorkingDay(cursor, leaveHolidayDates)) {
      return cursor;
    }
    cursor = addDaysIso(cursor, -1);
  }
  return null;
}

type PastAbsenceEntry = PendingAbsenceEntry & {
  reasonType: Exclude<AbsenceReasonType, "today_no_punch">;
};

function collectLatestAbsenceEpisode(
  entriesByDate: Map<string, PastAbsenceEntry>,
  leaveHolidayDates: Set<string>,
): PastAbsenceEntry[] {
  if (entriesByDate.size === 0) return [];

  const latestDate = [...entriesByDate.keys()].sort().at(-1);
  if (!latestDate) return [];

  const episode: PastAbsenceEntry[] = [entriesByDate.get(latestDate)!];
  let cursor = previousWorkingDay(latestDate, leaveHolidayDates);

  while (cursor && entriesByDate.has(cursor)) {
    episode.unshift(entriesByDate.get(cursor)!);
    cursor = previousWorkingDay(cursor, leaveHolidayDates);
  }

  return episode;
}

function buildPastEpisodeGroup(entries: PastAbsenceEntry[]): PendingAbsenceGroup {
  const fromIso = entries[0].dateIso;
  const toIso = entries[entries.length - 1].dateIso;
  const allRejected = entries.every((entry) => entry.reasonType === "rejected_leave");
  const reasonType: AbsenceReasonType = allRejected ? "rejected_leave" : "unauthorized_absence";

  return {
    id: `${reasonType}:${fromIso}:${toIso}`,
    reasonType,
    dateFromIso: fromIso,
    dateToIso: toIso,
    dateLabel: formatDateRangeLabel(fromIso, toIso),
    entries: entries.map((entry) => ({
      dateIso: entry.dateIso,
      leaveType: entry.leaveType,
      leaveRowIndex: entry.leaveRowIndex,
      rejectReason: entry.rejectReason,
      duration: entry.duration,
    })),
  };
}

function buildSingleGroup(params: {
  reasonType: AbsenceReasonType;
  entry: PendingAbsenceEntry;
}): PendingAbsenceGroup {
  const { entry, reasonType } = params;
  const suffix =
    reasonType === "today_no_punch" ? "today" : `${entry.leaveType}:${entry.leaveRowIndex}`;
  return {
    id: `${reasonType}:${entry.dateIso}:${suffix}`,
    reasonType,
    dateFromIso: entry.dateIso,
    dateToIso: entry.dateIso,
    dateLabel: formatDisplayDate(entry.dateIso),
    entries: [entry],
  };
}

export async function getPendingAbsenceExplanationGroups(
  employee: AttendanceEmployeeContext,
): Promise<PendingAbsenceGroup[]> {
  const todayIso = localDateIso();
  const leaveHolidayDates = await getLeaveHolidayDates();

  const [allLeaves, explanations, attendanceByDate] = await Promise.all([
    listLeaveApplications({
      employeeId: employee.employeeId,
      employeeName: employee.employeeName,
      attendanceSpreadsheetId: employee.attendanceSpreadsheetId,
    }),
    listAbsenceExplanations(employee.attendanceSpreadsheetId),
    buildAttendanceByDate(employee.attendanceSpreadsheetId, todayIso),
  ]);

  const leavesByDate = buildLeavesByDate(allLeaves);
  const explainedDates = new Set(explanations.map((record) => record.dateIso));

  const groups: PendingAbsenceGroup[] = [];
  const allPastAbsenceByDate = new Map<string, PastAbsenceEntry>();

  if (isScheduledWorkingDay(todayIso, leaveHolidayDates) && !explainedDates.has(todayIso)) {
    const todayLeaves = leavesByDate.get(todayIso) ?? [];
    const todayAttendance = attendanceByDate.get(todayIso) ?? null;

    if (
      !hasActiveLeaveForDate(todayLeaves) &&
      !todayAttendance?.punchIn?.trim() &&
      wasAbsentOnDate(todayAttendance)
    ) {
      groups.push(
        buildSingleGroup({
          reasonType: "today_no_punch",
          entry: {
            dateIso: todayIso,
            leaveType: "today",
            leaveRowIndex: 0,
            rejectReason: "",
            duration: "",
          },
        }),
      );
    }
  }

  for (const leave of allLeaves) {
    if (leave.status.trim().toLowerCase() !== LEAVE_STATUS.REJECTED.toLowerCase()) {
      continue;
    }

    const dateIso = leaveDateToIso(leave.date);
    if (!dateIso || dateIso >= todayIso) continue;
    if (!isScheduledWorkingDay(dateIso, leaveHolidayDates)) continue;

    const attendance = attendanceByDate.get(dateIso) ?? null;
    if (!wasAbsentOnDate(attendance)) continue;

    allPastAbsenceByDate.set(dateIso, {
      dateIso,
      leaveType: leave.leaveType,
      leaveRowIndex: leave.rowIndex,
      rejectReason: leave.rejectReason,
      duration: leave.duration,
      reasonType: "rejected_leave",
    });
  }

  for (const dateIso of listPastWorkingDates(todayIso, leaveHolidayDates)) {
    if (allPastAbsenceByDate.has(dateIso)) continue;

    const dayLeaves = leavesByDate.get(dateIso) ?? [];
    if (dayLeaves.length > 0) continue;

    const attendance = attendanceByDate.get(dateIso) ?? null;
    if (!wasAbsentOnDate(attendance)) continue;

    allPastAbsenceByDate.set(dateIso, {
      dateIso,
      leaveType: "unauthorized",
      leaveRowIndex: 0,
      rejectReason: "",
      duration: "",
      reasonType: "unauthorized_absence",
    });
  }

  const latestEpisode = collectLatestAbsenceEpisode(allPastAbsenceByDate, leaveHolidayDates).filter(
    (entry) => entry.dateIso < todayIso,
  );
  const latestEpisodeNeedsExplanation =
    latestEpisode.length > 0 && latestEpisode.some((entry) => !explainedDates.has(entry.dateIso));

  if (latestEpisodeNeedsExplanation) {
    groups.push(buildPastEpisodeGroup(latestEpisode));
  }

  return groups.sort((a, b) => a.dateFromIso.localeCompare(b.dateFromIso));
}

export async function userRequiresAbsenceExplanation(
  employee: AttendanceEmployeeContext,
): Promise<boolean> {
  const groups = await getPendingAbsenceExplanationGroups(employee);
  return groups.length > 0;
}

export async function submitAbsenceExplanations(params: {
  employee: AttendanceEmployeeContext;
  submissions: Array<{
    groupId: string;
    explanation: string;
  }>;
}): Promise<void> {
  const pendingGroups = await getPendingAbsenceExplanationGroups(params.employee);
  const pendingById = new Map(pendingGroups.map((group) => [group.id, group]));

  const rowsToAppend: string[][] = [];
  const submittedAt = new Date().toISOString();

  for (const submission of params.submissions) {
    const explanation = submission.explanation.trim();
    if (explanation.length < ABSENCE_EXPLANATION_MIN_LENGTH) {
      throw new Error(`Explanation must be at least ${ABSENCE_EXPLANATION_MIN_LENGTH} characters`);
    }

    const group = pendingById.get(submission.groupId);
    if (!group) {
      throw new Error("No pending absence explanation for the selected period");
    }

    for (const entry of group.entries) {
      rowsToAppend.push([
        randomUUID(),
        entry.dateIso,
        entry.leaveType,
        String(entry.leaveRowIndex),
        entry.rejectReason,
        explanation,
        submittedAt,
      ]);
    }
  }

  if (rowsToAppend.length === 0) {
    throw new Error("No absence explanations to submit");
  }

  await ensureAbsenceExplanationSheet(params.employee.attendanceSpreadsheetId);
  const sheetsApi = await getSheetsClient();
  await sheetsApi.spreadsheets.values.append({
    spreadsheetId: params.employee.attendanceSpreadsheetId,
    range: `'${ABSENCE_EXPLANATION_SHEET_TITLE}'!A:G`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: rowsToAppend },
  });
}
