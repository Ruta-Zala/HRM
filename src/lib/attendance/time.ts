import {
  IDEAL_BREAK_HOURS,
  IDEAL_SHIFT_HOURS,
  IDEAL_WORKING_HOURS,
  IMPORT_DEFAULT_BREAK,
  WORK_MODE,
} from "./constants";
import { WORKING_STATUS, type WorkingStatus } from "./constants";

const OVERTIME_REVIEW_THRESHOLD_MS = 30 * 60 * 1000;

const MONTH_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

/** Sheet tab name: `May-2026` */
export function monthlySheetTitle(date: Date = new Date()): string {
  const month = MONTH_NAMES[date.getMonth()];
  const year = date.getFullYear();
  return `${month}-${year}`;
}

export function parseMonthlySheetTitle(title: string): { month: number; year: number } | null {
  const match = title.trim().match(/^([A-Za-z]{3})-(\d{4})$/);
  if (!match) return null;

  const monthIndex = MONTH_NAMES.findIndex((m) => m.toLowerCase() === match[1].toLowerCase());
  if (monthIndex < 0) return null;

  const year = parseInt(match[2], 10);
  if (!Number.isFinite(year)) return null;

  return { month: monthIndex, year };
}

export function formatIsoDate(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Normalize sheet date cells (ISO, locale strings, serial numbers) for comparison. */
export function normalizeSheetDate(value: string): string {
  const trimmed = String(value ?? "")
    .trim()
    .replace(/^'/, "");
  if (!trimmed) return "";

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;

  if (/^\d+(\.\d+)?$/.test(trimmed)) {
    const serial = parseFloat(trimmed);
    const epoch = new Date(1899, 11, 30);
    const parsed = new Date(epoch.getTime() + serial * 86400000);
    if (!Number.isNaN(parsed.getTime())) return formatIsoDate(parsed);
  }

  const parsed = new Date(trimmed);
  if (!Number.isNaN(parsed.getTime())) return formatIsoDate(parsed);

  return trimmed;
}

/** Store dates as plain text so reads round-trip reliably. */
export function formatSheetDateLiteral(date: Date = new Date()): string {
  return `'${formatIsoDate(date)}`;
}

export function formatClockTime(date: Date = new Date()): string {
  return date.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

/** Parse `09:04 AM` / `09:04` / ISO into ms since midnight on `baseDate`. */
export function parseTimeOnDate(value: string, baseDate: Date): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  if (trimmed.includes("T")) {
    const parsed = new Date(trimmed);
    if (!Number.isNaN(parsed.getTime())) return parsed.getTime();
  }

  const match = trimmed.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?$/i);
  if (!match) return null;

  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const seconds = match[3] ? parseInt(match[3], 10) : 0;
  const meridiem = match[4]?.toUpperCase();

  if (meridiem === "PM" && hours < 12) hours += 12;
  if (meridiem === "AM" && hours === 12) hours = 0;

  const result = new Date(baseDate);
  result.setHours(hours, minutes, seconds, 0);
  return result.getTime();
}

/**
 * Parse clock times from sheet cells — infers PM for punch-out when meridiem is missing
 * (e.g. `7:33` after `10:33 AM`).
 */
export function parseSheetClockTime(
  value: string,
  baseDate: Date,
  options?: { punchIn?: string; role?: "in" | "out" },
): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const hourOnly = trimmed.match(/^(\d{1,2})$/);
  if (hourOnly && !/AM|PM/i.test(trimmed)) {
    let hours = parseInt(hourOnly[1], 10);
    if (options?.role === "out" && hours >= 1 && hours <= 11) hours += 12;
    const result = new Date(baseDate);
    result.setHours(hours, 0, 0, 0);
    return result.getTime();
  }

  if (/^\d+(\.\d+)?$/.test(trimmed)) {
    const serial = parseFloat(trimmed);
    if (serial > 0 && serial < 1) {
      const ms = Math.round(serial * 24 * 60 * 60 * 1000);
      const result = new Date(baseDate);
      result.setHours(0, 0, 0, 0);
      return result.getTime() + ms;
    }
  }

  const ms = parseTimeOnDate(trimmed, baseDate);
  if (ms == null) return null;
  if (/AM|PM/i.test(trimmed)) return ms;

  const match = trimmed.match(/^(\d{1,2}):(\d{1,2})/);
  if (!match) return ms;

  const hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);

  const punchInMs = options?.punchIn ? parseTimeOnDate(options.punchIn, baseDate) : null;

  const treatAsPm =
    options?.role === "out" || (punchInMs != null && ms <= punchInMs && hours >= 1 && hours <= 11);

  if (treatAsPm && hours < 12) {
    const result = new Date(baseDate);
    result.setHours(hours + 12, minutes, 0, 0);
    return result.getTime();
  }

  if (options?.role === "in" && hours >= 1 && hours <= 11 && !/PM/i.test(trimmed)) {
    const result = new Date(baseDate);
    result.setHours(hours, minutes, 0, 0);
    return result.getTime();
  }

  return ms;
}

export function parseDurationToMs(value: string): number {
  const trimmed = value.trim();
  if (!trimmed) return 0;

  if (/^\d+(\.\d+)?$/.test(trimmed)) {
    const n = parseFloat(trimmed);
    if (n > 0 && n < 1) {
      return Math.round(n * 24 * 60 * 60 * 1000);
    }
  }

  let totalMs = 0;
  const hourMatch = trimmed.match(/(\d+)\s*h/i);
  const minMatch = trimmed.match(/(\d+)\s*m/i);
  const secMatch = trimmed.match(/(\d+)\s*s/i);

  if (hourMatch) totalMs += parseInt(hourMatch[1], 10) * 60 * 60 * 1000;
  if (minMatch) totalMs += parseInt(minMatch[1], 10) * 60 * 1000;
  if (secMatch) totalMs += parseInt(secMatch[1], 10) * 1000;

  if (!hourMatch && !minMatch && !secMatch) {
    const parts = trimmed.split(":").map((p) => parseInt(p, 10));
    if (parts.length >= 2 && parts.every((n) => Number.isFinite(n))) {
      const [h, m, s = 0] = parts;
      totalMs = ((h * 60 + m) * 60 + s) * 1000;
    }
  }

  return totalMs;
}

export function formatDuration(ms: number): string {
  if (ms <= 0) return "0h 0m";

  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return seconds > 0
      ? `${hours}h ${minutes}m ${seconds}s`
      : `${minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`}`;
  }

  if (minutes > 0) {
    return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`;
  }

  return `${seconds}s`;
}

export function formatDurationHms(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${String(hours).padStart(2, "0")}h ${String(minutes).padStart(2, "0")}m ${String(seconds).padStart(2, "0")}s`;
}

export function computeWorkingHoursMs(params: {
  punchIn: string;
  punchOut: string;
  totalBreakMs: number;
  baseDate: Date;
  workMode?: string;
}): number {
  const inMs = parseSheetClockTime(params.punchIn, params.baseDate, {
    role: "in",
  });
  const outMs = parseSheetClockTime(params.punchOut, params.baseDate, {
    punchIn: params.punchIn,
    role: "out",
  });
  if (inMs == null || outMs == null || outMs <= inMs) return 0;
  const shouldSkipBreak = params.workMode === WORK_MODE.HALF_DAY_LEAVE;
  const breakMs = shouldSkipBreak ? 0 : params.totalBreakMs;
  return Math.max(0, outMs - inMs - breakMs);
}

export type AttendanceMetrics = {
  workingMs: number;
  workingHours: string;
  overtime: string;
  status: WorkingStatus;
  totalBreakMs: number;
};

/** Single source of truth for worked time, status, and overtime from sheet fields. */
export function computeAttendanceMetrics(params: {
  punchIn: string;
  punchOut: string;
  totalBreakTime: string;
  baseDate: Date;
  punchedOut?: boolean;
  workMode?: string;
}): AttendanceMetrics {
  const totalBreakMs = resolveAttendanceBreakMs(params.totalBreakTime, params.workMode);
  const hasOut = Boolean(params.punchOut.trim());
  const punchedOut = params.punchedOut ?? hasOut;
  const requiredMs =
    params.workMode === WORK_MODE.HALF_DAY_LEAVE ? 4 * 60 * 60 * 1000 : idealWorkingMs();

  if (!params.punchIn.trim() || !hasOut) {
    return {
      workingMs: 0,
      workingHours: "",
      overtime: "—",
      status: WORKING_STATUS.IN_PROGRESS,
      totalBreakMs,
    };
  }

  const workingMs = computeWorkingHoursMs({
    punchIn: params.punchIn,
    punchOut: params.punchOut,
    totalBreakMs,
    baseDate: params.baseDate,
    workMode: params.workMode,
  });

  const status = workingStatusFromHours(workingMs, punchedOut, requiredMs);
  const overtimeMs = computeOvertimeMs(workingMs, requiredMs);
  const shortfallMs = Math.max(0, requiredMs - workingMs);
  const consideredOvertimeMs = overtimeMs >= OVERTIME_REVIEW_THRESHOLD_MS ? overtimeMs : 0;

  let overtime = "—";
  if (punchedOut) {
    if (consideredOvertimeMs > 0) overtime = formatDuration(consideredOvertimeMs);
    else if (shortfallMs > 0) overtime = `-${formatDuration(shortfallMs)}`;
  }

  return {
    workingMs,
    workingHours: punchedOut ? formatDuration(workingMs) : "",
    overtime,
    status,
    totalBreakMs,
  };
}

export function idealWorkingMs(): number {
  return IDEAL_WORKING_HOURS * 60 * 60 * 1000;
}

export function idealBreakMs(): number {
  return IDEAL_BREAK_HOURS * 60 * 60 * 1000;
}

export function resolveAttendanceBreakMs(totalBreakTime: string, workMode?: string): number {
  if (workMode === WORK_MODE.HALF_DAY_LEAVE) return 0;
  const parsed = parseDurationToMs(totalBreakTime);
  return parsed > 0 ? parsed : idealBreakMs();
}

/** Break time already taken today — used for live timers (no assumed allowance). */
export function resolveLiveBreakMs(
  totalBreakTime: string,
  workMode?: string,
  options?: { inProgress?: boolean },
): number {
  if (workMode === WORK_MODE.HALF_DAY_LEAVE) return 0;
  const trimmed = totalBreakTime.trim();
  if (options?.inProgress && trimmed.toLowerCase() === IMPORT_DEFAULT_BREAK.toLowerCase()) {
    return 0;
  }
  return parseDurationToMs(trimmed);
}

export function idealShiftMs(): number {
  return IDEAL_SHIFT_HOURS * 60 * 60 * 1000;
}

/** Break used vs allowed, e.g. "35m / 1h". */
/**
 * Parse legacy CSV clock cells: punch-in → AM, punch-out → PM when meridiem is omitted.
 * Supports `7`, `7:08`, `10:14`, and values that already include AM/PM.
 */
export function parseLegacyImportClockTime(
  value: string,
  kind: "in" | "out",
  baseDate: Date,
): string {
  const trimmed = value.trim();
  if (!trimmed) return "";

  if (/AM|PM/i.test(trimmed)) {
    const ms = parseTimeOnDate(trimmed, baseDate);
    return ms != null ? formatClockTime(new Date(ms)) : trimmed;
  }

  let hours: number;
  let minutes = 0;
  let seconds = 0;

  const hourOnly = trimmed.match(/^(\d{1,2})$/);
  const hm = trimmed.match(/^(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?$/);

  if (hourOnly) {
    hours = parseInt(hourOnly[1], 10);
  } else if (hm) {
    hours = parseInt(hm[1], 10);
    minutes = parseInt(hm[2], 10);
    seconds = hm[3] ? parseInt(hm[3], 10) : 0;
  } else {
    const ms = parseSheetClockTime(trimmed, baseDate, { role: kind });
    return ms != null ? formatClockTime(new Date(ms)) : trimmed;
  }

  if (kind === "out" && hours >= 1 && hours <= 11) {
    hours += 12;
  }

  const result = new Date(baseDate);
  result.setHours(hours, minutes, seconds, 0);
  return formatClockTime(result);
}

export function formatBreakAllowance(usedMs: number): string {
  const allowed = IDEAL_BREAK_HOURS;
  if (usedMs <= 0) return `0h / ${allowed}h`;
  return `${formatDuration(usedMs)} / ${allowed}h`;
}

export function computeOvertimeMs(
  workingMs: number,
  requiredMs: number = idealWorkingMs(),
): number {
  return Math.max(0, workingMs - requiredMs);
}

/** Overtime beyond 8h, or shortfall prefix when under 8h. */
export function formatOvertimeDuration(workingMs: number): string {
  const overtimeMs = computeOvertimeMs(workingMs);
  if (overtimeMs > 0) return formatDuration(overtimeMs);
  const shortfallMs = idealWorkingMs() - workingMs;
  if (shortfallMs > 0) return `-${formatDuration(shortfallMs)}`;
  return "—";
}

export function workingStatusFromHours(
  workingMs: number,
  punchedOut: boolean,
  requiredMs: number = idealWorkingMs(),
): WorkingStatus {
  if (!punchedOut) return WORKING_STATUS.IN_PROGRESS;

  if (workingMs < requiredMs) return WORKING_STATUS.SHORT;
  if (workingMs > requiredMs) {
    const overtimeMs = computeOvertimeMs(workingMs, requiredMs);
    return overtimeMs >= OVERTIME_REVIEW_THRESHOLD_MS
      ? WORKING_STATUS.OVERTIME
      : WORKING_STATUS.COMPLETED;
  }
  return WORKING_STATUS.COMPLETED;
}

export function monthLabel(monthIndex: number): string {
  return MONTH_NAMES[monthIndex] ?? "Unknown";
}

/** Client-side live worked duration from today's attendance fields. */
export function computeLiveWorkedMsFromFields(params: {
  date: string;
  workMode?: string;
  punchIn: string;
  punchOut: string;
  totalBreakTime: string;
  breakStart: string;
  breakEnd: string;
  now?: Date;
}): number {
  if (!params.punchIn.trim()) return 0;

  const baseDate = new Date(params.date);
  const punchInMs = parseSheetClockTime(params.punchIn, baseDate, { role: "in" });
  if (punchInMs == null) return 0;

  const now = params.now ?? new Date();
  const endMs = params.punchOut.trim()
    ? (parseSheetClockTime(params.punchOut, baseDate, {
        punchIn: params.punchIn,
        role: "out",
      }) ?? now.getTime())
    : now.getTime();

  const skipBreak = params.workMode === WORK_MODE.HALF_DAY_LEAVE;
  let totalBreakMs = resolveLiveBreakMs(params.totalBreakTime, params.workMode, {
    inProgress: !params.punchOut.trim(),
  });

  if (!skipBreak && params.breakStart.trim() && !params.breakEnd.trim()) {
    const breakStartMs = parseSheetClockTime(params.breakStart, baseDate, {
      punchIn: params.punchIn,
      role: "out",
    });
    if (breakStartMs != null) {
      totalBreakMs += Math.max(0, now.getTime() - breakStartMs);
    }
  }

  return Math.max(0, endMs - punchInMs - totalBreakMs);
}
