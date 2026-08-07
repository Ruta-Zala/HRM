import type { LeaveBucketType } from "@/lib/attendance/leave-bucket-layout";

export type LeaveBucketStorageRef = {
  employeeId: string;
  spreadsheetId?: string;
};

export type LeaveBucketRepository = {
  readRows(ref: LeaveBucketStorageRef): Promise<string[][]>;
  saveRows(ref: LeaveBucketStorageRef, rows: string[][]): Promise<void>;
  addGroupedLeaveDates(
    ref: LeaveBucketStorageRef,
    groups: Array<{ leaveType: LeaveBucketType; dates: Date[] }>,
    duration: "full" | "half_am" | "half_pm",
    reason: string,
  ): Promise<void>;
  importCsv(ref: LeaveBucketStorageRef, content: string): Promise<void>;
};
