import { formatIsoDate } from "@/lib/attendance/time";

export function notificationDateIso(date: Date = new Date()): string {
  return formatIsoDate(date);
}

export function addDaysToDateIso(value: string, days: number): string {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
