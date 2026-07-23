/**
 * Normalize common sheet date values to YYYY-MM-DD.
 * Accepts ISO strings, DD/MM/YYYY, and Excel-serialized day numbers as strings.
 */
export function toPayrollDateOnly(value: string): string {
  const raw = String(value ?? "").trim();
  if (!raw) return "";

  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) {
    return raw.slice(0, 10);
  }

  const dmy = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (dmy) {
    const day = Number(dmy[1]);
    const month = Number(dmy[2]);
    const year = Number(dmy[3]);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
  }

  const asNumber = Number(raw);
  if (Number.isFinite(asNumber) && asNumber > 20000 && asNumber < 80000) {
    // Excel serial date (days since 1899-12-30).
    const excelEpoch = Date.UTC(1899, 11, 30);
    const date = new Date(excelEpoch + asNumber * 24 * 60 * 60 * 1000);
    return date.toISOString().slice(0, 10);
  }

  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }

  return "";
}

/**
 * Employee belongs on a month's payroll when their employment overlaps the period:
 * joined on/before period end, and either still employed or last working day on/after period start.
 */
export function wasEmployedDuringPeriod(input: {
  joiningDate: string;
  lastWorkingDay?: string;
  periodStart: string;
  periodEnd: string;
}): boolean {
  const joiningDate = toPayrollDateOnly(input.joiningDate);
  if (!joiningDate) return false;
  if (joiningDate > input.periodEnd) return false;

  const lastWorkingDay = toPayrollDateOnly(input.lastWorkingDay ?? "");
  if (lastWorkingDay && lastWorkingDay < input.periodStart) return false;

  return true;
}

/** Scheduled working dates that fall inside the employee's employment window. */
export function filterDatesForEmployment(
  scheduledDates: string[],
  joiningDate: string,
  lastWorkingDay?: string,
): string[] {
  const join = toPayrollDateOnly(joiningDate);
  const lwd = toPayrollDateOnly(lastWorkingDay ?? "");

  return scheduledDates.filter((date) => {
    if (join && date < join) return false;
    if (lwd && date > lwd) return false;
    return true;
  });
}
