import {
  canonicalizeWorkMode,
  isPunchOptionalWorkMode,
  WORK_MODE,
} from "@/lib/attendance/constants";
import type { LeaveBucketType } from "@/lib/attendance/leave-bucket-layout";
import {
  formatIsoDate,
  getAppZonedParts,
  parseLegacyImportClockTime,
  parseTimeOnDate,
  formatDuration,
} from "@/lib/attendance/time";

export type ManualAttendanceInput = {
  dateIso: string;
  punchIn?: string;
  punchOut?: string;
  breakStart?: string;
  breakEnd?: string;
  workMode?: string;
};

export type ManualLeaveBucketMapping = {
  leaveType: LeaveBucketType;
  duration: "full" | "half_am" | "half_pm";
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export { isPunchOptionalWorkMode };

/** True when HR marks a normal working day (clears leave bucket for that date). */
export function shouldClearLeaveOnManualAttendance(workMode: string): boolean {
  const mode = canonicalizeWorkMode(workMode);
  if (isPunchOptionalWorkMode(mode)) return false;
  if (mode === WORK_MODE.HALF_DAY_PAID_LEAVE || mode === WORK_MODE.HALF_DAY_UNPAID_LEAVE) {
    return false;
  }
  return true;
}

/** Map leave work modes to leave-bucket type (holidays return null). */
export function leaveBucketFromWorkMode(workMode: string): ManualLeaveBucketMapping | null {
  const mode = canonicalizeWorkMode(workMode);
  switch (mode) {
    case WORK_MODE.PAID_LEAVE:
      return { leaveType: "paid", duration: "full" };
    case WORK_MODE.HALF_DAY_PAID_LEAVE:
      return { leaveType: "paid", duration: "half_am" };
    case WORK_MODE.SICK_LEAVE:
      return { leaveType: "sick", duration: "full" };
    case WORK_MODE.CASUAL_LEAVE:
      return { leaveType: "casual", duration: "full" };
    case WORK_MODE.UNPAID_LEAVE:
      return { leaveType: "unpaid", duration: "full" };
    case WORK_MODE.HALF_DAY_UNPAID_LEAVE:
      return { leaveType: "unpaid", duration: "half_am" };
    default:
      return null;
  }
}

/** App-timezone calendar date as YYYY-MM-DD. */
export function localTodayIso(date: Date = new Date()): string {
  return formatIsoDate(date);
}

export function assertValidManualAttendanceDate(dateIso: string): void {
  if (!ISO_DATE.test(dateIso.trim())) {
    throw new Error("Date must be YYYY-MM-DD");
  }
  const parsed = new Date(`${dateIso}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error("Invalid date");
  }
  if (dateIso.trim() > localTodayIso()) {
    throw new Error("Future dates are not allowed. Choose today or an earlier date.");
  }
}

/** Convert HTML time input (HH:mm) to sheet clock format. */
export function timeInputToClock(value: string, kind: "in" | "out", baseDate: Date): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  const [hours, minutes] = trimmed.split(":").map((p) => parseInt(p, 10));
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return "";
  return parseLegacyImportClockTime(`${hours}:${String(minutes).padStart(2, "0")}`, kind, baseDate);
}

/** Convert sheet clock value to HTML time input for editing. */
export function clockToTimeInput(value: string, baseDate: Date): string {
  const ms = parseTimeOnDate(value.trim(), baseDate);
  if (ms == null) return "";
  const parts = getAppZonedParts(new Date(ms));
  return `${String(parts.hour).padStart(2, "0")}:${String(parts.minute).padStart(2, "0")}`;
}

export function normalizeManualAttendanceInput(input: ManualAttendanceInput): {
  dateIso: string;
  punchIn: string;
  punchOut: string;
  breakStart: string;
  breakEnd: string;
  totalBreakTime: string;
  workMode: string;
} {
  assertValidManualAttendanceDate(input.dateIso);
  const baseDate = new Date(`${input.dateIso}T12:00:00`);
  const workMode = canonicalizeWorkMode(input.workMode?.trim() ?? "");
  const punchOptional = isPunchOptionalWorkMode(workMode);

  const punchIn = timeInputToClock(input.punchIn ?? "", "in", baseDate);
  const punchOut = timeInputToClock(input.punchOut ?? "", "out", baseDate);
  const breakStart = timeInputToClock(input.breakStart ?? "", "in", baseDate);
  const breakEnd = timeInputToClock(input.breakEnd ?? "", "out", baseDate);

  if (!punchOptional && !punchIn && !punchOut && !breakStart && !breakEnd) {
    throw new Error("Enter at least punch in, punch out, or break times");
  }

  if ((breakStart && !breakEnd) || (!breakStart && breakEnd)) {
    throw new Error("Both break start and break end are required when setting break time");
  }

  let totalBreakTime = "";
  if (breakStart && breakEnd) {
    const startMs = parseTimeOnDate(breakStart, baseDate);
    const endMs = parseTimeOnDate(breakEnd, baseDate);
    if (startMs == null || endMs == null || endMs <= startMs) {
      throw new Error("Break end must be after break start");
    }
    totalBreakTime = formatDuration(endMs - startMs);
  }

  return {
    dateIso: input.dateIso.trim(),
    punchIn,
    punchOut,
    breakStart,
    breakEnd,
    totalBreakTime,
    workMode,
  };
}
