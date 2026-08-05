import { randomUUID } from "node:crypto";

import type { LeaveBucketType } from "@/lib/attendance/leave-bucket-layout";
import {
  listLeaveApplicationsFromRows,
  type LeaveApplication,
} from "@/lib/attendance/leave-approvals";
import {
  ABSENCE_EXPLANATION_HEADERS,
  ABSENCE_EXPLANATION_MIN_LENGTH,
  ABSENCE_EXPLANATION_SHEET_TITLE,
  WORKING_STATUS,
  canonicalizeWorkMode,
  isPunchOptionalWorkMode,
} from "@/lib/attendance/constants";
import type { AttendanceEmployeeContext } from "@/lib/attendance/employee";
import { getAttendanceRepository } from "@/lib/attendance/repository";
import { LEAVE_STATUS } from "@/lib/attendance/leave-status";
import {
  allocateLeaveDates,
  countLeaveBucketUsage,
  getLeavePolicyBalances,
  groupAssignmentsByBucket,
} from "@/lib/attendance/leave-policy";
import { type AttendanceRow } from "@/lib/google/attendance-sheets";
import {
  addGroupedLeaveDatesToBucketForAbsenceExplanation,
  readLeaveBucketRowsForAbsenceExplanation,
} from "@/lib/attendance/leave-bucket-mirror";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { isFirebaseDailyStorage } from "@/lib/storage/backend";
import { isAfterTodayNoPunchExplainCutoff } from "@/lib/attendance/attendance-cutoffs";
import { formatIsoDateRange } from "@/lib/notifications/format";
import { notifyLeaveSubmitted } from "@/lib/notifications/leave-events";
import { localDateIso, leaveDateToIso } from "@/lib/payroll/leave-attendance";
import { isWeekend, toIsoDate } from "@/lib/payroll/working-days";
import { listCompanyHolidays } from "@/lib/company-holiday-sheets";
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
  /** Sick/casual options when this unauthorized absence can be filed as leave. */
  leaveTypeOptions?: Array<"sick" | "casual">;
};

export type AbsenceLeaveBalances = {
  sickAvailable: number;
  casualAvailable: number;
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

function absenceExplanationsCollection(employeeId: string) {
  return getAdminFirestore()
    .collection("attendance")
    .doc(employeeId)
    .collection("absence_explanations");
}

const absenceBootstrapPromises = new Map<string, Promise<void>>();

async function ensureAbsenceExplanationsBootstrapped(
  employee: AttendanceEmployeeContext,
): Promise<void> {
  if (!isFirebaseDailyStorage()) return;

  const key = employee.employeeId;
  const existing = absenceBootstrapPromises.get(key);
  if (existing) return existing;

  const promise = (async () => {
    const collection = absenceExplanationsCollection(employee.employeeId);
    const snap = await collection.limit(1).get();
    if (!snap.empty) return;

    const spreadsheetId = employee.attendanceSpreadsheetId.trim();
    if (!spreadsheetId) return;

    const rows = await readAbsenceExplanationRows(spreadsheetId);
    if (rows.length < 2) return;

    const batch = getAdminFirestore().batch();
    for (let i = 1; i < rows.length; i++) {
      const record = rowToRecord(rows[i] ?? []);
      if (!record?.id) continue;
      batch.set(collection.doc(record.id), record);
    }
    await batch.commit();
  })().finally(() => {
    absenceBootstrapPromises.delete(key);
  });

  absenceBootstrapPromises.set(key, promise);
  return promise;
}

async function listAbsenceExplanationsFirestore(
  employee: AttendanceEmployeeContext,
): Promise<AbsenceExplanationRecord[]> {
  await ensureAbsenceExplanationsBootstrapped(employee);
  const snap = await absenceExplanationsCollection(employee.employeeId).get();
  const records: AbsenceExplanationRecord[] = [];

  for (const doc of snap.docs) {
    const data = doc.data() as AbsenceExplanationRecord;
    if (data.dateIso && data.explanation) {
      records.push({ ...data, id: data.id || doc.id });
    }
  }

  return records;
}

async function appendAbsenceExplanationsFirestore(
  employee: AttendanceEmployeeContext,
  rowsToAppend: string[][],
): Promise<void> {
  const batch = getAdminFirestore().batch();
  const collection = absenceExplanationsCollection(employee.employeeId);

  for (const row of rowsToAppend) {
    const id = String(row[COL.id] ?? "").trim() || randomUUID();
    const record: AbsenceExplanationRecord = {
      id,
      dateIso: String(row[COL.date] ?? "").trim(),
      leaveType: String(row[COL.leaveType] ?? "").trim() as AbsenceLeaveType,
      leaveRowIndex: Number.parseInt(String(row[COL.leaveRowIndex] ?? ""), 10) || 0,
      rejectReason: String(row[COL.rejectReason] ?? "").trim(),
      duration: "",
      explanation: String(row[COL.explanation] ?? "").trim(),
      submittedAt: String(row[COL.submittedAt] ?? "").trim(),
    };
    batch.set(collection.doc(id), record);
  }

  await batch.commit();
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
  employee: AttendanceEmployeeContext,
): Promise<AbsenceExplanationRecord[]> {
  if (isFirebaseDailyStorage()) {
    return listAbsenceExplanationsFirestore(employee);
  }

  const rows = await readAbsenceExplanationRows(employee.attendanceSpreadsheetId);
  const records: AbsenceExplanationRecord[] = [];

  for (let i = 1; i < rows.length; i++) {
    const record = rowToRecord(rows[i] ?? []);
    if (record) records.push(record);
  }

  return records;
}

function isDateInCurrentQuarter(dateIso: string, asOfDate: Date = new Date()): boolean {
  const date = new Date(`${dateIso}T12:00:00`);
  if (Number.isNaN(date.getTime())) return false;
  return (
    date.getFullYear() === asOfDate.getFullYear() &&
    Math.floor(date.getMonth() / 3) === Math.floor(asOfDate.getMonth() / 3)
  );
}

function resolveLeaveTypeOptions(
  group: PendingAbsenceGroup,
  balances: AbsenceLeaveBalances,
): Array<"sick" | "casual"> {
  if (group.reasonType !== "unauthorized_absence" && group.reasonType !== "today_no_punch") {
    return [];
  }

  // Show sick/casual whenever this quarter still has balance.
  const options: Array<"sick" | "casual"> = [];
  if (balances.sickAvailable > 0) options.push("sick");
  if (balances.casualAvailable > 0) options.push("casual");
  return options;
}

export async function getAbsenceLeaveBalances(
  attendanceSpreadsheetId: string,
): Promise<AbsenceLeaveBalances> {
  const rows = await readLeaveBucketRowsForAbsenceExplanation(attendanceSpreadsheetId);
  const balances = getLeavePolicyBalances(rows);
  return {
    sickAvailable: balances.sick.available,
    casualAvailable: balances.casual.available,
  };
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

function currentQuarterStartIso(asOfDate: Date = new Date()): string {
  const year = asOfDate.getFullYear();
  const quarter = Math.floor(asOfDate.getMonth() / 3);
  return toIsoDate(year, quarter * 3 + 1, 1);
}

function listPastWorkingDates(
  untilDateExclusive: string,
  leaveHolidayDates: Set<string>,
  options?: { fromDateInclusive?: string },
): string[] {
  const end = new Date(`${untilDateExclusive}T12:00:00`);
  const defaultStart = new Date(
    end.getFullYear(),
    end.getMonth() - (ATTENDANCE_MONTHS_TO_SCAN - 1),
    1,
  );
  const start = options?.fromDateInclusive
    ? new Date(`${options.fromDateInclusive}T12:00:00`)
    : defaultStart;

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
  employee: AttendanceEmployeeContext,
  todayIso: string,
): Promise<Map<string, AttendanceRow>> {
  const today = new Date(`${todayIso}T12:00:00`);
  const monthKeys: Array<{ year: number; monthIndex: number }> = [];

  for (let offset = 0; offset < ATTENDANCE_MONTHS_TO_SCAN; offset += 1) {
    const date = new Date(today.getFullYear(), today.getMonth() - offset, 1);
    monthKeys.push({ year: date.getFullYear(), monthIndex: date.getMonth() });
  }

  const repo = getAttendanceRepository();
  const ref = {
    employeeId: employee.employeeId,
    spreadsheetId: employee.attendanceSpreadsheetId,
  };

  const monthRows = await Promise.all(
    monthKeys.map(({ year, monthIndex }) => repo.getMonthAttendance(ref, year, monthIndex)),
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
  const asOfDate = new Date(`${todayIso}T12:00:00`);
  const quarterStartIso = currentQuarterStartIso(asOfDate);
  const leaveHolidayDates = await getLeaveHolidayDates();

  const [leaveRows, explanations, attendanceByDate] = await Promise.all([
    readLeaveBucketRowsForAbsenceExplanation(employee.attendanceSpreadsheetId),
    listAbsenceExplanations(employee),
    buildAttendanceByDate(employee, todayIso),
  ]);

  const allLeaves = listLeaveApplicationsFromRows({
    rows: leaveRows,
    employeeId: employee.employeeId,
    employeeName: employee.employeeName,
    attendanceSpreadsheetId: employee.attendanceSpreadsheetId,
  });

  const leaveBalances = {
    sickAvailable: getLeavePolicyBalances(leaveRows).sick.available,
    casualAvailable: getLeavePolicyBalances(leaveRows).casual.available,
  };

  const leavesByDate = buildLeavesByDate(allLeaves);
  const explainedDates = new Set(explanations.map((record) => record.dateIso));

  const groups: PendingAbsenceGroup[] = [];
  const allPastAbsenceByDate = new Map<string, PastAbsenceEntry>();

  // Today’s “not punched in” prompt only after 12:30 PM IST — before that, show punch-in UI.
  if (
    isAfterTodayNoPunchExplainCutoff() &&
    isScheduledWorkingDay(todayIso, leaveHolidayDates) &&
    !explainedDates.has(todayIso)
  ) {
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

  // Past unauthorized / rejected gaps are limited to the current leave quarter
  // (Jan–Mar, Apr–Jun, Jul–Sep, Oct–Dec), matching sick/casual allocation.
  for (const leave of allLeaves) {
    if (leave.status.trim().toLowerCase() !== LEAVE_STATUS.REJECTED.toLowerCase()) {
      continue;
    }

    const dateIso = leaveDateToIso(leave.date);
    if (!dateIso || dateIso >= todayIso || dateIso < quarterStartIso) continue;
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

  for (const dateIso of listPastWorkingDates(todayIso, leaveHolidayDates, {
    fromDateInclusive: quarterStartIso,
  })) {
    if (allPastAbsenceByDate.has(dateIso)) continue;

    const dayLeaves = leavesByDate.get(dateIso) ?? [];
    // Only Applied/Accepted leave covers an unauthorized absence. Rejected leave
    // is handled above; blank/other rows must not hide a real gap.
    if (hasActiveLeaveForDate(dayLeaves)) continue;

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
    (entry) => entry.dateIso < todayIso && entry.dateIso >= quarterStartIso,
  );
  const latestEpisodeNeedsExplanation =
    latestEpisode.length > 0 && latestEpisode.some((entry) => !explainedDates.has(entry.dateIso));

  if (latestEpisodeNeedsExplanation) {
    groups.push(buildPastEpisodeGroup(latestEpisode));
  }

  return groups
    .map((group) => ({
      ...group,
      leaveTypeOptions: resolveLeaveTypeOptions(group, leaveBalances),
    }))
    .sort((a, b) => a.dateFromIso.localeCompare(b.dateFromIso));
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
    leaveType?: "sick" | "casual";
    reasonType?: AbsenceReasonType;
    dateFromIso?: string;
    dateToIso?: string;
    entryDates?: string[];
  }>;
}): Promise<void> {
  const pendingGroups = await getPendingAbsenceExplanationGroups(params.employee);
  const pendingById = new Map(pendingGroups.map((group) => [group.id, group]));
  const existingExplanations = await listAbsenceExplanations(params.employee);
  const explainedDates = new Set(existingExplanations.map((record) => record.dateIso));

  const rowsToAppend: string[][] = [];
  const submittedAt = new Date().toISOString();

  for (const submission of params.submissions) {
    const explanation = submission.explanation.trim();
    if (explanation.length < ABSENCE_EXPLANATION_MIN_LENGTH) {
      throw new Error(`Explanation must be at least ${ABSENCE_EXPLANATION_MIN_LENGTH} characters`);
    }

    const group = resolveSubmissionGroup(submission, pendingById);
    if (!group) {
      throw new Error("No pending absence explanation for the selected period");
    }

    const balances = await getAbsenceLeaveBalances(params.employee.attendanceSpreadsheetId);
    const leaveTypeOptions = group.leaveTypeOptions ?? resolveLeaveTypeOptions(group, balances);
    const requestedLeaveType = submission.leaveType;

    if (
      (group.reasonType === "unauthorized_absence" || group.reasonType === "today_no_punch") &&
      requestedLeaveType
    ) {
      if (
        leaveTypeOptions.length > 0 &&
        !leaveTypeOptions.includes(requestedLeaveType) &&
        balances.sickAvailable <= 0 &&
        balances.casualAvailable <= 0
      ) {
        // Balance already consumed by a prior attempt — continue with explanation only.
      } else {
        await createLeaveRequestFromAbsenceGroup({
          employee: params.employee,
          group,
          leaveType: requestedLeaveType,
          reason: explanation,
        });
      }
    } else if (group.reasonType === "unauthorized_absence" && leaveTypeOptions.length > 0) {
      throw new Error("Select sick or casual leave for this absence");
    }

    const recordedLeaveType = requestedLeaveType ?? group.entries[0]?.leaveType ?? "unauthorized";

    for (const entry of group.entries) {
      if (explainedDates.has(entry.dateIso)) continue;
      explainedDates.add(entry.dateIso);
      rowsToAppend.push([
        randomUUID(),
        entry.dateIso,
        recordedLeaveType,
        String(entry.leaveRowIndex),
        entry.rejectReason,
        explanation,
        submittedAt,
      ]);
    }
  }

  if (rowsToAppend.length === 0) {
    // All dates were already explained (e.g. retry after a partial success).
    return;
  }

  if (isFirebaseDailyStorage()) {
    await appendAbsenceExplanationsFirestore(params.employee, rowsToAppend);
    return;
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

function parseAbsenceGroupId(groupId: string): {
  reasonType: AbsenceReasonType;
  dateFromIso: string;
  dateToIso: string;
} | null {
  const todayMatch = groupId.match(/^(today_no_punch):(\d{4}-\d{2}-\d{2}):today$/);
  if (todayMatch) {
    return {
      reasonType: "today_no_punch",
      dateFromIso: todayMatch[2],
      dateToIso: todayMatch[2],
    };
  }

  const rangeMatch = groupId.match(
    /^(unauthorized_absence|rejected_leave):(\d{4}-\d{2}-\d{2}):(\d{4}-\d{2}-\d{2})$/,
  );
  if (rangeMatch) {
    return {
      reasonType: rangeMatch[1] as AbsenceReasonType,
      dateFromIso: rangeMatch[2],
      dateToIso: rangeMatch[3],
    };
  }

  return null;
}

function resolveSubmissionGroup(
  submission: {
    groupId: string;
    reasonType?: AbsenceReasonType;
    dateFromIso?: string;
    dateToIso?: string;
    entryDates?: string[];
  },
  pendingById: Map<string, PendingAbsenceGroup>,
): PendingAbsenceGroup | null {
  const direct = pendingById.get(submission.groupId);
  if (direct) return direct;

  const parsed = parseAbsenceGroupId(submission.groupId);
  const reasonType = submission.reasonType ?? parsed?.reasonType;
  const dateFromIso = submission.dateFromIso ?? parsed?.dateFromIso;
  const dateToIso = submission.dateToIso ?? parsed?.dateToIso;
  if (!reasonType || !dateFromIso || !dateToIso) return null;

  for (const group of pendingById.values()) {
    if (
      group.reasonType === reasonType &&
      group.dateFromIso === dateFromIso &&
      group.dateToIso === dateToIso
    ) {
      return group;
    }
  }

  const entryDates =
    submission.entryDates && submission.entryDates.length > 0
      ? submission.entryDates
      : dateFromIso === dateToIso
        ? [dateFromIso]
        : null;

  if (!entryDates?.length) return null;

  return {
    id: submission.groupId,
    reasonType,
    dateFromIso,
    dateToIso,
    dateLabel: formatDateRangeLabel(dateFromIso, dateToIso),
    leaveTypeOptions: reasonType === "unauthorized_absence" ? undefined : [],
    entries: entryDates.map((dateIso) => ({
      dateIso,
      leaveType:
        reasonType === "today_no_punch"
          ? "today"
          : reasonType === "unauthorized_absence"
            ? "unauthorized"
            : "unauthorized",
      leaveRowIndex: 0,
      rejectReason: "",
      duration: "",
    })),
  };
}

async function createLeaveRequestFromAbsenceGroup(params: {
  employee: AttendanceEmployeeContext;
  group: PendingAbsenceGroup;
  leaveType: "sick" | "casual";
  reason: string;
}): Promise<void> {
  const { employee, group, leaveType, reason } = params;
  const rows = await readLeaveBucketRowsForAbsenceExplanation(employee.attendanceSpreadsheetId);
  const existingLeaves = listLeaveApplicationsFromRows({
    rows,
    employeeId: employee.employeeId,
    employeeName: employee.employeeName,
    attendanceSpreadsheetId: employee.attendanceSpreadsheetId,
  });
  const usage = countLeaveBucketUsage(rows);
  const asOfDate = new Date();
  const leavesByDate = buildLeavesByDate(existingLeaves);

  const currentQuarterDates: Date[] = [];
  const outsideQuarterDates: Date[] = [];

  for (const entry of group.entries) {
    // Skip days that already have Applied/Accepted leave from a prior attempt.
    if (hasActiveLeaveForDate(leavesByDate.get(entry.dateIso) ?? [])) {
      continue;
    }

    const date = new Date(`${entry.dateIso}T12:00:00`);
    if (Number.isNaN(date.getTime())) {
      throw new Error("Invalid absence date for leave request");
    }
    if (isDateInCurrentQuarter(entry.dateIso, asOfDate)) {
      currentQuarterDates.push(date);
    } else {
      outsideQuarterDates.push(date);
    }
  }

  const leaveGroups: Array<{ leaveType: LeaveBucketType; dates: Date[] }> = [];

  if (currentQuarterDates.length > 0) {
    const { assignments, error } = allocateLeaveDates({
      leaveType,
      dates: currentQuarterDates,
      duration: "full",
      usage,
      rows,
      asOfDate,
    });

    if (error) {
      throw new Error(error);
    }

    for (const [bucket, dates] of groupAssignmentsByBucket(assignments)) {
      leaveGroups.push({ leaveType: bucket, dates });
    }
  }

  if (outsideQuarterDates.length > 0) {
    leaveGroups.push({ leaveType: "unpaid", dates: outsideQuarterDates });
  }

  // Nothing left to file — prior attempt already covered these dates.
  if (leaveGroups.length === 0) {
    return;
  }

  await addGroupedLeaveDatesToBucketForAbsenceExplanation(
    employee.attendanceSpreadsheetId,
    leaveGroups,
    "full",
    reason,
  );

  const dateRange = formatIsoDateRange(group.dateFromIso, group.dateToIso);
  const requestId = `AE-${Date.now()}`;
  const unpaidDays = leaveGroups
    .filter((entry) => entry.leaveType === "unpaid")
    .reduce((sum, entry) => sum + entry.dates.length, 0);
  const primaryDays = leaveGroups
    .filter((entry) => entry.leaveType === leaveType)
    .reduce((sum, entry) => sum + entry.dates.length, 0);

  try {
    const notified = await notifyLeaveSubmitted({
      employeeSheetRow: employee.sheetRow,
      employeeId: employee.employeeId,
      employeeName: employee.employeeName,
      leaveType,
      dateRange,
      reason:
        unpaidDays > 0
          ? `${reason} (${primaryDays} ${leaveType} day(s); ${unpaidDays} unpaid day(s) due to balance/quarter rules)`
          : reason,
      applicationId: `${employee.attendanceSpreadsheetId}:${group.dateFromIso}:${group.dateToIso}:${leaveType}:${requestId}`,
      source: "absence_explanation",
    });
    if (notified === 0) {
      console.warn(
        `Absence leave submit produced no new notifications for ${employee.employeeId} (${dateRange}).`,
      );
    }
  } catch (notifyError) {
    console.error("Absence leave submit notification error:", notifyError);
  }
}
