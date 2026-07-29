import { getAttendanceSpreadsheetIdFromRow } from "@/lib/attendance/employee";
import { listLeaveApplications, type LeaveApplication } from "@/lib/attendance/leave-approvals";
import { LEAVE_STATUS } from "@/lib/attendance/leave-status";
import { roleCanPunchInOut } from "@/lib/attendance/absence-gate";
import {
  WORKING_STATUS,
  canonicalizeWorkMode,
  isPunchOptionalWorkMode,
} from "@/lib/attendance/constants";
import { listCompanyHolidays } from "@/lib/company-holiday-sheets";
import {
  getEmployeeIdFromRow,
  getSheetHeaders,
  isEmployeeStatusActive,
  sheetRowToForm,
} from "@/lib/employee";
import { getMonthAttendance, type AttendanceRow } from "@/lib/google/attendance-sheets";
import { EMPLOYEE_SHEET_RANGE, readSheet } from "@/lib/google/sheets";
import { leaveDateToIso } from "@/lib/payroll/leave-attendance";
import { isWeekend } from "@/lib/payroll/working-days";

export type UnapprovedAbsenceReason = "no_punch" | "pending_leave" | "rejected_leave";

export type UnapprovedAbsenceEmployee = {
  id: string;
  employeeSheetRow: number;
  employeeId: string;
  employeeName: string;
  reason: UnapprovedAbsenceReason;
  reasonLabel: string;
  leaveType: string;
  duration: string;
  date: string;
};

type CachedUnapprovedAbsence = {
  expiresAt: number;
  value: UnapprovedAbsenceEmployee[];
};

const CACHE_TTL_MS = 60_000;
const unapprovedAbsenceCache = new Map<string, CachedUnapprovedAbsence>();
const unapprovedAbsenceRequests = new Map<string, Promise<UnapprovedAbsenceEmployee[]>>();

let holidayDatesCache: { expiresAt: number; dates: Set<string> } | null = null;
const HOLIDAY_CACHE_TTL_MS = 5 * 60_000;

const REASON_LABELS: Record<UnapprovedAbsenceReason, string> = {
  no_punch: "No punch-in",
  pending_leave: "Leave pending approval",
  rejected_leave: "Leave rejected",
};

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

async function getAttendanceForDate(
  spreadsheetId: string,
  dateIso: string,
): Promise<AttendanceRow | null> {
  const [year, month, day] = dateIso.split("-").map(Number);
  if (!year || !month || !day) return null;

  const rows = await getMonthAttendance(spreadsheetId, year, month - 1);
  return rows.find((row) => row.date === dateIso) ?? null;
}

function leavesForDate(applications: LeaveApplication[], dateIso: string): LeaveApplication[] {
  return applications.filter((application) => leaveDateToIso(application.date) === dateIso);
}

function hasAcceptedLeave(leaves: LeaveApplication[]): boolean {
  return leaves.some(
    (leave) => leave.status.trim().toLowerCase() === LEAVE_STATUS.ACCEPTED.toLowerCase(),
  );
}

function resolveAbsenceReason(leaves: LeaveApplication[]): UnapprovedAbsenceReason {
  const hasPending = leaves.some(
    (leave) => leave.status.trim().toLowerCase() === LEAVE_STATUS.APPLIED.toLowerCase(),
  );
  if (hasPending) return "pending_leave";

  const hasRejected = leaves.some(
    (leave) => leave.status.trim().toLowerCase() === LEAVE_STATUS.REJECTED.toLowerCase(),
  );
  if (hasRejected) return "rejected_leave";

  return "no_punch";
}

function pickLeaveDetails(leaves: LeaveApplication[], reason: UnapprovedAbsenceReason) {
  const statusPriority =
    reason === "pending_leave"
      ? LEAVE_STATUS.APPLIED
      : reason === "rejected_leave"
        ? LEAVE_STATUS.REJECTED
        : null;

  const match = statusPriority
    ? leaves.find((leave) => leave.status.trim().toLowerCase() === statusPriority.toLowerCase())
    : undefined;

  return {
    leaveType: match?.leaveType ?? "",
    duration: match?.duration ?? "",
  };
}

async function loadUnapprovedAbsenceEmployees(
  dateIso: string,
): Promise<UnapprovedAbsenceEmployee[]> {
  const todayIso = new Date().toISOString().slice(0, 10);
  if (dateIso > todayIso) return [];

  const leaveHolidayDates = await getLeaveHolidayDates();
  if (!isScheduledWorkingDay(dateIso, leaveHolidayDates)) return [];

  const raw = await readSheet(EMPLOYEE_SHEET_RANGE);
  const headers = getSheetHeaders(raw);

  const employees = raw.slice(1).flatMap((row, index) => {
    const form = sheetRowToForm(headers, row);
    if (!isEmployeeStatusActive(form.status)) return [];

    const role = form.role.trim().toLowerCase();
    if (!roleCanPunchInOut(role as Parameters<typeof roleCanPunchInOut>[0])) return [];

    const attendanceSpreadsheetId = getAttendanceSpreadsheetIdFromRow(headers, row);
    if (!attendanceSpreadsheetId) return [];

    const employeeSheetRow = index + 2;
    return [
      {
        employeeSheetRow,
        employeeId: getEmployeeIdFromRow(headers, row, employeeSheetRow),
        employeeName: form.name.trim() || "Employee",
        attendanceSpreadsheetId,
      },
    ];
  });

  const results = await Promise.allSettled(
    employees.map(async (employee) => {
      const [attendance, applications] = await Promise.all([
        getAttendanceForDate(employee.attendanceSpreadsheetId, dateIso),
        listLeaveApplications({
          employeeId: employee.employeeId,
          employeeName: employee.employeeName,
          attendanceSpreadsheetId: employee.attendanceSpreadsheetId,
        }),
      ]);

      const dayLeaves = leavesForDate(applications, dateIso);
      if (hasAcceptedLeave(dayLeaves)) return null;
      if (!wasAbsentOnDate(attendance)) return null;

      const reason = resolveAbsenceReason(dayLeaves);
      const details = pickLeaveDetails(dayLeaves, reason);

      return {
        id: `${employee.employeeSheetRow}:${dateIso}`,
        employeeSheetRow: employee.employeeSheetRow,
        employeeId: employee.employeeId,
        employeeName: employee.employeeName,
        reason,
        reasonLabel: REASON_LABELS[reason],
        leaveType: details.leaveType,
        duration: details.duration,
        date: dateIso,
      } satisfies UnapprovedAbsenceEmployee;
    }),
  );

  const uniqueEmployees = new Map<number, UnapprovedAbsenceEmployee>();
  for (const result of results) {
    if (result.status !== "fulfilled" || !result.value) continue;
    if (!uniqueEmployees.has(result.value.employeeSheetRow)) {
      uniqueEmployees.set(result.value.employeeSheetRow, result.value);
    }
  }

  return [...uniqueEmployees.values()].sort((a, b) => a.employeeName.localeCompare(b.employeeName));
}

export async function listUnapprovedAbsenceEmployees(
  dateIso: string,
): Promise<UnapprovedAbsenceEmployee[]> {
  const cached = unapprovedAbsenceCache.get(dateIso);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const pending = unapprovedAbsenceRequests.get(dateIso);
  if (pending) return pending;

  const request = loadUnapprovedAbsenceEmployees(dateIso)
    .then((value) => {
      unapprovedAbsenceCache.set(dateIso, {
        expiresAt: Date.now() + CACHE_TTL_MS,
        value,
      });
      return value;
    })
    .finally(() => {
      unapprovedAbsenceRequests.delete(dateIso);
    });

  unapprovedAbsenceRequests.set(dateIso, request);
  return request;
}
