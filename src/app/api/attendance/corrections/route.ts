import { NextResponse } from "next/server";

import { CORRECTION_FIELDS, CORRECTION_STATUS } from "@/lib/attendance/constants";
import {
  createCorrectionRequest,
  listCorrectionRequests,
  reviewCorrectionRequest,
} from "@/lib/attendance/corrections";
import { resolveAttendanceEmployee } from "@/lib/attendance/employee";
import {
  getAttendanceRepository,
  hasAttendanceStorage,
  toAttendanceStorageRef,
} from "@/lib/attendance/repository";
import { withActiveSession } from "@/lib/auth/api-guard";
import { canManageEmployees } from "@/lib/auth/server";
import type { CorrectionField } from "@/lib/attendance/constants";
import {
  notifyCorrectionReviewed,
  notifyCorrectionSubmitted,
} from "@/lib/notifications/correction-events";
import { toApiErrorMessage } from "@/lib/api/user-facing-error";

export const GET = withActiveSession(async (_req, user) => {
  try {
    const isHr = canManageEmployees(user.role);
    const employee = await resolveAttendanceEmployee(user);

    const requests = await listCorrectionRequests(isHr ? {} : { employeeId: employee?.employeeId });

    return NextResponse.json({ success: true, requests });
  } catch (error: unknown) {
    const message = toApiErrorMessage(error, "Failed to load corrections");
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
});

export const POST = withActiveSession(async (req, user) => {
  try {
    const employee = await resolveAttendanceEmployee(user);
    if (!hasAttendanceStorage(employee)) {
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

    const repo = getAttendanceRepository();
    const storageRef = toAttendanceStorageRef(employee!);
    const targetDate = date || (await repo.getTodayAttendance(storageRef))?.date || "";
    if (!targetDate) {
      return NextResponse.json(
        { success: false, message: "No attendance record found for correction" },
        { status: 400 },
      );
    }

    const day = await repo.getAttendanceForDate(storageRef, targetDate);
    if (!day) {
      return NextResponse.json(
        { success: false, message: "No attendance record found for correction" },
        { status: 400 },
      );
    }

    const originalValue =
      field === "punchIn"
        ? (day.punchIn ?? "")
        : field === "punchOut"
          ? (day.punchOut ?? "")
          : field === "breakStart"
            ? (day.breakStart ?? "")
            : (day.breakEnd ?? "");

    const request = await createCorrectionRequest({
      employee: employee!,
      date: targetDate,
      field,
      originalValue,
      requestedValue: requestedTime,
      reason,
    });

    try {
      await notifyCorrectionSubmitted({
        request,
        employeeSheetRow: employee!.sheetRow,
      });
    } catch (notificationError) {
      console.error("Correction submission notification error:", notificationError);
    }

    return NextResponse.json({ success: true, request });
  } catch (error: unknown) {
    const message = toApiErrorMessage(error, "Failed to submit correction");
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

    try {
      await notifyCorrectionReviewed(request);
    } catch (notificationError) {
      console.error("Correction review notification error:", notificationError);
    }

    return NextResponse.json({ success: true, request });
  } catch (error: unknown) {
    const message = toApiErrorMessage(error, "Failed to review correction");
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
});
