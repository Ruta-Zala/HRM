import type { LeaveBucketType } from "@/lib/attendance/leave-bucket-layout";
import {
  addGroupedLeaveDatesToBucket,
  readLeaveBucketRows,
  type LeaveBucketStorageRef,
} from "@/lib/attendance/leave-bucket/repository";

export type { LeaveBucketStorageRef };

type LeaveBucketCacheEntry = {
  rows: string[][];
  expiresAt: number;
};

const LEAVE_BUCKET_CACHE_TTL_MS = 15_000;
const leaveBucketCache = new Map<string, LeaveBucketCacheEntry>();
const leaveBucketInflight = new Map<string, Promise<string[][]>>();

function cacheKey(ref: LeaveBucketStorageRef): string {
  return ref.employeeId.trim();
}

export function invalidateLeaveBucketRowsCache(employeeId: string): void {
  const key = employeeId.trim();
  if (!key) return;
  leaveBucketCache.delete(key);
  leaveBucketInflight.delete(key);
}

export async function readLeaveBucketRowsCached(ref: LeaveBucketStorageRef): Promise<string[][]> {
  return readLeaveBucketRowsForAbsenceExplanation(ref);
}

export async function readLeaveBucketRowsForAbsenceExplanation(
  ref: LeaveBucketStorageRef,
): Promise<string[][]> {
  const key = cacheKey(ref);
  if (!key) return readLeaveBucketRows(ref);

  const cached = leaveBucketCache.get(key);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.rows;
  }

  const inflight = leaveBucketInflight.get(key);
  if (inflight) return inflight;

  const promise = readLeaveBucketRows(ref)
    .then((rows) => {
      leaveBucketCache.set(key, { rows, expiresAt: Date.now() + LEAVE_BUCKET_CACHE_TTL_MS });
      return rows;
    })
    .finally(() => {
      leaveBucketInflight.delete(key);
    });

  leaveBucketInflight.set(key, promise);
  return promise;
}

export async function addGroupedLeaveDatesToBucketForAbsenceExplanation(
  ref: LeaveBucketStorageRef,
  groups: Array<{ leaveType: LeaveBucketType; dates: Date[] }>,
  duration: "full" | "half_am" | "half_pm" = "full",
  reason = "",
): Promise<void> {
  await addGroupedLeaveDatesToBucket(ref, groups, duration, reason);
  invalidateLeaveBucketRowsCache(ref.employeeId);
}
