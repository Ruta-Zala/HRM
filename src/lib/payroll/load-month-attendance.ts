import { canonicalizeWorkMode } from "@/lib/attendance/constants";
import { getAttendanceRepository } from "@/lib/attendance/repository";
import type { PayrollAttendanceDay } from "@/lib/payroll/attendance-codes";

/**
 * Load a month of attendance from the live backend (Firebase when enabled, otherwise Sheets).
 * Payroll and salary slips must use this so half-day work-mode edits stay in sync.
 */
export async function loadMonthAttendanceByDate(params: {
  employeeId: string;
  attendanceSpreadsheetId: string;
  year: number;
  monthIndex: number;
}): Promise<Map<string, PayrollAttendanceDay>> {
  const attendanceByDate = new Map<string, PayrollAttendanceDay>();
  const employeeId = params.employeeId.trim();
  const spreadsheetId = params.attendanceSpreadsheetId.trim();
  if (!employeeId && !spreadsheetId) return attendanceByDate;

  const rows = await getAttendanceRepository().getMonthAttendance(
    { employeeId, spreadsheetId },
    params.year,
    params.monthIndex,
  );

  for (const attendance of rows) {
    if (!attendance.date) continue;
    attendanceByDate.set(attendance.date, {
      workMode: canonicalizeWorkMode(attendance.workMode ?? ""),
      status: attendance.status,
      punchIn: attendance.punchIn,
      punchOut: attendance.punchOut,
      overtime: attendance.overtime,
      isOvertimeApproved: attendance.isOvertimeApproved,
    });
  }

  return attendanceByDate;
}
