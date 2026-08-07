import { roleCanPunchInOut } from "@/lib/attendance/absence-gate";
import { getAttendanceSpreadsheetIdFromRow } from "@/lib/attendance/employee";
import { listLeaveApplications, type LeaveApplication } from "@/lib/attendance/leave-approvals";
import { parseLeaveDisplayDate } from "@/lib/attendance/leave-range-display";
import { LEAVE_STATUS } from "@/lib/attendance/leave-status";
import { formatIsoDate } from "@/lib/attendance/time";
import { getEmployeeIdFromRow, isEmployeeStatusActive, sheetRowToForm } from "@/lib/employee";
import { listAllEmployeeRows } from "@/lib/employees/repository";
import { isFirebaseDailyStorage } from "@/lib/storage/backend";
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

export function invalidateOnLeaveCache(dateIso?: string): void {
  if (dateIso) {
    onLeaveCache.delete(dateIso);
    onLeaveRequests.delete(dateIso);
    return;
  }
  onLeaveCache.clear();
  onLeaveRequests.clear();
}

async function listActiveEmployeesForLeaveTracking() {
  const records = await listAllEmployeeRows();

  return records.flatMap((record) => {
    const form = sheetRowToForm(record.headers, record.row);
    if (!isEmployeeStatusActive(form.status)) return [];

    const role = form.role.trim().toLowerCase();
    if (!roleCanPunchInOut(role as UserRole)) return [];

    const attendanceSpreadsheetId = getAttendanceSpreadsheetIdFromRow(record.headers, record.row);
    const employeeId = getEmployeeIdFromRow(record.headers, record.row, record.sheetRow);

    // Leave bucket is Firebase-keyed by employeeId when daily storage is on.
    if (!employeeId) return [];
    if (!attendanceSpreadsheetId && !isFirebaseDailyStorage()) return [];

    return [
      {
        employeeSheetRow: record.sheetRow,
        employeeId,
        employeeName: form.name.trim() || "Employee",
        attendanceSpreadsheetId: attendanceSpreadsheetId || "",
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
