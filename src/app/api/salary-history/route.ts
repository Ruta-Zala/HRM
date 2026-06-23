import { NextResponse } from "next/server";

import { withActiveSession } from "@/lib/auth/api-guard";
import { canManageEmployees } from "@/lib/auth/roles";
import { createSalaryHistoryRecord, listSalaryHistoryRecords } from "@/lib/salary-slips/sheets";

export const GET = withActiveSession(async (req, user) => {
  if (!canManageEmployees(user.role)) {
    return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
  }

  const employeeSheetRowParam = req.nextUrl.searchParams.get("employeeSheetRow");
  const employeeSheetRow = employeeSheetRowParam ? Number(employeeSheetRowParam) : null;
  const rows = await listSalaryHistoryRecords();
  const filtered =
    employeeSheetRow && Number.isFinite(employeeSheetRow)
      ? rows.filter((r) => r.employeeSheetRow === employeeSheetRow)
      : rows;

  return NextResponse.json({ success: true, records: filtered });
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

    const effectiveFromDate = new Date(effectiveFrom);

    const effectiveToDate = new Date(effectiveFromDate);
    effectiveToDate.setFullYear(effectiveToDate.getFullYear() + 1);
    effectiveToDate.setDate(effectiveToDate.getDate() - 1);

    const effectiveTo = effectiveToDate.toISOString().split("T")[0];

    await createSalaryHistoryRecord({
      employeeSheetRow,
      employeeName,
      effectiveFrom,
      effectiveTo,
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
