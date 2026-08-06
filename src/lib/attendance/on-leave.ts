import { roleCanPunchInOut } from "@/lib/attendance/absence-gate";
import { getAttendanceSpreadsheetIdFromRow } from "@/lib/attendance/employee";
import { listLeaveApplications, type LeaveApplication } from "@/lib/attendance/leave-approvals";
import { parseLeaveDisplayDate } from "@/lib/attendance/leave-range-display";
import { LEAVE_STATUS } from "@/lib/attendance/leave-status";
import { formatIsoDate } from "@/lib/attendance/time";
import {
  getEmployeeIdFromRow,
  getSheetHeaders,
  isEmployeeStatusActive,
  sheetRowToForm,
} from "@/lib/employee";
import { EMPLOYEE_SHEET_RANGE, readSheet } from "@/lib/google/sheets";
import type { UserRole } from "@/types/auth";

export type OnLeaveEmployee = {
  id: string;
  employeeSheetRow: number;
  employeeId: string;
  employeeName: string;
  leaveType: string;
  duration: string;
  reason: string;
  date: string;
};

export type OnLeaveDashboardData = {
  employees: OnLeaveEmployee[];
  totalEmployees: number;
};

type CachedOnLeave = {
  expiresAt: number;
  value: OnLeaveDashboardData;
};

const CACHE_TTL_MS = 60_000;
const onLeaveCache = new Map<string, CachedOnLeave>();
const onLeaveRequests = new Map<string, Promise<OnLeaveDashboardData>>();

async function listActiveEmployeesForLeaveTracking() {
  const raw = await readSheet(EMPLOYEE_SHEET_RANGE);
  const headers = getSheetHeaders(raw);

  return raw.slice(1).flatMap((row, index) => {
    const form = sheetRowToForm(headers, row);
    if (!isEmployeeStatusActive(form.status)) return [];

    const role = form.role.trim().toLowerCase();
    if (!roleCanPunchInOut(role as UserRole)) return [];

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
}

function applicationDateIso(application: LeaveApplication): string {
  const parsed = parseLeaveDisplayDate(application.date);
  return parsed ? formatIsoDate(parsed) : "";
}

async function loadEmployeesOnLeave(dateIso: string): Promise<OnLeaveDashboardData> {
  const employees = await listActiveEmployeesForLeaveTracking();

  const results = await Promise.allSettled(
    employees.map(async (employee) => {
      const applications = await listLeaveApplications({
        employeeId: employee.employeeId,
        employeeName: employee.employeeName,
        attendanceSpreadsheetId: employee.attendanceSpreadsheetId,
        statusFilter: LEAVE_STATUS.ACCEPTED,
      });

      return applications
        .filter((application) => applicationDateIso(application) === dateIso)
        .map((application): OnLeaveEmployee => ({
          id: `${employee.employeeSheetRow}:${dateIso}`,
          employeeSheetRow: employee.employeeSheetRow,
          employeeId: employee.employeeId,
          employeeName: employee.employeeName,
          leaveType: application.leaveType,
          duration: application.duration,
          reason: application.reason,
          date: application.date,
        }));
    }),
  );

  const uniqueEmployees = new Map<number, OnLeaveEmployee>();
  for (const result of results) {
    if (result.status !== "fulfilled") continue;
    for (const employee of result.value) {
      if (!uniqueEmployees.has(employee.employeeSheetRow)) {
        uniqueEmployees.set(employee.employeeSheetRow, employee);
      }
    }
  }

  return {
    employees: [...uniqueEmployees.values()].sort((a, b) =>
      a.employeeName.localeCompare(b.employeeName),
    ),
    totalEmployees: employees.length,
  };
}

export async function listEmployeesOnLeave(dateIso: string): Promise<OnLeaveDashboardData> {
  const cached = onLeaveCache.get(dateIso);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const pending = onLeaveRequests.get(dateIso);
  if (pending) return pending;

  const request = loadEmployeesOnLeave(dateIso)
    .then((value) => {
      onLeaveCache.set(dateIso, {
        expiresAt: Date.now() + CACHE_TTL_MS,
        value,
      });
      return value;
    })
    .finally(() => {
      onLeaveRequests.delete(dateIso);
    });

  onLeaveRequests.set(dateIso, request);
  return request;
}
