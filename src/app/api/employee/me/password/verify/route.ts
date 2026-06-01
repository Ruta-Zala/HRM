import { NextResponse } from "next/server";

import { withActiveSession } from "@/lib/auth/api-guard";
import { resolveEmployeeRecordForSession } from "@/lib/auth/employee-record";
import { verifyPassword } from "@/lib/auth/password";
import { sheetRowToForm } from "@/lib/employee";

export const POST = withActiveSession(async (req, user) => {
  try {
    const body = (await req.json()) as { currentPassword?: string };
    const currentPassword = body.currentPassword ?? "";

    if (!currentPassword) {
      return NextResponse.json(
        { success: false, message: "Current password is required." },
        { status: 400 },
      );
    }

    const record = await resolveEmployeeRecordForSession(user);
    if (!record) {
      return NextResponse.json(
        { success: false, message: "No employee record linked to your account." },
        { status: 404 },
      );
    }

    const form = sheetRowToForm(record.headers, record.row);
    const storedPassword = form.password.trim();

    if (!storedPassword) {
      return NextResponse.json(
        { success: false, message: "No password is set for your account yet." },
        { status: 400 },
      );
    }

    const valid = await verifyPassword(currentPassword, storedPassword);
    if (!valid) {
      return NextResponse.json(
        { success: false, message: "Current password is incorrect." },
        { status: 400 },
      );
    }

    return NextResponse.json({
      success: true,
      message: "Password verified successfully.",
    });
  } catch (error: unknown) {
    console.error("POST employee/me/password/verify error:", error);
    const message = error instanceof Error ? error.message : "Failed to verify password.";
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
});
