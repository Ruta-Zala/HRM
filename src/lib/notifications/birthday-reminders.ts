import { ROLES } from "@/app/consts/common";
import { addDaysToDateIso, notificationDateIso } from "@/lib/notifications/automation-date";
import { listActiveEmployees } from "@/lib/notifications/recipients";
import { createNotifications } from "@/lib/notifications/sheets";
import { NOTIFICATION_TYPES } from "@/lib/notifications/types";

function birthdayMonthDay(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";

  const isoMatch = trimmed.match(/^\d{4}-(\d{2})-(\d{2})/);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}`;

  const slashMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/\d{4}$/);
  if (slashMatch) {
    const day = String(Number(slashMatch[1])).padStart(2, "0");
    const month = String(Number(slashMatch[2])).padStart(2, "0");
    return `${month}-${day}`;
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return "";

  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  return `${month}-${day}`;
}

function formatBirthdayLabel(monthDay: string): string {
  const [month, day] = monthDay.split("-").map(Number);
  const date = new Date(Date.UTC(2000, month - 1, day));
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(date);
}

export async function processEmployeeBirthdayNotifications(): Promise<{
  checked: number;
  birthdays: number;
  notified: number;
}> {
  const todayIso = notificationDateIso();
  const currentYear = todayIso.slice(0, 4);
  const currentMonth = todayIso.slice(5, 7);
  const employees = await listActiveEmployees();
  const recipients = employees.filter(
    (employee) => employee.role === ROLES.HR_MANAGER || employee.role === ROLES.SUPER_ADMIN,
  );
  const birthdayEmployees = employees.flatMap((employee) => {
    const monthDay = birthdayMonthDay(employee.birthdayDate);
    if (!monthDay.startsWith(`${currentMonth}-`)) return [];

    const dateIso = `${currentYear}-${monthDay}`;
    if (dateIso < todayIso) return [];
    return [{ employee, monthDay, dateIso }];
  });

  const inputs = birthdayEmployees.flatMap(({ employee, monthDay, dateIso }) => {
    const birthdayLabel = formatBirthdayLabel(monthDay);
    const isToday = dateIso === todayIso;
    return recipients.map((recipient) => ({
      recipientSheetRow: recipient.sheetRow,
      recipientEmployeeId: recipient.employeeId,
      type: NOTIFICATION_TYPES.EMPLOYEE_BIRTHDAY,
      title: `${employee.name}'s birthday this month`,
      body: isToday
        ? `Today is ${employee.name}'s birthday (${birthdayLabel}). Wish them a happy birthday!`
        : `${employee.name}'s birthday is on ${birthdayLabel}.`,
      href: `/employee/${employee.sheetRow}/profile`,
      dedupeKey: `employee_birthday:${dateIso}:${employee.sheetRow}:${recipient.sheetRow}`,
      expiresAt: addDaysToDateIso(dateIso, 1),
    }));
  });
  const notified = await createNotifications(inputs);

  return {
    checked: employees.length,
    birthdays: birthdayEmployees.length,
    notified,
  };
}

const BIRTHDAY_RECHECK_INTERVAL_MS = 5 * 60 * 1000;

let lastBirthdayCheckAt = 0;
let birthdayRun: Promise<{
  checked: number;
  birthdays: number;
  notified: number;
}> | null = null;

/**
 * Recheck periodically so birthday profile changes made during the day are
 * picked up. Per-recipient dedupe keys prevent duplicate notifications.
 */
export async function ensureEmployeeBirthdayNotifications(): Promise<{
  checked: number;
  birthdays: number;
  notified: number;
}> {
  if (Date.now() - lastBirthdayCheckAt < BIRTHDAY_RECHECK_INTERVAL_MS) {
    return { checked: 0, birthdays: 0, notified: 0 };
  }

  if (birthdayRun) return birthdayRun;

  birthdayRun = processEmployeeBirthdayNotifications()
    .then((result) => {
      lastBirthdayCheckAt = Date.now();
      return result;
    })
    .finally(() => {
      birthdayRun = null;
    });

  return birthdayRun;
}
