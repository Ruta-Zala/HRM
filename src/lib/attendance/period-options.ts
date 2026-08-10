import type { AttendancePeriod } from "@/lib/attendance/client";

const MONTH_LABELS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

/** Earliest selectable attendance year in history filters. */
export const ATTENDANCE_HISTORY_START_YEAR = 2020;

/** Payroll period picker includes this many years beyond the current year. */
export const PAYROLL_FUTURE_YEARS = 10;

/**
 * Build year/month options with every month enabled for each year in range.
 * Defaults to ATTENDANCE_HISTORY_START_YEAR through the current year.
 */
export function buildFullMonthYearPeriodOptions(
  now: Date = new Date(),
  startYear: number = ATTENDANCE_HISTORY_START_YEAR,
  endYear?: number,
): AttendancePeriod[] {
  const currentYear = now.getFullYear();
  return buildAttendancePeriodOptions(now, startYear, false, endYear ?? currentYear);
}

/**
 * Build year/month options for attendance history.
 * - Years: startYear..currentYear (newest first)
 * - Past years: all 12 months
 * - Current year: January through current month only (no future months)
 *
 * Month values are 0-indexed to match the attendance API.
 */
export function buildAttendancePeriodOptions(
  now: Date = new Date(),
  startYear: number = ATTENDANCE_HISTORY_START_YEAR,
  limitCurrentYearMonths: boolean = true,
  endYear?: number,
): AttendancePeriod[] {
  const currentYear = now.getFullYear();
  const currentMonthIndex = now.getMonth(); // 0-11
  const fromYear = Math.min(startYear, currentYear);
  const toYear = endYear ?? currentYear;

  const periods: AttendancePeriod[] = [];
  for (let year = toYear; year >= fromYear; year -= 1) {
    const lastMonthIndex = limitCurrentYearMonths && year === currentYear ? currentMonthIndex : 11;
    const months = Array.from({ length: lastMonthIndex + 1 }, (_, month) => ({
      month,
      label: MONTH_LABELS[month],
    }));
    periods.push({ year, months });
  }

  return periods;
}

export function defaultAttendancePeriodSelection(now: Date = new Date()): {
  year: number;
  month: number;
} {
  return {
    year: now.getFullYear(),
    month: now.getMonth(),
  };
}

/** Clamp month into the allowed range for a selected year. */
export function clampMonthForYear(
  year: number,
  month: number | null,
  periods: AttendancePeriod[],
): number | null {
  const yearPeriod = periods.find((p) => p.year === year);
  if (!yearPeriod?.months.length) return null;
  if (month != null && yearPeriod.months.some((m) => m.month === month)) return month;
  return yearPeriod.months[yearPeriod.months.length - 1]?.month ?? null;
}
