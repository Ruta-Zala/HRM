import type { LeaveApplication } from "@/lib/attendance/leave-approvals";
import { leaveDaysFromRecord } from "@/lib/attendance/leave-display";
import type { LeaveBucketEntry } from "@/lib/attendance/leave-policy";

type LeaveRangeGroupable = {
  date: string;
  duration: string;
  reason: string;
  status: string;
  rejectReason: string;
  days?: number;
};

export function parseLeaveDisplayDate(value: string): Date | null {
  const trimmed = value.trim().split(" - ")[0]?.trim() ?? "";
  if (!trimmed) return null;

  const slashMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (slashMatch) {
    const day = Number(slashMatch[1]);
    const month = Number(slashMatch[2]);
    const year = Number(slashMatch[3]);
    const date = new Date(year, month - 1, day);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    const year = Number(isoMatch[1]);
    const month = Number(isoMatch[2]);
    const day = Number(isoMatch[3]);
    const date = new Date(year, month - 1, day);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatLeaveDisplayDate(date: Date): string {
  return `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`;
}

export function formatLeaveDateRange(start: Date, end: Date): string {
  const startLabel = formatLeaveDisplayDate(start);
  if (
    start.getFullYear() === end.getFullYear() &&
    start.getMonth() === end.getMonth() &&
    start.getDate() === end.getDate()
  ) {
    return startLabel;
  }

  return `${startLabel} - ${formatLeaveDisplayDate(end)}`;
}

function isConsecutiveCalendarDay(previous: Date, current: Date): boolean {
  const next = new Date(previous);
  next.setDate(next.getDate() + 1);
  return (
    next.getFullYear() === current.getFullYear() &&
    next.getMonth() === current.getMonth() &&
    next.getDate() === current.getDate()
  );
}

function recordDays(record: LeaveRangeGroupable): number {
  return leaveDaysFromRecord({
    date: record.date,
    duration: record.duration,
    days: record.days,
  });
}

function groupLeaveRecordsIntoRanges<T extends LeaveRangeGroupable>(
  records: T[],
  groupBy: (record: T) => string,
): Array<T & { date: string; days: number }> {
  if (records.length === 0) return [];

  const buckets = new Map<string, T[]>();

  for (const record of records) {
    const key = groupBy(record);
    const list = buckets.get(key) ?? [];
    list.push(record);
    buckets.set(key, list);
  }

  const grouped: Array<T & { date: string; days: number }> = [];

  for (const bucket of buckets.values()) {
    const sorted = [...bucket].sort((left, right) => {
      const leftTime = parseLeaveDisplayDate(left.date)?.getTime() ?? 0;
      const rightTime = parseLeaveDisplayDate(right.date)?.getTime() ?? 0;
      return leftTime - rightTime;
    });

    let rangeStart = sorted[0];
    let rangeEnd = sorted[0];
    let rangeDays = recordDays(rangeStart);

    const flushRange = () => {
      const startDate = parseLeaveDisplayDate(rangeStart.date);
      const endDate = parseLeaveDisplayDate(rangeEnd.date);

      grouped.push({
        ...rangeStart,
        date: startDate && endDate ? formatLeaveDateRange(startDate, endDate) : rangeStart.date,
        days: rangeDays,
      });
    };

    for (let index = 1; index < sorted.length; index++) {
      const current = sorted[index];
      const previousDate = parseLeaveDisplayDate(rangeEnd.date);
      const currentDate = parseLeaveDisplayDate(current.date);

      if (previousDate && currentDate && isConsecutiveCalendarDay(previousDate, currentDate)) {
        rangeEnd = current;
        rangeDays += recordDays(current);
        continue;
      }

      flushRange();
      rangeStart = current;
      rangeEnd = current;
      rangeDays = recordDays(current);
    }

    flushRange();
  }

  return grouped.sort((left, right) => {
    const leftTime = parseLeaveDisplayDate(left.date)?.getTime() ?? 0;
    const rightTime = parseLeaveDisplayDate(right.date)?.getTime() ?? 0;
    return rightTime - leftTime;
  });
}

export function groupLeaveBucketEntriesForDisplay(entries: LeaveBucketEntry[]): LeaveBucketEntry[] {
  return groupLeaveRecordsIntoRanges(entries, (record) =>
    [record.duration, record.reason, record.status, record.rejectReason].join("\0"),
  );
}

export function groupLeaveApplicationsForDisplay(
  applications: LeaveApplication[],
): LeaveApplication[] {
  return groupLeaveRecordsIntoRanges(applications, (record) =>
    [record.leaveType, record.duration, record.reason, record.status, record.rejectReason].join(
      "\0",
    ),
  );
}
