import {
  LEAVE_BUCKET_COLUMN_COUNT,
  LEAVE_BUCKET_COLUMN_GROUPS,
  normalizeLeaveBucketRow,
  type LeaveBucketType,
} from "@/lib/attendance/leave-bucket-layout";
import { LEAVE_STATUS } from "@/lib/attendance/leave-status";

export function formatLeaveBucketDate(date: Date): string {
  const day = date.getDate();
  const month = date.getMonth() + 1;
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

export function formatLeaveDurationLabel(duration: "full" | "half_am" | "half_pm"): string {
  if (duration === "half_am") return "Half Day (AM)";
  if (duration === "half_pm") return "Half Day (PM)";
  return "Full Day";
}

function findNextEmptySlot(
  rows: string[][],
  colIndex: number,
  statusColIndex: number,
  allowUnlimitedRows = false,
): number | null {
  for (let i = 1; i < rows.length; i++) {
    const monthLabel = String(rows[i]?.[0] ?? "").trim();
    if (!monthLabel) continue;

    const cell = String(rows[i]?.[colIndex] ?? "").trim();
    const status = String(rows[i]?.[statusColIndex] ?? "")
      .trim()
      .toLowerCase();
    if (!cell || status === LEAVE_STATUS.REJECTED.toLowerCase()) return i;
  }

  if (!allowUnlimitedRows) {
    return null;
  }

  for (let i = 1; i < rows.length; i++) {
    const monthLabel = String(rows[i]?.[0] ?? "").trim();
    if (monthLabel) continue;

    const cell = String(rows[i]?.[colIndex] ?? "").trim();
    const status = String(rows[i]?.[statusColIndex] ?? "")
      .trim()
      .toLowerCase();
    if (!cell || status === LEAVE_STATUS.REJECTED.toLowerCase()) return i;
  }

  const newRow = new Array(LEAVE_BUCKET_COLUMN_COUNT).fill("");
  rows.push(newRow);
  return rows.length - 1;
}

function findNextBirthdayApplySlot(rows: string[][]): number | null {
  const columns = LEAVE_BUCKET_COLUMN_GROUPS.birthday;

  for (let i = 1; i < rows.length; i++) {
    rows[i] = normalizeLeaveBucketRow(rows[i]);
    const date = String(rows[i][columns.date] ?? "").trim();
    const status = String(rows[i][columns.status] ?? "").trim();
    if (date && !status) return i;
    if (status.toLowerCase() === LEAVE_STATUS.REJECTED.toLowerCase()) return i;
  }

  return findNextEmptySlot(rows, columns.date, columns.status, true);
}

export function applyLeaveDatesToRows(
  rows: string[][],
  leaveType: LeaveBucketType,
  dates: Date[],
  duration: "full" | "half_am" | "half_pm",
  reason: string,
): Array<{ rowIndex: number; leaveType: LeaveBucketType }> {
  const columns = LEAVE_BUCKET_COLUMN_GROUPS[leaveType];
  const allowUnlimitedRows = leaveType !== "birthday";
  const durationLabel = formatLeaveDurationLabel(duration);
  const appliedRows: Array<{ rowIndex: number; leaveType: LeaveBucketType }> = [];

  for (const date of dates) {
    const rowIndex =
      leaveType === "birthday"
        ? findNextBirthdayApplySlot(rows)
        : findNextEmptySlot(rows, columns.date, columns.status, allowUnlimitedRows);

    if (rowIndex == null) {
      throw new Error(`No available slot in ${leaveType} leave column.`);
    }

    rows[rowIndex] = normalizeLeaveBucketRow(rows[rowIndex]);
    rows[rowIndex][columns.date] = formatLeaveBucketDate(date);
    if (columns.duration != null) {
      rows[rowIndex][columns.duration] = durationLabel;
    }
    if (columns.reason != null) {
      rows[rowIndex][columns.reason] = reason;
    }
    rows[rowIndex][columns.status] = LEAVE_STATUS.APPLIED;
    rows[rowIndex][columns.rejectReason] = "";

    appliedRows.push({ rowIndex, leaveType });
  }

  return appliedRows;
}
