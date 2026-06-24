import { leaveRowCountsTowardQuota } from "@/lib/attendance/leave-approvals";
import {
  leaveDaysFromDurationLabel,
  leaveDaysFromEntry,
  leaveDaysFromRecord,
} from "@/lib/attendance/leave-display";
import {
  LEAVE_BUCKET_COLUMN_GROUPS,
  normalizeLeaveBucketRow,
  type LeaveBucketType,
} from "@/lib/attendance/leave-bucket-layout";

export {
  formatLeaveDayCount,
  leaveDaysFromDurationLabel,
  leaveDaysFromEntry,
  leaveDaysFromRecord,
} from "@/lib/attendance/leave-display";

export const LEAVE_ALLOCATIONS = {
  paid: 12,
  sick: 4,
  casual: 4,
  birthday: 1,
} as const;

export type { LeaveBucketType };

/** When paid leave is exceeded, overflow uses sick before casual. */
const PAID_LEAVE_CASCADE: LeaveBucketType[] = ["paid", "sick", "casual", "unpaid"];

/** When sick leave is exceeded, overflow can use casual then unpaid. */
const SICK_LEAVE_CASCADE: LeaveBucketType[] = ["sick", "casual", "unpaid"];

/** When casual leave is exceeded, overflow can use sick then unpaid. */
const CASUAL_LEAVE_CASCADE: LeaveBucketType[] = ["casual", "sick", "unpaid"];

export function countLeaveDaysInCell(cell: string): number {
  const trimmed = cell.trim();
  if (!trimmed) return 0;

  return trimmed
    .split(/\s*,\s*/)
    .map((entry) => leaveDaysFromEntry(entry))
    .reduce((sum, days) => sum + days, 0);
}

function countLeaveDaysInRow(row: string[], leaveType: LeaveBucketType): number {
  const columns = LEAVE_BUCKET_COLUMN_GROUPS[leaveType];
  const cell = String(row[columns.date] ?? "").trim();
  if (!cell || !leaveRowCountsTowardQuota(row, leaveType)) return 0;

  const durationLabel = columns.duration != null ? String(row[columns.duration] ?? "").trim() : "";
  if (durationLabel) {
    return leaveDaysFromDurationLabel(durationLabel);
  }

  return countLeaveDaysInCell(cell);
}

export function countLeaveBucketUsage(rows: string[][]): Record<LeaveBucketType, number> {
  const usage: Record<LeaveBucketType, number> = {
    paid: 0,
    casual: 0,
    sick: 0,
    unpaid: 0,
    birthday: 0,
  };

  for (const type of Object.keys(usage) as LeaveBucketType[]) {
    for (let i = 1; i < rows.length; i++) {
      usage[type] += countLeaveDaysInRow(normalizeLeaveBucketRow(rows[i]), type);
    }
  }

  return usage;
}

export function remainingLeaveDays(
  type: Exclude<LeaveBucketType, "unpaid">,
  usage: Record<LeaveBucketType, number>,
): number {
  return Math.max(0, LEAVE_ALLOCATIONS[type] - usage[type]);
}

function dayWeight(duration: "full" | "half_am" | "half_pm"): number {
  return duration === "full" ? 1 : 0.5;
}

export type LeaveDateAssignment = {
  date: Date;
  bucket: LeaveBucketType;
};

function getCascadeForLeaveType(leaveType: LeaveBucketType): LeaveBucketType[] {
  switch (leaveType) {
    case "paid":
      return PAID_LEAVE_CASCADE;
    case "sick":
      return SICK_LEAVE_CASCADE;
    case "casual":
      return CASUAL_LEAVE_CASCADE;
    case "birthday":
      return ["birthday"];
    case "unpaid":
      return ["unpaid"];
    default:
      return PAID_LEAVE_CASCADE;
  }
}

function assignDateToCascade(params: {
  cascade: LeaveBucketType[];
  weight: number;
  remaining: Record<LeaveBucketType, number>;
  usage: Record<LeaveBucketType, number>;
}): LeaveBucketType | null {
  const { cascade, weight, remaining, usage } = params;

  for (const bucket of cascade) {
    if (bucket === "unpaid") {
      return "unpaid";
    }

    const available = remaining[bucket];
    if (available >= weight) {
      remaining[bucket] -= weight;
      usage[bucket] += weight;
      return bucket;
    }
  }

  return null;
}

export function allocateLeaveDates(params: {
  leaveType: LeaveBucketType;
  dates: Date[];
  duration: "full" | "half_am" | "half_pm";
  usage: Record<LeaveBucketType, number>;
}): { assignments: LeaveDateAssignment[]; error?: string } {
  const { leaveType, dates, duration, usage } = params;
  const weight = dayWeight(duration);
  const assignments: LeaveDateAssignment[] = [];
  const cascade = getCascadeForLeaveType(leaveType);

  const remaining: Record<LeaveBucketType, number> = {
    paid: remainingLeaveDays("paid", usage),
    sick: remainingLeaveDays("sick", usage),
    casual: remainingLeaveDays("casual", usage),
    birthday: remainingLeaveDays("birthday", usage),
    unpaid: Number.POSITIVE_INFINITY,
  };

  for (const date of dates) {
    const bucket = assignDateToCascade({
      cascade,
      weight,
      remaining,
      usage,
    });

    if (!bucket) {
      const message =
        leaveType === "birthday"
          ? "Birthday leave quota exhausted (1 day per year)."
          : leaveType === "sick"
            ? `Sick leave quota exhausted (${LEAVE_ALLOCATIONS.sick} days per year).`
            : leaveType === "casual"
              ? `Casual leave quota exhausted (${LEAVE_ALLOCATIONS.casual} days per year).`
              : "Unable to allocate leave for the selected dates.";

      return { assignments: [], error: message };
    }

    assignments.push({ date, bucket });
  }

  return { assignments };
}

export function groupAssignmentsByBucket(
  assignments: LeaveDateAssignment[],
): Map<LeaveBucketType, Date[]> {
  const grouped = new Map<LeaveBucketType, Date[]>();

  for (const { date, bucket } of assignments) {
    const existing = grouped.get(bucket) ?? [];
    existing.push(date);
    grouped.set(bucket, existing);
  }

  return grouped;
}

export type LeaveBucketEntry = {
  slot: string;
  date: string;
  duration: string;
  reason: string;
  status: string;
  rejectReason: string;
  days: number;
};

export function listLeaveBucketEntries(
  rows: string[][],
  leaveType: LeaveBucketType,
): LeaveBucketEntry[] {
  const columns = LEAVE_BUCKET_COLUMN_GROUPS[leaveType];
  const entries: LeaveBucketEntry[] = [];

  for (let i = 1; i < rows.length; i++) {
    const row = normalizeLeaveBucketRow(rows[i]);
    const cell = String(row[columns.date] ?? "").trim();
    if (!cell) continue;

    const slot = String(row[0] ?? "").trim();
    const duration = columns.duration != null ? String(row[columns.duration] ?? "").trim() : "";
    const reason = columns.reason != null ? String(row[columns.reason] ?? "").trim() : "";
    const status = String(row[columns.status] ?? "").trim();
    const rejectReason = String(row[columns.rejectReason] ?? "").trim();
    const days = leaveDaysFromRecord({ date: cell, duration });

    const dateParts = cell
      .split(/\s*,\s*/)
      .map((part) => part.trim())
      .filter(Boolean);

    if (dateParts.length <= 1) {
      entries.push({
        slot,
        date: dateParts[0] ?? cell,
        duration,
        reason,
        status,
        rejectReason,
        days,
      });
      continue;
    }

    for (const date of dateParts) {
      entries.push({
        slot,
        date,
        duration,
        reason,
        status,
        rejectReason,
        days: leaveDaysFromEntry(date),
      });
    }
  }

  return entries;
}
