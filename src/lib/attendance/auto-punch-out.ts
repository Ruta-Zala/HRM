import { roleCanPunchInOut } from "@/lib/attendance/absence-gate";
import { resolveAttendanceEmployee } from "@/lib/attendance/employee";
import {
  hasAttendanceStorage,
  isAttendanceOnFirebase,
  type AttendanceStorageRef,
} from "@/lib/attendance/repository";
import { getEmployeeIdFromRow, isEmployeeStatusActive, sheetRowToForm } from "@/lib/employee";
import { listAllEmployeeRows } from "@/lib/employees/repository";
import {
  getAttendanceSpreadsheetIdFromRow,
  resolveAttendanceSpreadsheetIdForRow,
} from "@/lib/attendance/employee";
import { addDaysToDateIso, notificationDateIso } from "@/lib/notifications/automation-date";
import { notifyAutoPunchOut } from "@/lib/notifications/auto-punch-out-events";
import type { SessionUser, UserRole } from "@/types/auth";
import { firestoreAttendanceRepository } from "@/lib/attendance/repository/firestore";

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

function toStorageRef(employee: PunchableEmployee): AttendanceStorageRef {
  return {
    employeeId: employee.employeeId,
    spreadsheetId: employee.attendanceSpreadsheetId,
  };
}

async function listPunchableEmployees(): Promise<PunchableEmployee[]> {
  const records = await listAllEmployeeRows();
  const employees: PunchableEmployee[] = [];
  const onFirebase = isAttendanceOnFirebase();

  for (const record of records) {
    const form = sheetRowToForm(record.headers, record.row);
    if (!isEmployeeStatusActive(form.status)) continue;

    const role = form.role.trim().toLowerCase() as UserRole;
    if (!roleCanPunchInOut(role)) continue;

    const employeeId =
      form.employeeId.trim() || getEmployeeIdFromRow(record.headers, record.row, record.sheetRow);
    if (!employeeId) continue;

    let attendanceSpreadsheetId = getAttendanceSpreadsheetIdFromRow(record.headers, record.row);

    if (!onFirebase) {
      try {
        attendanceSpreadsheetId = await resolveAttendanceSpreadsheetIdForRow({
          headers: record.headers,
          row: record.row,
          sheetRow: record.sheetRow,
          employeeId,
          employeeName: form.name.trim() || "Employee",
          documentsFolderId: form.documentsFolderId,
          birthdayDate: form.birthdayDate,
          createIfMissing: false,
        });
      } catch (error) {
        console.warn(
          `[auto-punch-out] spreadsheet resolve failed for row ${record.sheetRow}:`,
          error,
        );
      }
      if (!attendanceSpreadsheetId) continue;
    }

    employees.push({
      sheetRow: record.sheetRow,
      employeeId,
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
  const storageRef = toStorageRef(employee);

  // Active storage is Firebase in this deployment. Sheets gets the update via scheduled sync.
  for (const dateIso of dateIsos) {
    try {
      const closedRow = await firestoreAttendanceRepository.autoPunchOutOpenSession(
        storageRef,
        dateIso,
      );
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
  if (!hasAttendanceStorage(employee)) {
    return { checked: 0, closed: 0, notified: 0, dates: [] };
  }

  const todayIso = notificationDateIso();
  const dateIsos = listTargetDates(todayIso, options?.lookbackDays ?? LOOKBACK_DAYS);
  const target: PunchableEmployee = {
    sheetRow: employee!.sheetRow,
    employeeId: employee!.employeeId,
    employeeName: employee!.employeeName,
    attendanceSpreadsheetId: employee!.attendanceSpreadsheetId,
  };

  const result = await closeForgottenSessionsForEmployee(target, dateIsos);
  return {
    checked: 1,
    closed: result.closed,
    notified: result.notified,
    dates: result.dates,
  };
}
