import { roleCanPunchInOut } from "@/lib/attendance/absence-gate";
import { isBeforeTodayNoPunchExplainCutoff } from "@/lib/attendance/attendance-cutoffs";
import { getCompanyLeaveHolidayDates } from "@/lib/attendance/company-leave-holidays";
import { LEAVE_STATUS } from "@/lib/attendance/leave-status";
import { listLeaveApplications } from "@/lib/attendance/leave-approvals";
import { resolveAttendanceEmployee } from "@/lib/attendance/employee";
import {
  getAttendanceRepository,
  hasAttendanceStorage,
  toAttendanceStorageRef,
} from "@/lib/attendance/repository";
import { localDateIso, leaveDateToIso } from "@/lib/payroll/leave-attendance";
import { isWeekend } from "@/lib/payroll/working-days";
import type { SessionUser } from "@/types/auth";

async function isScheduledWorkingDayToday(): Promise<boolean> {
  const todayIso = localDateIso();
  const [year, month, day] = todayIso.split("-").map(Number);
  if (!year || !month || !day) return false;
  if (isWeekend(year, month, day)) return false;

  const leaveHolidayDates = await getCompanyLeaveHolidayDates();
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

  // Holiday check and employee resolve are independent — run together.
  const [isWorkingDay, employee] = await Promise.all([
    isScheduledWorkingDayToday(),
    resolveAttendanceEmployee(user),
  ]);
  if (!isWorkingDay) return false;
  if (!employee || !hasAttendanceStorage(employee)) return false;

  const todayIso = localDateIso();
  const storageRef = toAttendanceStorageRef(employee);
  const [today, leaves] = await Promise.all([
    getAttendanceRepository().getTodayAttendance(storageRef),
    listLeaveApplications({
      employeeId: employee.employeeId,
      employeeName: employee.employeeName,
      attendanceSpreadsheetId: employee.attendanceSpreadsheetId,
    }),
  ]);

  if (hasActiveLeaveToday(leaves, todayIso)) return false;
  return !today?.punchIn?.trim();
}
