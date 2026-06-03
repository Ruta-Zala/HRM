import { NextResponse } from "next/server";

import {
  EARLY_LEAVE_REASON_MIN_LENGTH,
  IDEAL_BREAK_HOURS,
  IDEAL_SHIFT_HOURS,
  IDEAL_WORKING_HOURS,
  WORK_MODE,
  WORK_MODE_OPTIONS,
} from "@/lib/attendance/constants";
import { formatBreakAllowance, parseDurationToMs, parseTimeOnDate } from "@/lib/attendance/time";
import { resolveAttendanceEmployeeForTarget } from "@/lib/attendance/employee";
import {
  computeLiveWorkedMs,
  endBreak,
  getMonthAttendance,
  getTodayAttendance,
  listAttendanceMonthlySheetsAcrossYears,
  punchIn,
  punchOut,
  startBreak,
  updateDailyUpdate,
} from "@/lib/google/attendance-sheets";
import {
  formatDuration,
  formatDurationHms,
  monthLabel,
  parseMonthlySheetTitle,
} from "@/lib/attendance/time";
import { withActiveSession } from "@/lib/auth/api-guard";
import { canManageEmployees } from "@/lib/auth/roles";
import { formatGoogleApiClientMessage } from "@/lib/google/drive-auth";

function parseTargetSheetRow(searchParams: URLSearchParams, userSheetRow?: number) {
  const param = searchParams.get("employeeSheetRow");
  if (param == null || param === "") return userSheetRow;
  const parsed = parseInt(param, 10);
  return Number.isFinite(parsed) && parsed >= 2 ? parsed : userSheetRow;
}

export const GET = withActiveSession(async (req, user) => {
  try {
    const { searchParams } = new URL(req.url);
    const targetSheetRow = parseTargetSheetRow(searchParams, user.sheetRow);
    const employee = await resolveAttendanceEmployeeForTarget(user, targetSheetRow);
    if (!employee?.attendanceSpreadsheetId) {
      return NextResponse.json(
        { success: false, message: "Employee attendance record not found" },
        { status: 404 },
      );
    }

    const mode = searchParams.get("mode");

    if (mode === "periods") {
      const sheets = await listAttendanceMonthlySheetsAcrossYears(employee.attendanceSpreadsheetId);
      const years = new Set<number>();
      const monthsByYear = new Map<number, number[]>();

      for (const title of sheets) {
        const parsed = parseMonthlySheetTitle(title);
        if (!parsed) continue;
        years.add(parsed.year);
        const months = monthsByYear.get(parsed.year) ?? [];
        if (!months.includes(parsed.month)) {
          months.push(parsed.month);
        }
        monthsByYear.set(parsed.year, months);
      }

      const sortedYears = [...years].sort((a, b) => b - a);
      const periods = sortedYears.map((year) => ({
        year,
        months: (monthsByYear.get(year) ?? [])
          .sort((a, b) => a - b)
          .map((month) => ({
            month,
            label: monthLabel(month),
          })),
      }));

      return NextResponse.json({ success: true, periods });
    }

    const yearParam = searchParams.get("year");
    const monthParam = searchParams.get("month");

    if (yearParam != null && monthParam != null) {
      const year = parseInt(yearParam, 10);
      const month = parseInt(monthParam, 10);
      if (!Number.isFinite(year) || !Number.isFinite(month) || month < 0 || month > 11) {
        return NextResponse.json(
          { success: false, message: "Invalid year or month" },
          { status: 400 },
        );
      }

      const records = await getMonthAttendance(employee.attendanceSpreadsheetId, year, month);

      return NextResponse.json({
        success: true,
        records: records.map((r) => ({
          id: r.date,
          date: r.date,
          workMode: r.workMode,
          punchIn: r.punchIn,
          punchOut: r.punchOut,
          breakTime: r.totalBreakTime,
          workingHours: r.workingHours,
          overtime: r.overtime,
          status: r.status,
          overtimeApproval: r.isOvertimeApproved,
          earlyLeaveReason: r.earlyLeaveReason,
          dailyUpdate: r.dailyUpdate,
        })),
      });
    }

    const today = await getTodayAttendance(employee.attendanceSpreadsheetId);
    const workedMs = today ? computeLiveWorkedMs(today) : 0;
    const idealHours = today?.workMode === WORK_MODE.HALF_DAY_LEAVE ? 4 : IDEAL_WORKING_HOURS;
    const idealBreakHours = today?.workMode === WORK_MODE.HALF_DAY_LEAVE ? 0 : IDEAL_BREAK_HOURS;
    const idealMs = idealHours * 60 * 60 * 1000;
    const remainingMs = Math.max(0, idealMs - workedMs);
    const onBreak = Boolean(today?.breakStart?.trim() && !today?.breakEnd?.trim());
    let breakUsedMs = today ? parseDurationToMs(today.totalBreakTime) : 0;
    if (today && onBreak && today.breakStart) {
      const breakStartMs = parseTimeOnDate(today.breakStart, new Date(today.date));
      if (breakStartMs != null) {
        breakUsedMs += Math.max(0, Date.now() - breakStartMs);
      }
    }

    return NextResponse.json({
      success: true,
      today: today
        ? {
            date: today.date,
            punchIn: today.punchIn,
            punchOut: today.punchOut,
            workMode: today.workMode,
            breakStart: today.breakStart,
            breakEnd: today.breakEnd,
            totalBreakTime: today.totalBreakTime,
            workingHours: today.workingHours,
            overtime: today.punchOut.trim() ? today.overtime : "—",
            status: today.status,
            onBreak,
            hasPunchedIn: Boolean(today.punchIn?.trim()),
            hasPunchedOut: Boolean(today.punchOut?.trim()),
            workedMs,
            workedFormatted: formatDurationHms(workedMs),
            workedShort: formatDuration(workedMs),
            idealHours,
            idealBreakHours,
            idealShiftHours: idealHours + idealBreakHours,
            remainingMs,
            remainingFormatted: formatDuration(remainingMs),
            breakAllowanceFormatted: formatBreakAllowance(breakUsedMs),
            earlyLeaveReason: today.earlyLeaveReason ?? "",
            dailyUpdate: today.dailyUpdate ?? "",
          }
        : null,
    });
  } catch (error: unknown) {
    const message = formatGoogleApiClientMessage(error, {
      forHrAdmin: canManageEmployees(user.role),
    });
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
});

export const POST = withActiveSession(async (req, user) => {
  try {
    const employee = await resolveAttendanceEmployeeForTarget(user, user.sheetRow);
    if (!employee?.attendanceSpreadsheetId) {
      return NextResponse.json(
        { success: false, message: "Employee attendance record not found" },
        { status: 404 },
      );
    }

    const body = await req.json();
    const action = String(body.action ?? "");
    const earlyLeaveReason =
      typeof body.earlyLeaveReason === "string" ? body.earlyLeaveReason.trim() : "";
    const dailyUpdate = typeof body.dailyUpdate === "string" ? body.dailyUpdate.trim() : "";
    const workMode = typeof body.workMode === "string" ? body.workMode.trim() : "";

    if (action === "punch-out" && earlyLeaveReason.length > 0) {
      if (earlyLeaveReason.length < EARLY_LEAVE_REASON_MIN_LENGTH) {
        return NextResponse.json(
          {
            success: false,
            message: `Early leave reason must be at least ${EARLY_LEAVE_REASON_MIN_LENGTH} characters`,
          },
          { status: 400 },
        );
      }
    }
    if (action === "punch-out" && !dailyUpdate) {
      return NextResponse.json(
        { success: false, message: "Please share today's completed tasks before punch out" },
        { status: 400 },
      );
    }

    let record;
    switch (action) {
      case "punch-in":
        if (
          !workMode ||
          !WORK_MODE_OPTIONS.includes(workMode as (typeof WORK_MODE_OPTIONS)[number])
        ) {
          return NextResponse.json(
            { success: false, message: "Please select a valid work mode before punch in" },
            { status: 400 },
          );
        }
        record = await punchIn(employee.attendanceSpreadsheetId, new Date(), { workMode });
        break;
      case "punch-out":
        record = await punchOut(employee.attendanceSpreadsheetId, new Date(), {
          earlyLeaveReason: earlyLeaveReason || undefined,
          dailyUpdate,
        });
        break;
      case "break-start":
        record = await startBreak(employee.attendanceSpreadsheetId);
        break;
      case "break-end":
        record = await endBreak(employee.attendanceSpreadsheetId);
        break;
      default:
        return NextResponse.json({ success: false, message: "Invalid action" }, { status: 400 });
    }

    const workedMs = computeLiveWorkedMs(record);

    return NextResponse.json({
      success: true,
      record: {
        date: record.date,
        punchIn: record.punchIn,
        punchOut: record.punchOut,
        workMode: record.workMode,
        breakStart: record.breakStart,
        breakEnd: record.breakEnd,
        totalBreakTime: record.totalBreakTime,
        workingHours: record.workingHours,
        overtime: record.overtime,
        status: record.status,
        onBreak: Boolean(record.breakStart?.trim() && !record.breakEnd?.trim()),
        hasPunchedIn: Boolean(record.punchIn?.trim()),
        hasPunchedOut: Boolean(record.punchOut?.trim()),
        workedMs,
        workedFormatted: formatDurationHms(workedMs),
        earlyLeaveReason: record.earlyLeaveReason ?? "",
        dailyUpdate: record.dailyUpdate ?? "",
        idealHours: record.workMode === WORK_MODE.HALF_DAY_LEAVE ? 4 : IDEAL_WORKING_HOURS,
        idealBreakHours: record.workMode === WORK_MODE.HALF_DAY_LEAVE ? 0 : IDEAL_BREAK_HOURS,
        idealShiftHours: record.workMode === WORK_MODE.HALF_DAY_LEAVE ? 4 : IDEAL_SHIFT_HOURS,
      },
    });
  } catch (error: unknown) {
    const message = formatGoogleApiClientMessage(error, {
      forHrAdmin: canManageEmployees(user.role),
    });
    const status =
      message.includes("Already") ||
      message.includes("first") ||
      message.includes("break") ||
      message.includes("reason") ||
      message.includes("tasks")
        ? 400
        : 500;
    return NextResponse.json({ success: false, message }, { status });
  }
});

export const PATCH = withActiveSession(async (req, user) => {
  try {
    const employee = await resolveAttendanceEmployeeForTarget(user, user.sheetRow);
    if (!employee?.attendanceSpreadsheetId) {
      return NextResponse.json(
        { success: false, message: "Employee attendance record not found" },
        { status: 404 },
      );
    }

    const body = await req.json();
    const date = typeof body.date === "string" ? body.date.trim() : "";
    const dailyUpdate = typeof body.dailyUpdate === "string" ? body.dailyUpdate.trim() : "";
    if (!date) {
      return NextResponse.json(
        { success: false, message: "Date is required for daily update" },
        { status: 400 },
      );
    }
    if (!dailyUpdate) {
      return NextResponse.json(
        { success: false, message: "Daily update cannot be empty" },
        { status: 400 },
      );
    }

    const record = await updateDailyUpdate(employee.attendanceSpreadsheetId, date, dailyUpdate);
    const workedMs = computeLiveWorkedMs(record);

    return NextResponse.json({
      success: true,
      record: {
        date: record.date,
        punchIn: record.punchIn,
        punchOut: record.punchOut,
        workMode: record.workMode,
        breakStart: record.breakStart,
        breakEnd: record.breakEnd,
        totalBreakTime: record.totalBreakTime,
        workingHours: record.workingHours,
        overtime: record.overtime,
        status: record.status,
        onBreak: Boolean(record.breakStart?.trim() && !record.breakEnd?.trim()),
        hasPunchedIn: Boolean(record.punchIn?.trim()),
        hasPunchedOut: Boolean(record.punchOut?.trim()),
        workedMs,
        workedFormatted: formatDurationHms(workedMs),
        earlyLeaveReason: record.earlyLeaveReason ?? "",
        dailyUpdate: record.dailyUpdate ?? "",
        idealHours: record.workMode === WORK_MODE.HALF_DAY_LEAVE ? 4 : IDEAL_WORKING_HOURS,
        idealBreakHours: record.workMode === WORK_MODE.HALF_DAY_LEAVE ? 0 : IDEAL_BREAK_HOURS,
        idealShiftHours: record.workMode === WORK_MODE.HALF_DAY_LEAVE ? 4 : IDEAL_SHIFT_HOURS,
      },
    });
  } catch (error: unknown) {
    const message = formatGoogleApiClientMessage(error, {
      forHrAdmin: canManageEmployees(user.role),
    });
    const status = message.includes("required") || message.includes("empty") ? 400 : 500;
    return NextResponse.json({ success: false, message }, { status });
  }
});
