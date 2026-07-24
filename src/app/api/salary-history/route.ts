import { NextResponse } from "next/server";

import { withActiveSession } from "@/lib/auth/api-guard";
import { canManageEmployees } from "@/lib/auth/roles";
import {
  cleanupCorruptSalaryHistoryRecords,
  createSalaryHistoryRecord,
  listSalaryHistoryRecords,
} from "@/lib/salary-slips/sheets";

export const GET = withActiveSession(async (req, user) => {
  if (!canManageEmployees(user.role)) {
    return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
  }

  try {
    // Remove broken Active rows (e.g. date in name column, blank start, Rs. 0 basic).
    await cleanupCorruptSalaryHistoryRecords();

    const employeeSheetRowParam = req.nextUrl.searchParams.get("employeeSheetRow");
    const employeeSheetRow = employeeSheetRowParam ? Number(employeeSheetRowParam) : null;
    const rows = await listSalaryHistoryRecords({ validOnly: true });
    const filtered =
      employeeSheetRow && Number.isFinite(employeeSheetRow)
        ? rows.filter((r) => r.employeeSheetRow === employeeSheetRow)
        : rows;

    return NextResponse.json({ success: true, records: filtered });
  } catch (error: unknown) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Failed to load salary history",
      },
      { status: 500 },
    );
  }
});

export const POST = withActiveSession(async (req, user) => {
  if (!canManageEmployees(user.role)) {
    return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const employeeSheetRow = Number(body.employeeSheetRow);
    const employeeName = String(body.employeeName ?? "").trim();
    const effectiveFrom = String(body.effectiveFrom ?? "").trim();
    if (!Number.isFinite(employeeSheetRow) || employeeSheetRow < 2) {
      return NextResponse.json(
        { success: false, message: "Valid employeeSheetRow is required" },
        { status: 400 },
      );
    }
    if (!effectiveFrom) {
      return NextResponse.json(
        { success: false, message: "effectiveFrom is required" },
        { status: 400 },
      );
    }

    await createSalaryHistoryRecord({
      employeeSheetRow,
      employeeName,
      effectiveFrom,
      basic: Number(body.basic ?? 0),
      loyaltyBonus: Number(body.loyaltyBonus ?? 10),
      professionalTax: Number(body.professionalTax ?? 200),
      status: body.status === "Inactive" ? "Inactive" : "Active",
    });

    return NextResponse.json({ success: true, message: "Salary history saved" });
  } catch (error: unknown) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Failed to save salary history",
      },
      { status: 500 },
    );
  }
});
