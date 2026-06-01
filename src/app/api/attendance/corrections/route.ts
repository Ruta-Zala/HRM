import { NextResponse } from "next/server";

import { CORRECTION_FIELDS, CORRECTION_STATUS } from "@/lib/attendance/constants";
import {
  createCorrectionRequest,
  listCorrectionRequests,
  reviewCorrectionRequest,
} from "@/lib/attendance/corrections";
import { resolveAttendanceEmployee } from "@/lib/attendance/employee";
import { getTodayAttendance } from "@/lib/google/attendance-sheets";
import { withActiveSession } from "@/lib/auth/api-guard";
import { canManageEmployees } from "@/lib/auth/server";
import type { CorrectionField } from "@/lib/attendance/constants";

export const GET = withActiveSession(async (_req, user) => {
  try {
    const isHr = canManageEmployees(user.role);
    const employee = await resolveAttendanceEmployee(user);

    const requests = await listCorrectionRequests(isHr ? {} : { employeeId: employee?.employeeId });

    return NextResponse.json({ success: true, requests });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load corrections";
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
});

export const POST = withActiveSession(async (req, user) => {
  try {
    const employee = await resolveAttendanceEmployee(user);
    if (!employee?.attendanceSpreadsheetId) {
      return NextResponse.json(
        { success: false, message: "Employee attendance record not found" },
        { status: 404 },
      );
    }

    const body = await req.json();
    const field = String(body.field ?? "") as CorrectionField;
    const requestedTime = String(body.requestedTime ?? "").trim();
    const reason = String(body.reason ?? "").trim();
    const date = String(body.date ?? "").trim();

    if (!CORRECTION_FIELDS.includes(field)) {
      return NextResponse.json(
        { success: false, message: "Invalid correction field" },
        { status: 400 },
      );
    }
    if (!requestedTime) {
      return NextResponse.json(
        { success: false, message: "Requested time is required" },
        { status: 400 },
      );
    }
    if (!reason) {
      return NextResponse.json({ success: false, message: "Reason is required" }, { status: 400 });
    }

    const today = await getTodayAttendance(employee.attendanceSpreadsheetId);
    const targetDate = date || today?.date;
    if (!targetDate) {
      return NextResponse.json(
        { success: false, message: "No attendance record found for correction" },
        { status: 400 },
      );
    }

    const originalValue =
      field === "punchIn"
        ? (today?.punchIn ?? "")
        : field === "punchOut"
          ? (today?.punchOut ?? "")
          : field === "breakStart"
            ? (today?.breakStart ?? "")
            : (today?.breakEnd ?? "");

    const request = await createCorrectionRequest({
      employee,
      date: targetDate,
      field,
      originalValue,
      requestedValue: requestedTime,
      reason,
    });

    return NextResponse.json({ success: true, request });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to submit correction";
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
});

export const PATCH = withActiveSession(async (req, user) => {
  try {
    if (!canManageEmployees(user.role)) {
      return NextResponse.json(
        { success: false, message: "Not authorized to review corrections" },
        { status: 403 },
      );
    }

    const body = await req.json();
    const id = String(body.id ?? "");
    const status = String(body.status ?? "");
    const remarks = String(body.remarks ?? "").trim();

    if (!id) {
      return NextResponse.json(
        { success: false, message: "Correction id is required" },
        { status: 400 },
      );
    }

    if (status !== CORRECTION_STATUS.APPROVED && status !== CORRECTION_STATUS.REJECTED) {
      return NextResponse.json(
        { success: false, message: "Status must be Approved or Rejected" },
        { status: 400 },
      );
    }

    const request = await reviewCorrectionRequest({
      id,
      status,
      remarks,
      reviewerName: user.name,
    });

    return NextResponse.json({ success: true, request });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to review correction";
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
});
