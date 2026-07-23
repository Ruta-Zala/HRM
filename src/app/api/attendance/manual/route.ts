import { NextResponse } from "next/server";

import { withActiveSession } from "@/lib/auth/api-guard";
import { canManageEmployees } from "@/lib/auth/roles";
import { resolveAttendanceEmployeeForTarget } from "@/lib/attendance/employee";
import { normalizeManualAttendanceInput } from "@/lib/attendance/manual-entry";
import { WORK_MODE } from "@/lib/attendance/constants";
import { upsertManualAttendanceRecord } from "@/lib/google/attendance-sheets";
import { formatGoogleApiClientMessage } from "@/lib/google/drive-auth";

export const POST = withActiveSession(async (req, user) => {
  if (!canManageEmployees(user.role)) {
    return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const employeeSheetRow = Number(body.employeeSheetRow);
    const date = String(body.date ?? "").trim();

    if (!Number.isFinite(employeeSheetRow) || employeeSheetRow < 2) {
      return NextResponse.json(
        { success: false, message: "Valid employee is required" },
        { status: 400 },
      );
    }

    const employee = await resolveAttendanceEmployeeForTarget(user, employeeSheetRow);
    if (!employee?.attendanceSpreadsheetId) {
      return NextResponse.json(
        { success: false, message: "Employee attendance spreadsheet not found" },
        { status: 404 },
      );
    }

    const normalized = normalizeManualAttendanceInput({
      dateIso: date,
      punchIn: body.punchIn != null ? String(body.punchIn) : undefined,
      punchOut: body.punchOut != null ? String(body.punchOut) : undefined,
      breakStart: body.breakStart != null ? String(body.breakStart) : undefined,
      breakEnd: body.breakEnd != null ? String(body.breakEnd) : undefined,
      workMode: body.workMode != null ? String(body.workMode) : undefined,
    });

    const record = await upsertManualAttendanceRecord({
      spreadsheetId: employee.attendanceSpreadsheetId,
      dateIso: normalized.dateIso,
      punchIn: normalized.punchIn,
      punchOut: normalized.punchOut,
      breakStart: normalized.breakStart,
      breakEnd: normalized.breakEnd,
      totalBreakTime: normalized.totalBreakTime,
      workMode: normalized.workMode || WORK_MODE.FULL_DAY_ONSITE,
    });

    return NextResponse.json({
      success: true,
      message: `Attendance saved for ${employee.employeeName} on ${normalized.dateIso}`,
      record: {
        id: record.date,
        date: record.date,
        workMode: record.workMode,
        punchIn: record.punchIn,
        punchOut: record.punchOut,
        breakStart: record.breakStart,
        breakEnd: record.breakEnd,
        breakTime: record.totalBreakTime,
        workingHours: record.workingHours,
        overtime: record.overtime,
        status: record.status,
      },
      employee: {
        employeeId: employee.employeeId,
        employeeName: employee.employeeName,
        sheetRow: employee.sheetRow,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : formatGoogleApiClientMessage(error) || "Failed to save attendance";
    return NextResponse.json({ success: false, message }, { status: 400 });
  }
});
