import { parseLegacyImportClockTime, parseTimeOnDate, formatDuration } from "@/lib/attendance/time";

export type ManualAttendanceInput = {
  dateIso: string;
  punchIn?: string;
  punchOut?: string;
  breakStart?: string;
  breakEnd?: string;
  workMode?: string;
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Local calendar date as YYYY-MM-DD. */
export function localTodayIso(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
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
  const date = new Date(ms);
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
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

  const punchIn = timeInputToClock(input.punchIn ?? "", "in", baseDate);
  const punchOut = timeInputToClock(input.punchOut ?? "", "out", baseDate);
  const breakStart = timeInputToClock(input.breakStart ?? "", "in", baseDate);
  const breakEnd = timeInputToClock(input.breakEnd ?? "", "out", baseDate);

  if (!punchIn && !punchOut && !breakStart && !breakEnd) {
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
    workMode: input.workMode?.trim() ?? "",
  };
}
