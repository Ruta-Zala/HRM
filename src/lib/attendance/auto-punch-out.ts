import { roleCanPunchInOut } from "@/lib/attendance/absence-gate";
import {
  getAttendanceSpreadsheetIdFromRow,
  resolveAttendanceEmployee,
  resolveAttendanceSpreadsheetIdForRow,
} from "@/lib/attendance/employee";
import {
  getEmployeeIdFromRow,
  getSheetHeaders,
  isEmployeeStatusActive,
  sheetRowToForm,
} from "@/lib/employee";
import { autoPunchOutOpenSession, getMonthAttendance } from "@/lib/google/attendance-sheets";
import { EMPLOYEE_SHEET_RANGE, readSheet } from "@/lib/google/sheets";
import { addDaysToDateIso, notificationDateIso } from "@/lib/notifications/automation-date";
import { notifyAutoPunchOut } from "@/lib/notifications/auto-punch-out-events";
import type { SessionUser, UserRole } from "@/types/auth";

/** Only the previous calendar day is auto-closed (midnight forgotten punch-out). */
const LOOKBACK_DAYS = 1;

type PunchableEmployee = {
  sheetRow: number;
  employeeId: string;
  employeeName: string;
  attendanceSpreadsheetId: string;
};

export type ForgottenPunchOutResult = {
  checked: number;
  closed: number;
  notified: number;
  dates: string[];
};

function listTargetDates(todayIso: string, lookbackDays: number): string[] {
  const dates: string[] = [];
  for (let offset = 1; offset <= lookbackDays; offset++) {
    dates.push(addDaysToDateIso(todayIso, -offset));
  }
  return dates;
}

async function listPunchableEmployees(): Promise<PunchableEmployee[]> {
  const raw = await readSheet(EMPLOYEE_SHEET_RANGE);
  const headers = getSheetHeaders(raw);
  const employees: PunchableEmployee[] = [];

  for (let index = 1; index < raw.length; index++) {
    const row = raw[index] ?? [];
    const form = sheetRowToForm(headers, row);
    if (!isEmployeeStatusActive(form.status)) continue;

    const role = form.role.trim().toLowerCase() as UserRole;
    if (!roleCanPunchInOut(role)) continue;

    const sheetRow = index + 1;
    let attendanceSpreadsheetId = "";
    try {
      attendanceSpreadsheetId = await resolveAttendanceSpreadsheetIdForRow({
        headers,
        row,
        sheetRow,
        employeeId: form.employeeId.trim(),
        employeeName: form.name.trim() || "Employee",
        documentsFolderId: form.documentsFolderId,
        birthdayDate: form.birthdayDate,
        createIfMissing: false,
      });
    } catch (error) {
      console.warn(`[auto-punch-out] spreadsheet resolve failed for row ${sheetRow}:`, error);
      attendanceSpreadsheetId = getAttendanceSpreadsheetIdFromRow(headers, row);
    }

    if (!attendanceSpreadsheetId) continue;

    employees.push({
      sheetRow,
      employeeId: getEmployeeIdFromRow(headers, row, sheetRow),
      employeeName: form.name.trim() || "Employee",
      attendanceSpreadsheetId,
    });
  }

  return employees;
}

async function closeForgottenSessionsForEmployee(
  employee: PunchableEmployee,
  dateIsos: string[],
): Promise<{ closed: number; notified: number; dates: string[] }> {
  let closed = 0;
  let notified = 0;
  const dates: string[] = [];

  const byMonth = new Map<string, string[]>();
  for (const dateIso of dateIsos) {
    const key = dateIso.slice(0, 7);
    const list = byMonth.get(key) ?? [];
    list.push(dateIso);
    byMonth.set(key, list);
  }

  for (const [monthKey, monthDates] of byMonth) {
    const [year, month] = monthKey.split("-").map(Number);
    let openDates: string[];

    try {
      const rows = await getMonthAttendance(employee.attendanceSpreadsheetId, year, month - 1);
      const open = new Set(
        rows.filter((row) => row.punchIn.trim() && !row.punchOut.trim()).map((row) => row.date),
      );
      openDates = monthDates.filter((dateIso) => open.has(dateIso));
    } catch (error) {
      console.warn(
        `[auto-punch-out] month read failed for ${employee.employeeName} (${monthKey}):`,
        error,
      );
      openDates = monthDates;
    }

    for (const dateIso of openDates) {
      try {
        const closedRow = await autoPunchOutOpenSession(employee.attendanceSpreadsheetId, dateIso);
        if (!closedRow) continue;

        closed += 1;
        dates.push(dateIso);

        const created = await notifyAutoPunchOut({
          employeeSheetRow: employee.sheetRow,
          employeeId: employee.employeeId,
          dateIso,
        });
        notified += created;
      } catch (error) {
        console.warn(`[auto-punch-out] failed for ${employee.employeeName} on ${dateIso}:`, error);
      }
    }
  }

  return { closed, notified, dates };
}

/**
 * Close open punch sessions from yesterday only, then notify the employee.
 * Designed for the daily cron (runs after midnight IST via UTC schedule).
 */
export async function processForgottenPunchOuts(options?: {
  lookbackDays?: number;
  todayIso?: string;
}): Promise<ForgottenPunchOutResult> {
  const todayIso = options?.todayIso ?? notificationDateIso();
  const lookbackDays = options?.lookbackDays ?? LOOKBACK_DAYS;
  const dateIsos = listTargetDates(todayIso, lookbackDays);
  const employees = await listPunchableEmployees();

  let closed = 0;
  let notified = 0;
  const dates: string[] = [];

  for (const employee of employees) {
    const result = await closeForgottenSessionsForEmployee(employee, dateIsos);
    closed += result.closed;
    notified += result.notified;
    dates.push(...result.dates);
  }

  return {
    checked: employees.length,
    closed,
    notified,
    dates,
  };
}

/**
 * Login/catch-up path: close any forgotten punch-outs for one employee and notify them.
 */
export async function ensureForgottenPunchOutForUser(
  user: SessionUser,
  options?: { lookbackDays?: number },
): Promise<ForgottenPunchOutResult> {
  if (!roleCanPunchInOut(user.role as UserRole)) {
    return { checked: 0, closed: 0, notified: 0, dates: [] };
  }

  const employee = await resolveAttendanceEmployee(user);
  if (!employee?.attendanceSpreadsheetId) {
    return { checked: 0, closed: 0, notified: 0, dates: [] };
  }

  const todayIso = notificationDateIso();
  const dateIsos = listTargetDates(todayIso, options?.lookbackDays ?? LOOKBACK_DAYS);
  const target: PunchableEmployee = {
    sheetRow: employee.sheetRow,
    employeeId: employee.employeeId,
    employeeName: employee.employeeName,
    attendanceSpreadsheetId: employee.attendanceSpreadsheetId,
  };

  const result = await closeForgottenSessionsForEmployee(target, dateIsos);
  return {
    checked: 1,
    closed: result.closed,
    notified: result.notified,
    dates: result.dates,
  };
}
