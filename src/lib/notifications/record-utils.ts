import { addDaysToDateIso, notificationDateIso } from "@/lib/notifications/automation-date";

import type { NotificationRecord, NotificationType } from "./types";

export function rowToNotificationRecord(row: string[]): NotificationRecord | null {
  const id = String(row[0] ?? "").trim();
  if (!id) return null;

  const recipientSheetRow = Number(row[1]);
  if (!Number.isFinite(recipientSheetRow) || recipientSheetRow < 2) return null;

  return {
    id,
    recipientSheetRow,
    recipientEmployeeId: String(row[2] ?? "").trim(),
    type: String(row[3] ?? "").trim() as NotificationType,
    title: String(row[4] ?? "").trim(),
    body: String(row[5] ?? "").trim(),
    href: String(row[6] ?? "").trim(),
    read:
      String(row[7] ?? "")
        .trim()
        .toLowerCase() === "true",
    createdAt: String(row[8] ?? "").trim(),
    dedupeKey: String(row[9] ?? "").trim(),
    expiresAt: String(row[10] ?? "").trim(),
  };
}

function dateFromDayMonthYear(value: string): string {
  const match = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return "";
  return `${match[3]}-${String(Number(match[2])).padStart(2, "0")}-${String(
    Number(match[1]),
  ).padStart(2, "0")}`;
}

export function effectiveNotificationExpiresAt(record: NotificationRecord): string {
  if (record.expiresAt) return record.expiresAt;

  if (record.type === "employee_birthday") {
    const birthdayDate = record.dedupeKey.match(/:(\d{4}-\d{2}-\d{2}):/)?.[1] ?? "";
    return birthdayDate ? addDaysToDateIso(birthdayDate, 1) : "";
  }

  if (record.type === "employee_increment_upcoming") {
    const incrementDate = record.dedupeKey.match(/:(\d{4}-\d{2}-\d{2}):/)?.[1] ?? "";
    return incrementDate ? addDaysToDateIso(incrementDate, 1) : "";
  }

  if (
    record.type === "leave_submitted" ||
    record.type === "leave_submitted_employee" ||
    record.type === "leave_approved" ||
    record.type === "leave_rejected" ||
    record.type === "leave_upcoming"
  ) {
    const dates = record.body.match(/\d{1,2}\/\d{1,2}\/\d{4}/g) ?? [];
    const endDate = dateFromDayMonthYear(dates.at(-1) ?? "");
    return endDate ? addDaysToDateIso(endDate, 1) : "";
  }

  if (record.type === "expense_payment_due") {
    const reminderDate = record.dedupeKey.match(/:(\d{4}-\d{2}-\d{2}):/)?.[1] ?? "";
    return reminderDate ? addDaysToDateIso(reminderDate, 1) : "";
  }

  return "";
}

export function isNotificationExpired(record: NotificationRecord, todayIso: string): boolean {
  const expiresAt = effectiveNotificationExpiresAt(record);
  return Boolean(expiresAt && expiresAt <= todayIso);
}

export function notificationRecordToRow(record: NotificationRecord): string[] {
  return [
    record.id,
    String(record.recipientSheetRow),
    record.recipientEmployeeId,
    record.type,
    record.title,
    record.body,
    record.href,
    record.read ? "true" : "false",
    record.createdAt,
    record.dedupeKey,
    record.expiresAt,
  ];
}

export function notificationTodayIso(): string {
  return notificationDateIso();
}
