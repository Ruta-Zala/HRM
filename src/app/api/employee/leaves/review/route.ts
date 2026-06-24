import { NextResponse } from "next/server";

import { withActiveSession } from "@/lib/auth/api-guard";
import { canManageEmployees } from "@/lib/auth/roles";
import { reviewLeaveApplication } from "@/lib/attendance/leave-approvals";
import { LEAVE_STATUS } from "@/lib/attendance/leave-status";
import type { LeaveBucketType } from "@/lib/attendance/leave-bucket-layout";

function normalizeReviewStatus(
  value: unknown,
): typeof LEAVE_STATUS.ACCEPTED | typeof LEAVE_STATUS.REJECTED | null {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase();

  if (normalized === "accepted" || normalized === "approve" || normalized === "approved") {
    return LEAVE_STATUS.ACCEPTED;
  }

  if (normalized === "rejected" || normalized === "reject") {
    return LEAVE_STATUS.REJECTED;
  }

  return null;
}

export const PATCH = withActiveSession(async (req, user) => {
  if (!canManageEmployees(user.role)) {
    return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const attendanceSpreadsheetId = String(body.attendanceSpreadsheetId ?? "").trim();
    const rowIndex = Number(body.rowIndex);
    const leaveType = String(body.leaveType ?? "")
      .trim()
      .toLowerCase() as LeaveBucketType;
    const status = normalizeReviewStatus(body.status);
    const rejectReason = String(body.rejectReason ?? "").trim();

    if (!attendanceSpreadsheetId || !Number.isInteger(rowIndex) || rowIndex < 1) {
      return NextResponse.json(
        { success: false, message: "Invalid leave application reference" },
        { status: 400 },
      );
    }

    if (!status) {
      return NextResponse.json(
        { success: false, message: "Status must be Accepted or Rejected" },
        { status: 400 },
      );
    }

    await reviewLeaveApplication({
      attendanceSpreadsheetId,
      rowIndex,
      leaveType,
      status,
      rejectReason,
    });

    return NextResponse.json({
      success: true,
      message: `Leave request ${status.toLowerCase()}`,
    });
  } catch (error) {
    console.error("PATCH Leave Review Error:", error);

    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Failed to review leave request",
      },
      { status: 500 },
    );
  }
});
