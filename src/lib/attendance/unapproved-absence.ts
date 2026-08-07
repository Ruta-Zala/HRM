import { getAttendanceSpreadsheetIdFromRow } from "@/lib/attendance/employee";
import { listLeaveApplications, type LeaveApplication } from "@/lib/attendance/leave-approvals";
import { LEAVE_STATUS } from "@/lib/attendance/leave-status";
import { roleCanPunchInOut } from "@/lib/attendance/absence-gate";
import {
  WORKING_STATUS,
  canonicalizeWorkMode,
  isPunchOptionalWorkMode,
} from "@/lib/attendance/constants";
import { getAttendanceRepository } from "@/lib/attendance/repository";
import { listCompanyHolidays } from "@/lib/company-holiday-sheets";
import { getEmployeeIdFromRow, isEmployeeStatusActive, sheetRowToForm } from "@/lib/employee";
import { listAllEmployeeRows } from "@/lib/employees/repository";
import type { AttendanceRow } from "@/lib/google/attendance-sheets";
import { leaveDateToIso } from "@/lib/payroll/leave-attendance";
import { isWeekend } from "@/lib/payroll/working-days";
import { getAppTimeZone } from "@/lib/attendance/time";
import { notificationDateIso } from "@/lib/notifications/automation-date";

export type UnapprovedAbsenceReason = "no_punch";

export type UnapprovedAbsenceEmployee = {
  id: string;
  employeeSheetRow: number;
  employeeId: string;
  employeeName: string;
  profileImage: string;
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

/** Short TTL so dashboard updates soon after someone punches in. */
const CACHE_TTL_MS = 15_000;
const unapprovedAbsenceCache = new Map<string, CachedUnapprovedAbsence>();
const unapprovedAbsenceRequests = new Map<string, Promise<UnapprovedAbsenceEmployee[]>>();

let holidayDatesCache: { expiresAt: number; dates: Set<string> } | null = null;
const HOLIDAY_CACHE_TTL_MS = 5 * 60_000;

/** Office start used to decide when “no punch yet today” counts as absence. */
export const OFFICE_START_HOUR = 10;
export const OFFICE_START_MINUTE = 0;

export function invalidateUnapprovedAbsenceCache(dateIso?: string): void {
  if (dateIso) {
    unapprovedAbsenceCache.delete(dateIso);
    unapprovedAbsenceRequests.delete(dateIso);
    return;
  }
  unapprovedAbsenceCache.clear();
  unapprovedAbsenceRequests.clear();
}

function hasPunchIn(attendance: AttendanceRow | null): boolean {
  return Boolean(attendance?.punchIn?.trim());
}

function isCoveredWithoutPunch(attendance: AttendanceRow | null): boolean {
  if (!attendance) return false;

  const workMode = canonicalizeWorkMode(attendance.workMode);
  if (isPunchOptionalWorkMode(workMode)) return true;

  if (attendance.status.trim() === WORKING_STATUS.ON_LEAVE) return true;

  return false;
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

/**
 * For past dates: always evaluate.
 * For today: only after office start (10:00), so early morning is not all “absent”.
 */
function shouldEvaluateNoPunch(dateIso: string): boolean {
  const todayIso = notificationDateIso();
  if (dateIso < todayIso) return true;
  if (dateIso > todayIso) return false;

  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: getAppTimeZone(),
    hour: "numeric",
    minute: "numeric",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? "0");
  return hour > OFFICE_START_HOUR || (hour === OFFICE_START_HOUR && minute >= OFFICE_START_MINUTE);
}

async function getAttendanceForDate(
  employeeId: string,
  spreadsheetId: string,
  dateIso: string,
): Promise<AttendanceRow | null> {
  return getAttendanceRepository().getAttendanceForDate({ employeeId, spreadsheetId }, dateIso);
}

function leavesForDate(applications: LeaveApplication[], dateIso: string): LeaveApplication[] {
  return applications.filter((application) => leaveDateToIso(application.date) === dateIso);
}

function hasAcceptedLeave(leaves: LeaveApplication[]): boolean {
  return leaves.some(
    (leave) => leave.status.trim().toLowerCase() === LEAVE_STATUS.ACCEPTED.toLowerCase(),
  );
}

async function loadUnapprovedAbsenceEmployees(
  dateIso: string,
): Promise<UnapprovedAbsenceEmployee[]> {
  const todayIso = notificationDateIso();
  if (dateIso > todayIso) return [];
  if (!shouldEvaluateNoPunch(dateIso)) return [];

  const leaveHolidayDates = await getLeaveHolidayDates();
  if (!isScheduledWorkingDay(dateIso, leaveHolidayDates)) return [];

  const records = await listAllEmployeeRows();

  const employees = records.flatMap((record) => {
    const form = sheetRowToForm(record.headers, record.row);
    if (!isEmployeeStatusActive(form.status)) return [];

    const role = form.role.trim().toLowerCase();
    if (!roleCanPunchInOut(role as Parameters<typeof roleCanPunchInOut>[0])) return [];

    const attendanceSpreadsheetId = getAttendanceSpreadsheetIdFromRow(record.headers, record.row);
    const employeeId = getEmployeeIdFromRow(record.headers, record.row, record.sheetRow);
    if (!attendanceSpreadsheetId || !employeeId) return [];

    return [
      {
        employeeSheetRow: record.sheetRow,
        employeeId,
        employeeName: form.name.trim() || "Employee",
        profileImage: form.profileImage.trim(),
        attendanceSpreadsheetId,
      },
    ];
  });

  const results = await Promise.allSettled(
    employees.map(async (employee) => {
      const [attendance, applications] = await Promise.all([
        getAttendanceForDate(employee.employeeId, employee.attendanceSpreadsheetId, dateIso),
        listLeaveApplications({
          employeeId: employee.employeeId,
          employeeName: employee.employeeName,
          attendanceSpreadsheetId: employee.attendanceSpreadsheetId,
        }),
      ]);

      const dayLeaves = leavesForDate(applications, dateIso);
      // Approved leave / punch-optional modes are not “no punch” absences.
      if (hasAcceptedLeave(dayLeaves)) return null;
      if (isCoveredWithoutPunch(attendance)) return null;
      // Any punch-in (even late) removes them from the list.
      if (hasPunchIn(attendance)) return null;

      return {
        id: `${employee.employeeSheetRow}:${dateIso}`,
        employeeSheetRow: employee.employeeSheetRow,
        employeeId: employee.employeeId,
        employeeName: employee.employeeName,
        profileImage: employee.profileImage,
        reason: "no_punch" as const,
        reasonLabel: "No punch-in",
        leaveType: "",
        duration: "",
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
