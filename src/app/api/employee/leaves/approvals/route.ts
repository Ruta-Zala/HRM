import { NextResponse } from "next/server";

import { withActiveSession } from "@/lib/auth/api-guard";
import { canManageEmployees } from "@/lib/auth/roles";
import {
  getAttendanceSpreadsheetIdFromRow,
  isAttendanceSpreadsheetAccessible,
} from "@/lib/attendance/employee";
import { listLeaveApplications, type LeaveApplication } from "@/lib/attendance/leave-approvals";
import { LEAVE_STATUS, type LeaveStatus } from "@/lib/attendance/leave-status";
import { getSheetHeaders, sheetRowToForm } from "@/lib/employee";
import { EMPLOYEE_SHEET_RANGE, readSheet } from "@/lib/google/sheets";

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

function sortLeaveApplications(applications: LeaveApplication[]): LeaveApplication[] {
  return [...applications].sort((a, b) => {
    const nameCompare = a.employeeName.localeCompare(b.employeeName);
    if (nameCompare !== 0) return nameCompare;
    return a.date.localeCompare(b.date);
  });
}

export const GET = withActiveSession(async (req, user) => {
  if (!canManageEmployees(user.role)) {
    return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const statusFilter = parseStatusFilter(searchParams.get("status"));
    const raw = await readSheet(EMPLOYEE_SHEET_RANGE);
    const headers = getSheetHeaders(raw);
    const employees = [];

    for (let i = 1; i < raw.length; i++) {
      const row = raw[i] ?? [];
      const form = sheetRowToForm(headers, row);
      const attendanceSpreadsheetId = getAttendanceSpreadsheetIdFromRow(headers, row);
      if (!attendanceSpreadsheetId) continue;

      employees.push({
        employeeId: form.employeeId.trim(),
        employeeName: form.name.trim() || "Employee",
        attendanceSpreadsheetId,
      });
    }

    const accessibleEmployees = (
      await Promise.all(
        employees.map(async (employee) => ({
          employee,
          accessible: await isAttendanceSpreadsheetAccessible(employee.attendanceSpreadsheetId),
        })),
      )
    )
      .filter((entry) => entry.accessible)
      .map((entry) => entry.employee);

    const skippedCount = employees.length - accessibleEmployees.length;

    const batches = await Promise.allSettled(
      accessibleEmployees.map((employee) =>
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
      const employee = accessibleEmployees[i];
      if (result.status === "fulfilled") {
        applications.push(...result.value);
        continue;
      }

      const reason =
        result.reason instanceof Error ? result.reason.message : "Failed to read leave bucket";
      warnings.push(`${employee.employeeName} (${employee.employeeId}): ${reason}`);
      console.warn(
        `Leave approvals: skipped ${employee.employeeId} (${employee.attendanceSpreadsheetId})`,
        result.reason,
      );
    }

    const sortedApplications = sortLeaveApplications(applications);

    return NextResponse.json({
      success: true,
      applications: sortedApplications,
      warnings,
    });
  } catch (error) {
    console.error("GET Leave Approvals Error:", error);

    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Failed to fetch leave approvals",
      },
      { status: 500 },
    );
  }
});
