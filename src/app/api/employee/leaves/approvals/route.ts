import { NextResponse } from "next/server";

import { withActiveSession } from "@/lib/auth/api-guard";
import { canManageEmployees } from "@/lib/auth/roles";
import { getAttendanceSpreadsheetIdFromRow } from "@/lib/attendance/employee";
import { listLeaveApplications } from "@/lib/attendance/leave-approvals";
import { LEAVE_STATUS } from "@/lib/attendance/leave-status";
import { getSheetHeaders, sheetRowToForm } from "@/lib/employee";
import { EMPLOYEE_SHEET_RANGE, readSheet } from "@/lib/google/sheets";

export const GET = withActiveSession(async (req, user) => {
  if (!canManageEmployees(user.role)) {
    return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const statusParam = searchParams.get("status") ?? LEAVE_STATUS.APPLIED;
    const raw = await readSheet(EMPLOYEE_SHEET_RANGE);
    const headers = getSheetHeaders(raw);
    const applications = [];

    for (let i = 1; i < raw.length; i++) {
      const row = raw[i] ?? [];
      const form = sheetRowToForm(headers, row);
      const attendanceSpreadsheetId = getAttendanceSpreadsheetIdFromRow(headers, row);
      if (!attendanceSpreadsheetId) continue;

      const employeeApplications = await listLeaveApplications({
        employeeId: form.employeeId.trim(),
        employeeName: form.name.trim() || "Employee",
        attendanceSpreadsheetId,
        statusFilter: statusParam as typeof LEAVE_STATUS.APPLIED,
      });

      applications.push(...employeeApplications);
    }

    return NextResponse.json({
      success: true,
      applications,
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
