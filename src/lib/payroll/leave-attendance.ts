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
 * Approved leave wins over a missing attendance row (and over a plain present row
 * without an explicit leave work mode).
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

export function mergeAttendanceWithApprovedLeaves(
  attendanceByDate: Map<string, { workMode?: string; status?: string }>,
  overlays: LeaveAttendanceOverlay[],
): Map<string, { workMode?: string; status?: string }> {
  const merged = new Map(attendanceByDate);

  for (const overlay of overlays) {
    const existing = merged.get(overlay.dateIso);
    const existingMode = String(existing?.workMode ?? "").trim();
    const alreadyLeave =
      existingMode === WORK_MODE.UNPAID_LEAVE ||
      existingMode === WORK_MODE.HALF_DAY_UNPAID_LEAVE ||
      existingMode === WORK_MODE.PAID_LEAVE ||
      existingMode === WORK_MODE.HALF_DAY_PAID_LEAVE ||
      existingMode === WORK_MODE.SICK_LEAVE ||
      existingMode === WORK_MODE.CASUAL_LEAVE ||
      existingMode === WORK_MODE.FULL_DAY_LEAVE ||
      existingMode === WORK_MODE.HALF_DAY_LEAVE ||
      existingMode === WORK_MODE.SL;

    if (alreadyLeave) continue;

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
