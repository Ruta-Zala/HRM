import { listCompanyHolidays } from "@/lib/company-holidays/repository";

type HolidayCache = {
  dates: Set<string>;
  expiresAt: number;
};

const HOLIDAY_CACHE_TTL_MS = 5 * 60_000;
let holidayDatesCache: HolidayCache | null = null;
let holidayInflight: Promise<Set<string>> | null = null;

export function clearCompanyLeaveHolidayCache(): void {
  holidayDatesCache = null;
  holidayInflight = null;
}

/** Leave-type company holidays (shared by absence gate + morning punch). */
export async function getCompanyLeaveHolidayDates(): Promise<Set<string>> {
  if (holidayDatesCache && Date.now() < holidayDatesCache.expiresAt) {
    return holidayDatesCache.dates;
  }

  if (holidayInflight) return holidayInflight;

  holidayInflight = (async () => {
    const holidays = await listCompanyHolidays();
    const dates = new Set(
      holidays.filter((holiday) => holiday.type === "leave").map((holiday) => holiday.date),
    );
    holidayDatesCache = { dates, expiresAt: Date.now() + HOLIDAY_CACHE_TTL_MS };
    return dates;
  })().finally(() => {
    holidayInflight = null;
  });

  return holidayInflight;
}
