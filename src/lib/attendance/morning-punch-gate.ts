import { roleCanPunchInOut } from "@/lib/attendance/absence-gate";
import { isBeforeTodayNoPunchExplainCutoff } from "@/lib/attendance/attendance-cutoffs";
import { LEAVE_STATUS } from "@/lib/attendance/leave-status";
import { listLeaveApplications } from "@/lib/attendance/leave-approvals";
import { resolveAttendanceEmployee } from "@/lib/attendance/employee";
import { getTodayAttendance } from "@/lib/google/attendance-sheets";
import { listCompanyHolidays } from "@/lib/company-holiday-sheets";
import { localDateIso, leaveDateToIso } from "@/lib/payroll/leave-attendance";
import { isWeekend } from "@/lib/payroll/working-days";
import type { SessionUser } from "@/types/auth";

async function isScheduledWorkingDayToday(): Promise<boolean> {
  const todayIso = localDateIso();
  const [year, month, day] = todayIso.split("-").map(Number);
  if (!year || !month || !day) return false;
  if (isWeekend(year, month, day)) return false;

  const holidays = await listCompanyHolidays();
  const leaveHolidayDates = new Set(
    holidays.filter((holiday) => holiday.type === "leave").map((holiday) => holiday.date),
  );
  return !leaveHolidayDates.has(todayIso);
}

function hasActiveLeaveToday(
  leaves: Awaited<ReturnType<typeof listLeaveApplications>>,
  todayIso: string,
): boolean {
  return leaves.some((leave) => {
    if (leaveDateToIso(leave.date) !== todayIso) return false;
    const status = leave.status.trim().toLowerCase();
    return (
      status === LEAVE_STATUS.ACCEPTED.toLowerCase() ||
      status === LEAVE_STATUS.APPLIED.toLowerCase()
    );
  });
}

/** True when employee/HR logged in before today's punch cutoff and still needs to punch in. */
export async function userRequiresMorningPunchGate(user: SessionUser): Promise<boolean> {
  if (!roleCanPunchInOut(user.role)) return false;
  if (!isBeforeTodayNoPunchExplainCutoff()) return false;
  if (!(await isScheduledWorkingDayToday())) return false;

  const employee = await resolveAttendanceEmployee(user);
  if (!employee?.attendanceSpreadsheetId) return false;

  const todayIso = localDateIso();
  const [today, leaves] = await Promise.all([
    getTodayAttendance(employee.attendanceSpreadsheetId),
    listLeaveApplications({
      employeeId: employee.employeeId,
      employeeName: employee.employeeName,
      attendanceSpreadsheetId: employee.attendanceSpreadsheetId,
    }),
  ]);

  if (hasActiveLeaveToday(leaves, todayIso)) return false;
  return !today?.punchIn?.trim();
}
