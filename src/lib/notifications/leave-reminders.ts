import {
  getAttendanceSpreadsheetIdFromRow,
  isAttendanceSpreadsheetAccessible,
} from "@/lib/attendance/employee";
import { buildLeaveApplicationId, listLeaveApplications } from "@/lib/attendance/leave-approvals";
import { LEAVE_STATUS } from "@/lib/attendance/leave-status";
import { groupLeaveApplicationsForDisplay } from "@/lib/attendance/leave-range-display";
import { formatIsoDate } from "@/lib/attendance/time";
import { getSheetHeaders, sheetRowToForm } from "@/lib/employee";
import { EMPLOYEE_SHEET_RANGE, readSheet } from "@/lib/google/sheets";
import { addDaysToDateIso, notificationDateIso } from "@/lib/notifications/automation-date";
import { getLeaveStartDateFromRange, notifyUpcomingLeave } from "@/lib/notifications/leave-events";

export async function processLeaveUpcomingReminders(): Promise<{
  checked: number;
  notified: number;
}> {
  const todayIso = notificationDateIso();
  const reminderDateIso = addDaysToDateIso(todayIso, 2);

  const raw = await readSheet(EMPLOYEE_SHEET_RANGE);
  const headers = getSheetHeaders(raw);
  let checked = 0;
  let notified = 0;

  for (let i = 1; i < raw.length; i++) {
    const row = raw[i] ?? [];
    const sheetRow = i + 1;
    const form = sheetRowToForm(headers, row);
    const attendanceSpreadsheetId = getAttendanceSpreadsheetIdFromRow(headers, row);
    if (!attendanceSpreadsheetId) continue;
    if (!(await isAttendanceSpreadsheetAccessible(attendanceSpreadsheetId))) continue;

    const employeeId = form.employeeId.trim();
    const employeeName = form.name.trim() || "Employee";

    const applications = groupLeaveApplicationsForDisplay(
      await listLeaveApplications({
        employeeId,
        employeeName,
        attendanceSpreadsheetId,
        statusFilter: LEAVE_STATUS.ACCEPTED,
      }),
    );

    for (const application of applications) {
      checked += 1;
      const startDate = getLeaveStartDateFromRange(application.date);
      if (!startDate) continue;

      const startIso = formatIsoDate(startDate);
      if (startIso !== reminderDateIso) continue;

      const applicationId = buildLeaveApplicationId({
        employeeId,
        attendanceSpreadsheetId,
        rowIndex: application.rowIndex ?? 0,
        leaveType: application.leaveType as "paid",
      });

      const created = await notifyUpcomingLeave({
        employeeSheetRow: sheetRow,
        employeeId,
        employeeName,
        leaveType: application.leaveType,
        dateRange: application.date,
        applicationId,
        leaveStartDate: startDate,
      });

      notified += created;
    }
  }

  return { checked, notified };
}

let processedDateIso = "";
let reminderRun: Promise<{ checked: number; notified: number }> | null = null;

/**
 * Run at most once per app day in this server process. Notification dedupe keys
 * keep this safe when multiple server instances execute it on the same day.
 */
export async function processLeaveUpcomingRemindersOncePerDay(): Promise<{
  checked: number;
  notified: number;
}> {
  const todayIso = notificationDateIso();
  if (processedDateIso === todayIso) {
    return { checked: 0, notified: 0 };
  }

  if (reminderRun) return reminderRun;

  reminderRun = processLeaveUpcomingReminders()
    .then((result) => {
      processedDateIso = todayIso;
      return result;
    })
    .finally(() => {
      reminderRun = null;
    });

  return reminderRun;
}
