import { NextResponse } from "next/server";

import { withActiveSession } from "@/lib/auth/api-guard";
import { canManageEmployees } from "@/lib/auth/roles";
import { resolveAttendanceEmployeeForTarget } from "@/lib/attendance/employee";
import {
  leaveBucketFromWorkMode,
  normalizeManualAttendanceInput,
  shouldClearLeaveOnManualAttendance,
} from "@/lib/attendance/manual-entry";
import { WORK_MODE } from "@/lib/attendance/constants";
import {
  cancelLeaveApplicationsForDate,
  ensureAcceptedLeaveForDate,
} from "@/lib/attendance/leave-approvals";
import { invalidateOnLeaveCache } from "@/lib/attendance/on-leave";
import {
  getAttendanceRepository,
  hasAttendanceStorage,
  toAttendanceStorageRef,
} from "@/lib/attendance/repository";
import { formatGoogleApiClientMessage } from "@/lib/google/drive-auth";
import { toApiErrorMessage } from "@/lib/api/user-facing-error";

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
    if (!hasAttendanceStorage(employee)) {
      return NextResponse.json(
        { success: false, message: "Employee attendance storage not found" },
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

    const workMode = normalized.workMode || WORK_MODE.FULL_DAY_ONSITE;
    const record = await getAttendanceRepository().upsertManualAttendance(
      toAttendanceStorageRef(employee!),
      {
        dateIso: normalized.dateIso,
        punchIn: normalized.punchIn,
        punchOut: normalized.punchOut,
        breakStart: normalized.breakStart,
        breakEnd: normalized.breakEnd,
        totalBreakTime: normalized.totalBreakTime,
        workMode,
      },
    );

    let leaveCleared = 0;
    let leaveEnsured = false;

    if (shouldClearLeaveOnManualAttendance(workMode)) {
      leaveCleared = await cancelLeaveApplicationsForDate({
        employeeId: employee!.employeeId,
        attendanceSpreadsheetId: employee!.attendanceSpreadsheetId ?? "",
        dateIso: normalized.dateIso,
      });
      invalidateOnLeaveCache(normalized.dateIso);
    } else {
      const leaveMapping = leaveBucketFromWorkMode(workMode);
      if (leaveMapping) {
        leaveEnsured = await ensureAcceptedLeaveForDate({
          employeeId: employee!.employeeId,
          attendanceSpreadsheetId: employee!.attendanceSpreadsheetId ?? "",
          dateIso: normalized.dateIso,
          leaveType: leaveMapping.leaveType,
          duration: leaveMapping.duration,
        });
        invalidateOnLeaveCache(normalized.dateIso);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Attendance saved for ${employee!.employeeName} on ${normalized.dateIso}`,
      leaveCleared,
      leaveEnsured,
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
        employeeId: employee!.employeeId,
        employeeName: employee!.employeeName,
        sheetRow: employee!.sheetRow,
      },
    });
  } catch (error) {
    const message = toApiErrorMessage(
      error,
      formatGoogleApiClientMessage(error) || "Failed to save attendance",
    );
    return NextResponse.json({ success: false, message }, { status: 400 });
  }
});
