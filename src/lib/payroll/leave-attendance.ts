import type { LeaveBucketType } from "@/lib/attendance/leave-bucket-layout";
import { leaveDaysFromDurationLabel } from "@/lib/attendance/leave-display";
import { parseLeaveDisplayDate } from "@/lib/attendance/leave-range-display";
import { WORK_MODE, WORKING_STATUS } from "@/lib/attendance/constants";
import { LEAVE_STATUS } from "@/lib/attendance/leave-status";

export type LeaveAttendanceOverlay = {
  dateIso: string;
  workMode: string;
  status: string;
};

function isHalfDayDuration(duration: string): boolean {
  return leaveDaysFromDurationLabel(duration) < 1;
}

/** Map Leave Bucket type + duration to monthly attendance work mode. */
export function workModeForApprovedLeave(leaveType: LeaveBucketType, duration: string): string {
  const half = isHalfDayDuration(duration);

  switch (leaveType) {
    case "unpaid":
      return half ? WORK_MODE.HALF_DAY_UNPAID_LEAVE : WORK_MODE.UNPAID_LEAVE;
    case "paid":
    case "birthday":
      return half ? WORK_MODE.HALF_DAY_PAID_LEAVE : WORK_MODE.PAID_LEAVE;
    case "sick":
      return half ? WORK_MODE.HALF_DAY_PAID_LEAVE : WORK_MODE.SICK_LEAVE;
    case "casual":
      return half ? WORK_MODE.HALF_DAY_PAID_LEAVE : WORK_MODE.CASUAL_LEAVE;
    default:
      return half ? WORK_MODE.HALF_DAY_UNPAID_LEAVE : WORK_MODE.UNPAID_LEAVE;
  }
}

export function leaveDateToIso(value: string): string {
  const parsed = parseLeaveDisplayDate(value);
  if (!parsed) return "";
  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Build attendance overlays from accepted Leave Bucket applications.
 * Used only to fill dates that have no monthly attendance row yet.
 */
export function buildAcceptedLeaveAttendanceOverlays(
  applications: Array<{
    date: string;
    duration: string;
    status: string;
    leaveType: LeaveBucketType;
  }>,
): LeaveAttendanceOverlay[] {
  const overlays: LeaveAttendanceOverlay[] = [];

  for (const application of applications) {
    if (application.status.trim().toLowerCase() !== LEAVE_STATUS.ACCEPTED.toLowerCase()) {
      continue;
    }

    const dateIso = leaveDateToIso(application.date);
    if (!dateIso) continue;

    overlays.push({
      dateIso,
      workMode: workModeForApprovedLeave(application.leaveType, application.duration),
      status: WORKING_STATUS.ON_LEAVE,
    });
  }

  return overlays;
}

/**
 * Merge approved leave into attendance.
 * The employee's monthly attendance sheet is the source of truth — leave overlays
 * only fill missing dates and must never overwrite punched / sheet work modes
 * (that was turning present days into paid-leave "A" and Attend Days = 0).
 */
export function mergeAttendanceWithApprovedLeaves(
  attendanceByDate: Map<
    string,
    { workMode?: string; status?: string; punchIn?: string; punchOut?: string }
  >,
  overlays: LeaveAttendanceOverlay[],
): Map<string, { workMode?: string; status?: string; punchIn?: string; punchOut?: string }> {
  const merged = new Map(attendanceByDate);

  for (const overlay of overlays) {
    if (merged.has(overlay.dateIso)) continue;

    merged.set(overlay.dateIso, {
      workMode: overlay.workMode,
      status: overlay.status,
    });
  }

  return merged;
}

/** Local calendar YYYY-MM-DD for "as of" payroll cutoff (exclude future unpaid). */
export function localDateIso(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function filterScheduledDatesThrough(dates: string[], asOfIso: string): string[] {
  return dates.filter((date) => date <= asOfIso);
}
