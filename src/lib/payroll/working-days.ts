import type { CompanyHoliday } from "@/lib/company-holidays";

export function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

export function toIsoDate(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** True for Saturday or Sunday. */
export function isWeekend(year: number, month: number, day: number): boolean {
  const dayOfWeek = new Date(year, month - 1, day).getDay();
  return dayOfWeek === 0 || dayOfWeek === 6;
}

/**
 * Scheduled working days for a month: Monday–Friday only,
 * excluding company holidays whose type is `leave` (celebrations still count).
 */
export function listScheduledWorkingDates(
  year: number,
  month: number,
  holidays: Pick<CompanyHoliday, "date" | "type">[],
): string[] {
  const leaveHolidayDates = new Set(holidays.filter((h) => h.type === "leave").map((h) => h.date));

  const dates: string[] = [];
  const days = getDaysInMonth(year, month);
  for (let day = 1; day <= days; day += 1) {
    if (isWeekend(year, month, day)) continue;
    const iso = toIsoDate(year, month, day);
    if (leaveHolidayDates.has(iso)) continue;
    dates.push(iso);
  }
  return dates;
}

export function countScheduledWorkingDays(
  year: number,
  month: number,
  holidays: Pick<CompanyHoliday, "date" | "type">[],
): number {
  return listScheduledWorkingDates(year, month, holidays).length;
}
