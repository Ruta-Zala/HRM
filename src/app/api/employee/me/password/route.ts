import { NextResponse } from "next/server";

import { withActiveSession } from "@/lib/auth/api-guard";
import { resolveEmployeeRecordForSession } from "@/lib/auth/employee-record";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { passwordStrengthError } from "@/lib/auth/password-rules";
import {
  headerToFormKey,
  sheetRowToForm,
  sheetRowToRange,
  withSheetRowUpdatedAt,
} from "@/lib/employee";
import { updateSheetRow } from "@/lib/google/sheets";

export const PATCH = withActiveSession(async (req, user) => {
  try {
    const body = (await req.json()) as {
      currentPassword?: string;
      newPassword?: string;
      confirmPassword?: string;
    };

    const newPassword = body.newPassword?.trim() ?? "";
    const confirmPassword = body.confirmPassword?.trim() ?? "";
    const currentPassword = body.currentPassword ?? "";

    if (!newPassword || !confirmPassword) {
      return NextResponse.json(
        { success: false, message: "New password and confirmation are required." },
        { status: 400 },
      );
    }

    const strengthError = passwordStrengthError(newPassword);
    if (strengthError) {
      return NextResponse.json({ success: false, message: strengthError }, { status: 400 });
    }

    if (newPassword !== confirmPassword) {
      return NextResponse.json(
        { success: false, message: "New password and confirmation do not match." },
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

    const { headers, row, sheetRow } = record;
    const form = sheetRowToForm(headers, row);
    const storedPassword = form.password.trim();
    const hasPassword = Boolean(storedPassword);

    if (hasPassword) {
      if (!currentPassword) {
        return NextResponse.json(
          { success: false, message: "Current password is required." },
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
    }

    const passwordIndex = headers.findIndex((h) => headerToFormKey(h) === "password");
    if (passwordIndex < 0) {
      return NextResponse.json(
        {
          success: false,
          message: "Password column is missing from the employee sheet. Contact HR.",
        },
        { status: 500 },
      );
    }

    const hashed = await hashPassword(newPassword);
    const updatedRow = [...row];
    updatedRow[passwordIndex] = hashed;

    const range = sheetRowToRange(sheetRow, headers.length);
    await updateSheetRow(range, [withSheetRowUpdatedAt(headers, updatedRow)]);

    return NextResponse.json({
      success: true,
      message: hasPassword ? "Password updated successfully." : "Password created successfully.",
    });
  } catch (error: unknown) {
    console.error("PATCH employee/me/password error:", error);
    const message = error instanceof Error ? error.message : "Failed to update password.";
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
});
