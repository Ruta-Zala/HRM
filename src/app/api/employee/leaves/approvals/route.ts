import { NextResponse } from "next/server";

import { withActiveSession } from "@/lib/auth/api-guard";
import { canManageEmployees } from "@/lib/auth/roles";
import {
  getAttendanceSpreadsheetIdFromRow,
  isAttendanceSpreadsheetAccessible,
} from "@/lib/attendance/employee";
import { listLeaveApplications, type LeaveApplication } from "@/lib/attendance/leave-approvals";
import { isLeaveBucketOnFirebase } from "@/lib/attendance/leave-bucket/repository";
import { parseLeaveDisplayDate } from "@/lib/attendance/leave-range-display";
import { LEAVE_STATUS, type LeaveStatus } from "@/lib/attendance/leave-status";
import { sheetRowToForm } from "@/lib/employee";
import { listAllEmployeeRows } from "@/lib/employees/repository";
import { toApiErrorMessage } from "@/lib/api/user-facing-error";

type ApprovalEmployee = {
  employeeId: string;
  employeeName: string;
  attendanceSpreadsheetId: string;
};

function parseStatusFilter(value: string | null): LeaveStatus | undefined {
  const normalized = String(value ?? LEAVE_STATUS.APPLIED)
    .trim()
    .toLowerCase();

  if (!normalized || normalized === "all") return undefined;

  if (normalized === LEAVE_STATUS.APPLIED.toLowerCase()) return LEAVE_STATUS.APPLIED;
  if (normalized === LEAVE_STATUS.ACCEPTED.toLowerCase()) return LEAVE_STATUS.ACCEPTED;
  if (normalized === LEAVE_STATUS.REJECTED.toLowerCase()) return LEAVE_STATUS.REJECTED;

  return LEAVE_STATUS.APPLIED;
}

function leaveSortKey(application: LeaveApplication): number {
  return parseLeaveDisplayDate(application.date)?.getTime() ?? Number.NEGATIVE_INFINITY;
}

/** Newest leave dates first. */
function sortLeaveApplications(applications: LeaveApplication[]): LeaveApplication[] {
  return [...applications].sort((a, b) => {
    const dateCompare = leaveSortKey(b) - leaveSortKey(a);
    if (dateCompare !== 0) return dateCompare;

    const rowCompare = b.rowIndex - a.rowIndex;
    if (rowCompare !== 0) return rowCompare;

    return b.id.localeCompare(a.id);
  });
}

async function listApprovalEmployees(): Promise<{
  employees: ApprovalEmployee[];
  skippedCount: number;
}> {
  const records = await listAllEmployeeRows();
  const candidates: ApprovalEmployee[] = [];

  for (const record of records) {
    const form = sheetRowToForm(record.headers, record.row);
    const employeeId = form.employeeId.trim();
    if (!employeeId) continue;

    candidates.push({
      employeeId,
      employeeName: form.name.trim() || "Employee",
      attendanceSpreadsheetId: getAttendanceSpreadsheetIdFromRow(record.headers, record.row),
    });
  }

  if (isLeaveBucketOnFirebase()) {
    return {
      employees: dedupeEmployeesById(candidates),
      skippedCount: 0,
    };
  }

  const accessible = (
    await Promise.all(
      candidates.map(async (employee) => ({
        employee,
        accessible: Boolean(employee.attendanceSpreadsheetId)
          ? await isAttendanceSpreadsheetAccessible(employee.attendanceSpreadsheetId)
          : false,
      })),
    )
  )
    .filter((entry) => entry.accessible)
    .map((entry) => entry.employee);

  const employees = dedupeEmployeesById(accessible);

  return {
    employees,
    skippedCount: candidates.length - accessible.length,
  };
}

function dedupeEmployeesById(employees: ApprovalEmployee[]): ApprovalEmployee[] {
  const seen = new Set<string>();
  const unique: ApprovalEmployee[] = [];
  for (const employee of employees) {
    const key = employee.employeeId.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    unique.push(employee);
  }
  return unique;
}

export const GET = withActiveSession(async (req, user) => {
  if (!canManageEmployees(user.role)) {
    return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const statusFilter = parseStatusFilter(searchParams.get("status"));
    const { employees, skippedCount } = await listApprovalEmployees();

    const batches = await Promise.allSettled(
      employees.map((employee) =>
        listLeaveApplications({
          employeeId: employee.employeeId,
          employeeName: employee.employeeName,
          attendanceSpreadsheetId: employee.attendanceSpreadsheetId,
          statusFilter,
        }),
      ),
    );

    const applications: LeaveApplication[] = [];
    const warnings: string[] = [];

    if (skippedCount > 0) {
      warnings.push(
        `${skippedCount} employee${skippedCount === 1 ? "" : "s"} skipped (attendance spreadsheet missing or inaccessible).`,
      );
    }

    for (let i = 0; i < batches.length; i++) {
      const result = batches[i];
      const employee = employees[i];
      if (result.status === "fulfilled") {
        applications.push(...result.value);
        continue;
      }

      const reason =
        result.reason instanceof Error ? result.reason.message : "Failed to read leave bucket";
      warnings.push(`${employee.employeeName} (${employee.employeeId}): ${reason}`);
      console.warn(
        `Leave approvals: skipped ${employee.employeeId} (${employee.attendanceSpreadsheetId || "firebase"})`,
        result.reason,
      );
    }

    const uniqueApplications = Array.from(
      new Map(applications.map((application) => [application.id, application])).values(),
    );

    return NextResponse.json({
      success: true,
      applications: sortLeaveApplications(uniqueApplications),
      warnings,
    });
  } catch (error) {
    console.error("GET Leave Approvals Error:", error);

    return NextResponse.json(
      {
        success: false,
        message: toApiErrorMessage(error, "Failed to fetch leave approvals"),
      },
      { status: 500 },
    );
  }
});
