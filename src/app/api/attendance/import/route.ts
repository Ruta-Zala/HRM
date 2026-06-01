import { NextResponse } from "next/server";

import { parseLegacyAttendanceCsv } from "@/lib/attendance/parse-import-csv";
import { resolveAttendanceEmployeeForTarget } from "@/lib/attendance/employee";
import { importAttendanceRecords } from "@/lib/google/attendance-sheets";
import { withActiveSession } from "@/lib/auth/api-guard";
import { canManageEmployees } from "@/lib/auth/roles";

export const POST = withActiveSession(async (req, user) => {
  try {
    if (!canManageEmployees(user.role)) {
      return NextResponse.json(
        { success: false, message: "Only HR can import attendance" },
        { status: 403 },
      );
    }

    const formData = await req.formData();
    const file = formData.get("file");
    const employeeSheetRowParam = formData.get("employeeSheetRow");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { success: false, message: "CSV file is required" },
        { status: 400 },
      );
    }

    const targetSheetRow =
      employeeSheetRowParam != null ? parseInt(String(employeeSheetRowParam), 10) : user.sheetRow;

    if (!Number.isFinite(targetSheetRow) || targetSheetRow! < 2) {
      return NextResponse.json(
        { success: false, message: "Valid employee is required" },
        { status: 400 },
      );
    }

    const sheetRow = targetSheetRow as number;
    const csvText = await file.text();
    const parsed = parseLegacyAttendanceCsv(csvText);

    if (parsed.errors.length > 0 && parsed.rows.filter((r) => !r.skipped).length === 0) {
      return NextResponse.json(
        {
          success: false,
          message: "Could not parse CSV",
          errors: parsed.errors,
        },
        { status: 400 },
      );
    }

    const employee = await resolveAttendanceEmployeeForTarget(user, sheetRow);
    if (!employee?.attendanceSpreadsheetId) {
      return NextResponse.json(
        { success: false, message: "Employee attendance spreadsheet not found" },
        { status: 404 },
      );
    }

    const toImport = parsed.rows
      .filter((r) => !r.skipped)
      .map((r) => ({
        dateIso: r.dateIso,
        punchIn: r.punchIn,
        punchOut: r.punchOut,
        dailyUpdate: r.dailyUpdate,
        workMode: r.workMode,
      }));

    const result = await importAttendanceRecords(employee.attendanceSpreadsheetId, toImport);

    return NextResponse.json({
      success: true,
      message: `Imported ${result.imported} new and updated ${result.updated} existing record(s).`,
      imported: result.imported,
      updated: result.updated,
      holidaysSkipped: parsed.skipped,
      errors: parsed.errors,
      employee: {
        employeeId: employee.employeeId,
        employeeName: employee.employeeName,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Import failed";
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
});
