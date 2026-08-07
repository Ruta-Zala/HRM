import type { LeaveBucketType } from "@/lib/attendance/leave-bucket-layout";
import {
  addGroupedLeaveDatesToBucket,
  readLeaveBucketRows,
  type LeaveBucketStorageRef,
} from "@/lib/attendance/leave-bucket/repository";

export type { LeaveBucketStorageRef };

export async function readLeaveBucketRowsCached(ref: LeaveBucketStorageRef): Promise<string[][]> {
  return readLeaveBucketRowsForAbsenceExplanation(ref);
}

export async function readLeaveBucketRowsForAbsenceExplanation(
  ref: LeaveBucketStorageRef,
): Promise<string[][]> {
  return readLeaveBucketRows(ref);
}

export async function addGroupedLeaveDatesToBucketForAbsenceExplanation(
  ref: LeaveBucketStorageRef,
  groups: Array<{ leaveType: LeaveBucketType; dates: Date[] }>,
  duration: "full" | "half_am" | "half_pm" = "full",
  reason = "",
): Promise<void> {
  await addGroupedLeaveDatesToBucket(ref, groups, duration, reason);
}
