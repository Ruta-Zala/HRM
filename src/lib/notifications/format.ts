import { formatLeaveDateRange } from "@/lib/attendance/leave-range-display";

export function formatIsoDateRange(fromDate: string, toDate: string): string {
  const start = parseIsoDate(fromDate);
  const end = parseIsoDate(toDate);
  if (!start || !end) return fromDate || toDate;
  return formatLeaveDateRange(start, end);
}

export function formatIsoDateLabel(value: string): string {
  const date = parseIsoDate(value);
  if (!date) return value;
  return `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`;
}

function parseIsoDate(value: string): Date | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  return Number.isNaN(date.getTime()) ? null : date;
}
