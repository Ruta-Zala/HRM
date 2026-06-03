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
      effectiveFrom,
      effectiveTo: String(body.effectiveTo ?? ""),
      basic: Number(body.basic ?? 0),
      hra: Number(body.hra ?? 0),
      organisationAllowance: Number(body.organisationAllowance ?? 0),
      loyaltyBonus: Number(body.loyaltyBonus ?? 10),
      professionalTax: Number(body.professionalTax ?? 200),
      lwf: Number(body.lwf ?? 0),
      revisionNote: String(body.revisionNote ?? ""),
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
