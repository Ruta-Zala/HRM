import { NextResponse } from "next/server";

import { withActiveSession } from "@/lib/auth/api-guard";
import { resolveEmployeeRecordForSession } from "@/lib/auth/employee-record";
import { redactPasswordFromRow } from "@/lib/auth/row-credentials";
import { canManageEmployees } from "@/lib/auth/server";
import { redactHrOnlyFieldsFromRow } from "@/lib/employee/list-access";
import { sheetRowToForm } from "@/lib/employee";

export const GET = withActiveSession(async (_request, user) => {
  try {
    const record = await resolveEmployeeRecordForSession(user);
    if (!record) {
      return NextResponse.json(
        { success: false, message: "No employee record linked to your account." },
        { status: 404 },
      );
    }

    const { headers, row, sheetRow } = record;
    const rawForm = sheetRowToForm(headers, row);
    const hasPassword = Boolean(rawForm.password.trim());
    const canManage = canManageEmployees(user.role);
    let safeRow = redactPasswordFromRow(headers, row);
    if (!canManage) {
      safeRow = redactHrOnlyFieldsFromRow(headers, safeRow);
    }
    const form = sheetRowToForm(headers, safeRow);

    return NextResponse.json({
      success: true,
      sheetRow,
      headers,
      row: safeRow,
      username: form.username.trim(),
      hasPassword,
    });
  } catch (error: unknown) {
    console.error("GET employee/me error:", error);
    const message = error instanceof Error ? error.message : "Failed to load your profile.";
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
});
