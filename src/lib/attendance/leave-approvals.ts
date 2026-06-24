import {
  LEAVE_BUCKET_COLUMN_GROUPS,
  migrateLeaveBucketRows,
  normalizeLeaveBucketRow,
  type LeaveBucketType,
} from "@/lib/attendance/leave-bucket-layout";
import { leaveDaysFromRecord } from "@/lib/attendance/leave-display";
import {
  countsTowardLeaveQuota,
  LEAVE_STATUS,
  type LeaveStatus,
} from "@/lib/attendance/leave-status";
import { applyLeaveBucketRowFormat } from "@/lib/attendance/leave-bucket-format";
import { readLeaveBucketRows } from "@/lib/google/attendance-sheets";

export type LeaveApplication = {
  id: string;
  employeeId: string;
  employeeName: string;
  attendanceSpreadsheetId: string;
  leaveType: LeaveBucketType;
  slot: string;
  date: string;
  duration: string;
  reason: string;
  status: string;
  rejectReason: string;
  rowIndex: number;
  days: number;
};

const LEAVE_TYPES = Object.keys(LEAVE_BUCKET_COLUMN_GROUPS) as LeaveBucketType[];

export function buildLeaveApplicationId(params: {
  attendanceSpreadsheetId: string;
  rowIndex: number;
  leaveType: LeaveBucketType;
}): string {
  return `${params.attendanceSpreadsheetId}:${params.rowIndex}:${params.leaveType}`;
}

export function listLeaveApplicationsFromRows(params: {
  rows: string[][];
  employeeId: string;
  employeeName: string;
  attendanceSpreadsheetId: string;
  statusFilter?: LeaveStatus;
}): LeaveApplication[] {
  const applications: LeaveApplication[] = [];

  for (let rowIndex = 1; rowIndex < params.rows.length; rowIndex++) {
    const row = normalizeLeaveBucketRow(params.rows[rowIndex]);
    const slot = String(row[0] ?? "").trim();

    for (const leaveType of LEAVE_TYPES) {
      const columns = LEAVE_BUCKET_COLUMN_GROUPS[leaveType];
      const date = String(row[columns.date] ?? "").trim();
      if (!date) continue;

      const status = String(row[columns.status] ?? "").trim();
      if (!status) continue;
      if (params.statusFilter && status.toLowerCase() !== params.statusFilter.toLowerCase()) {
        continue;
      }

      const duration = columns.duration != null ? String(row[columns.duration] ?? "").trim() : "";
      const reason = columns.reason != null ? String(row[columns.reason] ?? "").trim() : "";

      applications.push({
        id: buildLeaveApplicationId({
          attendanceSpreadsheetId: params.attendanceSpreadsheetId,
          rowIndex,
          leaveType,
        }),
        employeeId: params.employeeId,
        employeeName: params.employeeName,
        attendanceSpreadsheetId: params.attendanceSpreadsheetId,
        leaveType,
        slot,
        date,
        duration,
        reason,
        status,
        rejectReason: String(row[columns.rejectReason] ?? "").trim(),
        rowIndex,
        days: leaveDaysFromRecord({ date, duration }),
      });
    }
  }

  return applications;
}

export async function listLeaveApplications(params: {
  employeeId: string;
  employeeName: string;
  attendanceSpreadsheetId: string;
  statusFilter?: LeaveStatus;
}): Promise<LeaveApplication[]> {
  const rows = await readLeaveBucketRows(params.attendanceSpreadsheetId);
  return listLeaveApplicationsFromRows({
    rows,
    employeeId: params.employeeId,
    employeeName: params.employeeName,
    attendanceSpreadsheetId: params.attendanceSpreadsheetId,
    statusFilter: params.statusFilter,
  });
}

export async function reviewLeaveApplication(params: {
  attendanceSpreadsheetId: string;
  rowIndex: number;
  leaveType: LeaveBucketType;
  status: typeof LEAVE_STATUS.ACCEPTED | typeof LEAVE_STATUS.REJECTED;
  rejectReason?: string;
}): Promise<void> {
  const rows = migrateLeaveBucketRows(await readLeaveBucketRows(params.attendanceSpreadsheetId));
  const row = normalizeLeaveBucketRow(rows[params.rowIndex] ?? []);
  const columns = LEAVE_BUCKET_COLUMN_GROUPS[params.leaveType];
  const date = String(row[columns.date] ?? "").trim();

  if (!date) {
    throw new Error("Leave application not found");
  }

  const currentStatus = String(row[columns.status] ?? "").trim();
  if (currentStatus.toLowerCase() !== LEAVE_STATUS.APPLIED.toLowerCase()) {
    throw new Error("Only applied leave requests can be reviewed");
  }

  if (params.status === LEAVE_STATUS.REJECTED && !(params.rejectReason ?? "").trim()) {
    throw new Error("Reject reason is required");
  }

  row[columns.status] = params.status;
  row[columns.rejectReason] =
    params.status === LEAVE_STATUS.REJECTED ? String(params.rejectReason ?? "").trim() : "";

  const { getSheetsClient } = await import("@/lib/google/drive-auth");
  const sheetsApi = await getSheetsClient();

  await sheetsApi.spreadsheets.values.update({
    spreadsheetId: params.attendanceSpreadsheetId,
    range: `Leave Bucket!A${params.rowIndex + 1}:X${params.rowIndex + 1}`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [row] },
  });

  await applyLeaveBucketRowFormat({
    spreadsheetId: params.attendanceSpreadsheetId,
    rowIndex: params.rowIndex,
    leaveType: params.leaveType,
    status: params.status,
  });
}

export function leaveRowCountsTowardQuota(row: string[], leaveType: LeaveBucketType): boolean {
  const columns = LEAVE_BUCKET_COLUMN_GROUPS[leaveType];
  const date = String(row[columns.date] ?? "").trim();
  if (!date) return false;

  const status = String(row[columns.status] ?? "").trim();
  if (!status) {
    return leaveType !== "birthday";
  }

  return countsTowardLeaveQuota(status);
}
