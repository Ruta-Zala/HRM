import { NextResponse } from "next/server";

import { withActiveSession } from "@/lib/auth/api-guard";
import { canManageEmployees } from "@/lib/auth/roles";
import { sheetRowToForm } from "@/lib/employee";
import {
  getOrCreateSalarySlipsYearFolder,
  trashDriveFile,
  uploadBinaryFileToFolder,
} from "@/lib/google/drive";
import { EMPLOYEE_SHEET_RANGE, readSheet } from "@/lib/google/sheets";
import { amountToIndianWords, calculateSalaryBreakdown } from "@/lib/salary-slips/calculation";
import { renderSalarySlipPdf } from "@/lib/salary-slips/pdf";
import { getMonthAttendance, type AttendanceRow } from "@/lib/google/attendance-sheets";
import { WORK_MODE } from "@/lib/attendance/constants";
import {
  findEffectiveSalaryForPeriodFromRecords,
  listSalaryHistoryRecords,
  listSalarySlips,
  saveSalarySlipRecord,
  updateSalarySlipRecord,
} from "@/lib/salary-slips/sheets";

function monthLabel(month: number): string {
  return new Date(Date.UTC(2026, month - 1, 1)).toLocaleString("en-IN", { month: "short" });
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function countWeekdaysInMonth(year: number, month: number): number {
  let count = 0;
  const days = getDaysInMonth(year, month);
  for (let day = 1; day <= days; day += 1) {
    const date = new Date(year, month - 1, day);
    const dayOfWeek = date.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      count += 1;
    }
  }
  return count;
}

function getWorkModeDayValue(workMode: string): number | null {
  const normalized = String(workMode ?? "").trim();
  if (
    normalized === WORK_MODE.FULL_DAY_LEAVE ||
    normalized === WORK_MODE.PAID_LEAVE ||
    normalized === WORK_MODE.SICK_LEAVE ||
    normalized === WORK_MODE.CASUAL_LEAVE ||
    normalized === WORK_MODE.UNPAID_LEAVE ||
    normalized === WORK_MODE.SL ||
    normalized === WORK_MODE.PUBLIC_HOLIDAY ||
    normalized === WORK_MODE.WEEKEND_HOLIDAY
  ) {
    return 0;
  }

  if (
    normalized === WORK_MODE.HALF_DAY_PAID_LEAVE ||
    normalized === WORK_MODE.HALF_DAY_UNPAID_LEAVE ||
    normalized === WORK_MODE.HALF_DAY_LEAVE ||
    normalized === WORK_MODE.WFH_HALF_DAY
  ) {
    return 0.5;
  }

  return null;
}

function getAttendanceWorkingDays(
  year: number,
  month: number,
  attendanceRows: AttendanceRow[],
): number {
  const rowsByDate = new Map<string, AttendanceRow>();
  attendanceRows.forEach((row) => {
    if (row.date) rowsByDate.set(row.date, row);
  });

  let workingDays = 0;
  const days = getDaysInMonth(year, month);
  for (let day = 1; day <= days; day += 1) {
    const date = new Date(year, month - 1, day);
    const dayOfWeek = date.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) continue;

    const dateIso = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const attendance = rowsByDate.get(dateIso);
    if (!attendance) {
      workingDays += 1;
      continue;
    }

    const value = getWorkModeDayValue(attendance.workMode);
    workingDays += value ?? 1;
  }

  return workingDays;
}

function getEmployeeField(row: string[], headers: string[], candidates: string[]): string {
  const idx = headers.findIndex((h) =>
    candidates.includes(
      h
        .trim()
        .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
        .replace(/\s+/g, "_")
        .toLowerCase(),
    ),
  );
  return idx >= 0 ? String(row[idx] ?? "").trim() : "";
}

export const GET = withActiveSession(async (req, user) => {
  try {
    const { searchParams } = new URL(req.url);
    const mode = searchParams.get("mode") ?? "list";
    if (mode !== "list") {
      return NextResponse.json({ success: false, message: "Unsupported mode" }, { status: 400 });
    }

    const canManage = canManageEmployees(user.role);
    const employeeSheetRowParam = searchParams.get("employeeSheetRow");
    const yearParam = searchParams.get("year");
    const monthParam = searchParams.get("month");
    const employeeSheetRow =
      employeeSheetRowParam && Number.isFinite(Number(employeeSheetRowParam))
        ? Number(employeeSheetRowParam)
        : null;
    const year = yearParam && Number.isFinite(Number(yearParam)) ? Number(yearParam) : null;
    const month = monthParam && Number.isFinite(Number(monthParam)) ? Number(monthParam) : null;

    let rows = await listSalarySlips();
    rows = rows.filter((r) => r.status !== "Deleted");
    if (!canManage) {
      rows = rows.filter((r) => r.employeeSheetRow === user.sheetRow);
    } else if (employeeSheetRow) {
      rows = rows.filter((r) => r.employeeSheetRow === employeeSheetRow);
    }
    if (year) rows = rows.filter((r) => r.year === year);
    if (month) rows = rows.filter((r) => r.month === month);

    return NextResponse.json({ success: true, slips: rows });
  } catch (error: unknown) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Failed to list salary slips",
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
    const { searchParams } = new URL(req.url);
    const mode = searchParams.get("mode");
    if (mode !== "generate") {
      return NextResponse.json({ success: false, message: "Unsupported mode" }, { status: 400 });
    }

    const body = await req.json();
    const year = Number(body.year);
    const month = Number(body.month);
    const overrideExisting = Boolean(body.overrideExisting);
    const targetSheetRow =
      body.employeeSheetRow != null && Number.isFinite(Number(body.employeeSheetRow))
        ? Number(body.employeeSheetRow)
        : null;
    if (!Number.isFinite(year) || year < 2000 || year > 3000) {
      return NextResponse.json({ success: false, message: "Invalid year" }, { status: 400 });
    }
    if (!Number.isFinite(month) || month < 1 || month > 12) {
      return NextResponse.json(
        { success: false, message: "Invalid month. Use 1-12." },
        { status: 400 },
      );
    }

    const employeeSheet = await readSheet(EMPLOYEE_SHEET_RANGE);
    if (employeeSheet.length < 2) {
      return NextResponse.json({ success: false, message: "No employees found" }, { status: 400 });
    }
    const headers = employeeSheet[0] as string[];
    const allSlips = await listSalarySlips();

    async function resolveWorkingDaysForEmployee(
      year: number,
      month: number,
      attendanceSpreadsheetId: string,
    ): Promise<number> {
      const scheduledWeekdays = countWeekdaysInMonth(year, month);
      if (!attendanceSpreadsheetId?.trim()) return scheduledWeekdays;

      try {
        const attendanceRows = await getMonthAttendance(attendanceSpreadsheetId, year, month - 1);
        if (!attendanceRows.length) {
          return scheduledWeekdays;
        }
        const attendanceBasedDays = getAttendanceWorkingDays(year, month, attendanceRows);
        return Number.isFinite(attendanceBasedDays) ? attendanceBasedDays : scheduledWeekdays;
      } catch {
        return scheduledWeekdays;
      }
    }

    const generated: Array<{ employeeSheetRow: number; slipId: string; fileName: string }> = [];
    // Preload salary history once to avoid repeated Sheets API reads inside the loop
    const salaryHistory = await listSalaryHistoryRecords();
    for (let i = 1; i < employeeSheet.length; i += 1) {
      const sheetRow = i + 1;
      if (targetSheetRow && targetSheetRow !== sheetRow) continue;
      const row = employeeSheet[i] ?? [];
      const form = sheetRowToForm(headers, row);
      if (form.status.toLowerCase() !== "active") continue;

      const existing = allSlips.find(
        (s) =>
          s.employeeSheetRow === sheetRow &&
          s.year === year &&
          s.month === month &&
          s.status !== "Deleted",
      );
      if (existing && !overrideExisting) {
        continue;
      }

      const periodStart = `${year}-${String(month).padStart(2, "0")}-01`;
      const periodEnd = `${year}-${String(month).padStart(2, "0")}-${String(getDaysInMonth(year, month)).padStart(2, "0")}`;
      const history = findEffectiveSalaryForPeriodFromRecords(salaryHistory, {
        employeeSheetRow: sheetRow,
        periodStart,
        periodEnd,
      });
      if (!history) continue;

      const workingDays = await resolveWorkingDaysForEmployee(
        year,
        month,
        form.attendanceSpreadsheetId ?? "",
      );
      const netPayableDays = workingDays;
      const breakdown = calculateSalaryBreakdown({
        basic: history.basic,
        loyaltyBonus: history.loyaltyBonus,
        professionalTax: history.professionalTax > 0 ? history.professionalTax : 200,
        workingDays,
        netPayableDays,
      });
      const amountInWords = amountToIndianWords(breakdown.netPay);
      const { yearFolderId } = await getOrCreateSalarySlipsYearFolder({
        employeeId: form.employeeId || `EMP${String(sheetRow - 1).padStart(3, "0")}`,
        employeeName: form.name || "Employee",
        year,
      });

      const fileName = `${monthLabel(month)}.pdf`;
      const pdf = await renderSalarySlipPdf({
        companyName: "ExhiByte Solutions",
        companyAddress:
          "364, Raj Imperia, Vraj Chowk, Vrajbhoomi Ground, Nana Varachha, Surat, Gujarat 395006",
        payTitle: `Pay Slip For the Month of ${monthLabel(month)}-${year}`,
        payRange: `(From ${periodStart.split("-").reverse().join("/")} To ${periodEnd.split("-").reverse().join("/")})`,
        employeeName: form.name,
        employeeCode: form.employeeId || `EMP${String(sheetRow - 1).padStart(3, "0")}`,
        fatherName: form.parentName,
        pan: form.panNumber || getEmployeeField(row, headers, ["pan", "pan_number"]),
        bankAccountNo:
          form.bankAccountNumber ||
          getEmployeeField(row, headers, [
            "bank_account_number",
            "bank_account_no",
            "bank_a_c_no",
            "bank_ac_no",
          ]),
        designation: form.position,
        ifsc: getEmployeeField(row, headers, ["ifsc", "ifsc_code"]),
        netPayableDays,
        aadharNo:
          form.aadharNumber ||
          getEmployeeField(row, headers, ["aadhar_number", "aadhaar_number", "aadhaar"]),
        workingDays,
        basic: breakdown.basic,
        loyaltyBonusRate: history.loyaltyBonus > 0 ? history.loyaltyBonus : 10,
        loyaltyBonus: breakdown.loyaltyBonus,
        professionalTax: breakdown.professionalTax,
        totalEarnings: breakdown.totalEarnings,
        totalDeductions: breakdown.totalDeductions,
        netPay: breakdown.netPay,
        amountInWords,
      });

      const uploaded = await uploadBinaryFileToFolder(
        fileName,
        "application/pdf",
        pdf,
        yearFolderId,
      );

      const slipId = await saveSalarySlipRecord({
        employeeSheetRow: sheetRow,
        employeeName: form.name ?? "",
        year,
        month,
        title: `${monthLabel(month)} ${year}`,
        workingDays,
        netPayableDays,
        basic: breakdown.basic,
        totalEarnings: breakdown.totalEarnings,
        loyaltyBonus: breakdown.loyaltyBonus,
        professionalTax: breakdown.professionalTax,
        totalDeductions: breakdown.totalDeductions,
        netPay: breakdown.netPay,
        amountInWords,
        status: "Released",
        driveFileId: uploaded.fileId,
        driveFileName: uploaded.fileName,
        driveParentFolderId: yearFolderId,
        releasedAt: new Date().toISOString(),
        deletedAt: "",
      });
      generated.push({ employeeSheetRow: sheetRow, slipId, fileName: uploaded.fileName });
    }

    return NextResponse.json({ success: true, generated });
  } catch (error: unknown) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Failed to generate salary slips",
      },
      { status: 500 },
    );
  }
});

export const DELETE = withActiveSession(async (req, user) => {
  if (!canManageEmployees(user.role)) {
    return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
  }
  try {
    const { searchParams } = new URL(req.url);
    const slipId = searchParams.get("slipId")?.trim();
    if (!slipId) {
      return NextResponse.json({ success: false, message: "slipId is required" }, { status: 400 });
    }
    const shouldTrash = searchParams.get("trashFile") === "true";
    const slips = await listSalarySlips();
    const row = slips.find((s) => s.slipId === slipId);
    if (!row) {
      return NextResponse.json({ success: false, message: "Slip not found" }, { status: 404 });
    }

    if (shouldTrash && row.driveFileId) {
      await trashDriveFile(row.driveFileId);
    }
    await updateSalarySlipRecord(row.sheetRow, {
      status: "Deleted",
      deletedAt: new Date().toISOString(),
    });
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Failed to delete salary slip",
      },
      { status: 500 },
    );
  }
});
