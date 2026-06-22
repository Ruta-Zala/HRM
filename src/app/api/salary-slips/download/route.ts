import { NextResponse } from "next/server";

import { withActiveSession } from "@/lib/auth/api-guard";
import { canManageEmployees } from "@/lib/auth/roles";
import { downloadDriveFileBufferById } from "@/lib/google/drive";
import { listSalarySlips } from "@/lib/salary-slips/sheets";

const SLIP_ID_PATTERN = /^[\w-]+$/;

function monthLabel(month: number): string {
  return new Date(Date.UTC(2026, month - 1, 1)).toLocaleString("en-IN", { month: "short" });
}

export const GET = withActiveSession(async (req, user) => {
  const slipId = req.nextUrl.searchParams.get("slipId")?.trim();
  if (!slipId || !SLIP_ID_PATTERN.test(slipId)) {
    return NextResponse.json({ success: false, message: "Invalid slip id" }, { status: 400 });
  }

  const slips = await listSalarySlips();
  const slip = slips.find((s) => s.slipId === slipId && s.status !== "Deleted");
  if (!slip) {
    return NextResponse.json({ success: false, message: "Salary slip not found" }, { status: 404 });
  }

  const canManage = canManageEmployees(user.role);
  if (!canManage && slip.employeeSheetRow !== user.sheetRow) {
    return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
  }
  if (!slip.driveFileId) {
    return NextResponse.json({ success: false, message: "Drive file missing" }, { status: 404 });
  }

  try {
    const { buffer, mimeType } = await downloadDriveFileBufferById(slip.driveFileId);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": mimeType,
        "Content-Disposition": `attachment; filename="${slip.driveFileName || `${monthLabel(slip.month)}.pdf`}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error: unknown) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Failed to download salary slip",
      },
      { status: 500 },
    );
  }
});
