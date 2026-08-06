import { ROLES } from "@/app/consts/common";
import { addDaysToDateIso, notificationDateIso } from "@/lib/notifications/automation-date";
import { listActiveEmployees } from "@/lib/notifications/recipients";
import { createNotifications } from "@/lib/notifications/repository";
import { NOTIFICATION_TYPES } from "@/lib/notifications/types";

type DateParts = {
  year: number;
  month: number;
  day: number;
};

function parseDateParts(value: string): DateParts | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    return {
      year: Number(isoMatch[1]),
      month: Number(isoMatch[2]),
      day: Number(isoMatch[3]),
    };
  }

  const slashMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (slashMatch) {
    return {
      year: Number(slashMatch[3]),
      month: Number(slashMatch[2]),
      day: Number(slashMatch[1]),
    };
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return null;
  return {
    year: parsed.getFullYear(),
    month: parsed.getMonth() + 1,
    day: parsed.getDate(),
  };
}

function lastDayOfMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function anniversaryForYear(parts: DateParts, year: number): string {
  const day = Math.min(parts.day, lastDayOfMonth(year, parts.month));
  return `${year}-${String(parts.month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function oneMonthBefore(dateIso: string): string {
  const [year, month, day] = dateIso.split("-").map(Number);
  const previousMonth = month === 1 ? 12 : month - 1;
  const previousYear = month === 1 ? year - 1 : year;
  const reminderDay = Math.min(day, lastDayOfMonth(previousYear, previousMonth));
  return `${previousYear}-${String(previousMonth).padStart(2, "0")}-${String(reminderDay).padStart(2, "0")}`;
}

function displayDate(dateIso: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${dateIso}T00:00:00Z`));
}

export async function processIncrementReminders(): Promise<{
  checked: number;
  due: number;
  notified: number;
}> {
  const todayIso = notificationDateIso();
  const employees = await listActiveEmployees();
  const recipients = employees.filter(
    (employee) => employee.role === ROLES.HR_MANAGER || employee.role === ROLES.SUPER_ADMIN,
  );
  let due = 0;
  let notified = 0;

  for (const employee of employees) {
    const incrementBaseDate = parseDateParts(employee.lastIncrementDate || employee.joiningDate);
    if (!incrementBaseDate) continue;

    const todayYear = Number(todayIso.slice(0, 4));
    const anniversaryYear = [todayYear, todayYear + 1].find((year) => {
      if (year < incrementBaseDate.year + 1) return false;
      return oneMonthBefore(anniversaryForYear(incrementBaseDate, year)) === todayIso;
    });
    if (!anniversaryYear) continue;

    const incrementDueDate = anniversaryForYear(incrementBaseDate, anniversaryYear);
    due += 1;

    const created = await createNotifications(
      recipients.map((recipient) => ({
        recipientSheetRow: recipient.sheetRow,
        recipientEmployeeId: recipient.employeeId,
        type: NOTIFICATION_TYPES.EMPLOYEE_INCREMENT_UPCOMING,
        title: "Increment due next month",
        body: `${employee.name}'s next increment is due on ${displayDate(incrementDueDate)}. Schedule their increment review for next month.`,
        href: `/employee/${employee.sheetRow}/profile`,
        dedupeKey: `increment_upcoming:${incrementDueDate}:${employee.sheetRow}:${recipient.sheetRow}`,
        expiresAt: addDaysToDateIso(incrementDueDate, 1),
      })),
    );

    notified += created;
  }

  return { checked: employees.length, due, notified };
}

const RECHECK_INTERVAL_MS = 5 * 60 * 1000;
let lastCheckAt = 0;
let incrementRun: Promise<{ checked: number; due: number; notified: number }> | null = null;

export async function ensureIncrementReminders(): Promise<{
  checked: number;
  due: number;
  notified: number;
}> {
  if (Date.now() - lastCheckAt < RECHECK_INTERVAL_MS) {
    return { checked: 0, due: 0, notified: 0 };
  }
  if (incrementRun) return incrementRun;

  incrementRun = processIncrementReminders()
    .then((result) => {
      lastCheckAt = Date.now();
      return result;
    })
    .finally(() => {
      incrementRun = null;
    });

  return incrementRun;
}
