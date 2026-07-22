import { leaveRowCountsTowardQuota } from "@/lib/attendance/leave-approvals";
import {
  formatLeaveDayCount,
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

export type LeavePolicyBalance = {
  allocated: number;
  accrued: number;
  used: number;
  expired: number;
  available: number;
  remaining: number;
};

export type LeavePolicyBalances = {
  paid: LeavePolicyBalance;
  sick: LeavePolicyBalance;
  casual: LeavePolicyBalance;
  birthday: LeavePolicyBalance;
};

function parsePolicyDate(value: string): Date | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const slashMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (slashMatch) {
    const date = new Date(Number(slashMatch[3]), Number(slashMatch[2]) - 1, Number(slashMatch[1]));
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    const date = new Date(Number(isoMatch[1]), Number(isoMatch[2]) - 1, Number(isoMatch[3]));
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function usageByQuarter(rows: string[][], leaveType: "sick" | "casual", year: number): number[] {
  const usage = [0, 0, 0, 0];
  const columns = LEAVE_BUCKET_COLUMN_GROUPS[leaveType];

  for (let i = 1; i < rows.length; i++) {
    const row = normalizeLeaveBucketRow(rows[i]);
    if (!leaveRowCountsTowardQuota(row, leaveType)) continue;

    const date = parsePolicyDate(String(row[columns.date] ?? ""));
    if (!date || date.getFullYear() !== year) continue;

    usage[Math.floor(date.getMonth() / 3)] += countLeaveDaysInRow(row, leaveType);
  }

  return usage;
}

function annualUsage(rows: string[][], leaveType: "paid" | "birthday", year: number): number {
  const columns = LEAVE_BUCKET_COLUMN_GROUPS[leaveType];
  let usage = 0;

  for (let i = 1; i < rows.length; i++) {
    const row = normalizeLeaveBucketRow(rows[i]);
    if (!leaveRowCountsTowardQuota(row, leaveType)) continue;

    const date = parsePolicyDate(String(row[columns.date] ?? ""));
    if (!date || date.getFullYear() !== year) continue;
    usage += countLeaveDaysInRow(row, leaveType);
  }

  return usage;
}

export function getLeavePolicyBalances(
  rows: string[][],
  asOfDate: Date = new Date(),
): LeavePolicyBalances {
  const year = asOfDate.getFullYear();
  const currentQuarter = Math.floor(asOfDate.getMonth() / 3);
  const paidAccrued = asOfDate.getMonth() + 1;
  const paidUsed = annualUsage(rows, "paid", year);
  const birthdayUsed = annualUsage(rows, "birthday", year);

  const periodicBalance = (leaveType: "sick" | "casual"): LeavePolicyBalance => {
    const quarterlyUsage = usageByQuarter(rows, leaveType, year);
    const used = quarterlyUsage.reduce((sum, value) => sum + value, 0);
    const expired = quarterlyUsage
      .slice(0, currentQuarter)
      .reduce((sum, value) => sum + Math.max(0, 1 - value), 0);
    const available = Math.max(0, 1 - quarterlyUsage[currentQuarter]);
    const remaining = Math.max(0, LEAVE_ALLOCATIONS[leaveType] - used - expired);

    return {
      allocated: LEAVE_ALLOCATIONS[leaveType],
      accrued: currentQuarter + 1,
      used,
      expired,
      available,
      remaining,
    };
  };

  return {
    paid: {
      allocated: LEAVE_ALLOCATIONS.paid,
      accrued: paidAccrued,
      used: paidUsed,
      expired: 0,
      available: Math.max(0, paidAccrued - paidUsed),
      remaining: Math.max(0, paidAccrued - paidUsed),
    },
    sick: periodicBalance("sick"),
    casual: periodicBalance("casual"),
    birthday: {
      allocated: LEAVE_ALLOCATIONS.birthday,
      accrued: LEAVE_ALLOCATIONS.birthday,
      used: birthdayUsed,
      expired: 0,
      available: Math.max(0, LEAVE_ALLOCATIONS.birthday - birthdayUsed),
      remaining: Math.max(0, LEAVE_ALLOCATIONS.birthday - birthdayUsed),
    },
  };
}

function dayWeight(duration: "full" | "half_am" | "half_pm"): number {
  return duration === "full" ? 1 : 0.5;
}

export type LeaveDateAssignment = {
  date: Date;
  bucket: LeaveBucketType;
};

export function allocateLeaveDates(params: {
  leaveType: LeaveBucketType;
  dates: Date[];
  duration: "full" | "half_am" | "half_pm";
  usage: Record<LeaveBucketType, number>;
  rows?: string[][];
  asOfDate?: Date;
}): { assignments: LeaveDateAssignment[]; error?: string } {
  const { leaveType, dates, duration } = params;
  const asOfDate = params.asOfDate ?? new Date();
  const weight = dayWeight(duration);
  const balances = getLeavePolicyBalances(params.rows ?? [], asOfDate);

  if (leaveType === "unpaid") {
    return {
      assignments: dates.map((date) => ({ date, bucket: "unpaid" })),
    };
  }

  const currentYear = asOfDate.getFullYear();
  if (dates.some((date) => date.getFullYear() !== currentYear)) {
    return {
      assignments: [],
      error: `${leaveType === "birthday" ? "Birthday" : `${leaveType[0].toUpperCase()}${leaveType.slice(1)}`} leave can only be applied within the current leave year.`,
    };
  }

  if (leaveType === "sick" || leaveType === "casual") {
    const currentQuarter = Math.floor(asOfDate.getMonth() / 3);
    const outsideCurrentQuarter = dates.some(
      (date) => Math.floor(date.getMonth() / 3) !== currentQuarter,
    );

    if (outsideCurrentQuarter) {
      const quarterStart = new Date(currentYear, currentQuarter * 3, 1);
      const quarterEnd = new Date(currentYear, currentQuarter * 3 + 3, 0);
      const formatMonth = (date: Date) =>
        new Intl.DateTimeFormat("en", { month: "long" }).format(date);
      return {
        assignments: [],
        error: `${leaveType === "sick" ? "Sick" : "Casual"} leave is only valid for the current quarter (${formatMonth(quarterStart)}–${formatMonth(quarterEnd)}).`,
      };
    }
  }

  const remaining: Record<Exclude<LeaveBucketType, "unpaid">, number> = {
    paid: balances.paid.available,
    sick: balances.sick.available,
    casual: balances.casual.available,
    birthday: balances.birthday.available,
  };
  const cascades: Record<LeaveBucketType, LeaveBucketType[]> = {
    paid: ["paid", "sick", "casual", "unpaid"],
    sick: ["sick", "casual", "unpaid"],
    casual: ["casual", "sick", "unpaid"],
    birthday: ["birthday"],
    unpaid: ["unpaid"],
  };
  const currentQuarter = Math.floor(asOfDate.getMonth() / 3);
  const assignments: LeaveDateAssignment[] = [];

  for (const date of dates) {
    let assignedBucket: LeaveBucketType | null = null;

    for (const bucket of cascades[leaveType]) {
      if (bucket === "unpaid") {
        assignedBucket = bucket;
        break;
      }

      if (
        (bucket === "sick" || bucket === "casual") &&
        Math.floor(date.getMonth() / 3) !== currentQuarter
      ) {
        continue;
      }

      if (remaining[bucket] >= weight) {
        remaining[bucket] -= weight;
        assignedBucket = bucket;
        break;
      }
    }

    if (!assignedBucket) {
      return {
        assignments: [],
        error: `Only ${formatLeaveDayCount(balances.birthday.available)} of birthday leave is available this year.`,
      };
    }

    assignments.push({ date, bucket: assignedBucket });
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
