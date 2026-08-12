import {
  LEAVE_BUCKET_COLUMN_GROUPS,
  migrateLeaveBucketRows,
  normalizeLeaveBucketRow,
  type LeaveBucketType,
} from "@/lib/attendance/leave-bucket-layout";
import { applyLeaveDatesToRows } from "@/lib/attendance/leave-bucket/operations";
import { leaveDaysFromRecord } from "@/lib/attendance/leave-display";
import {
  countsTowardLeaveQuota,
  LEAVE_STATUS,
  type LeaveStatus,
} from "@/lib/attendance/leave-status";
import { applyLeaveBucketRowFormat } from "@/lib/attendance/leave-bucket-format";
import {
  isLeaveBucketOnFirebase,
  readLeaveBucketRows,
  saveLeaveBucketRows,
} from "@/lib/attendance/leave-bucket/repository";
import { readLeaveBucketRowsCached } from "@/lib/attendance/leave-bucket-mirror";
import {
  OVERTIME_APPROVAL,
  WORK_MODE,
  WORKING_STATUS,
  isHalfDayUnpaidWorkMode,
} from "@/lib/attendance/constants";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { upsertApprovedLeaveAttendance } from "@/lib/google/attendance-sheets";
import { leaveDateToIso, workModeForApprovedLeave } from "@/lib/payroll/leave-attendance";
import { isAttendanceOnFirebase } from "@/lib/attendance/repository";

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
  employeeId: string;
  attendanceSpreadsheetId: string;
  rowIndex: number;
  leaveType: LeaveBucketType;
  date?: string;
}): string {
  const key = isLeaveBucketOnFirebase() ? params.employeeId : params.attendanceSpreadsheetId;
  const datePart = String(params.date ?? "")
    .trim()
    .replace(/\s+/g, "");
  return datePart
    ? `${key}:${params.rowIndex}:${params.leaveType}:${datePart}`
    : `${key}:${params.rowIndex}:${params.leaveType}`;
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
          employeeId: params.employeeId,
          attendanceSpreadsheetId: params.attendanceSpreadsheetId,
          rowIndex,
          leaveType,
          date,
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
  const rows = await readLeaveBucketRowsCached({
    employeeId: params.employeeId,
    spreadsheetId: params.attendanceSpreadsheetId,
  });
  return listLeaveApplicationsFromRows({
    rows,
    employeeId: params.employeeId,
    employeeName: params.employeeName,
    attendanceSpreadsheetId: params.attendanceSpreadsheetId,
    statusFilter: params.statusFilter,
  });
}

export async function getLeaveApplicationAtRow(params: {
  attendanceSpreadsheetId: string;
  rowIndex: number;
  leaveType: LeaveBucketType;
  employeeId: string;
  employeeName: string;
  rows?: string[][];
}): Promise<LeaveApplication | null> {
  const rows =
    params.rows ??
    (await readLeaveBucketRows({
      employeeId: params.employeeId,
      spreadsheetId: params.attendanceSpreadsheetId,
    }));
  const applications = listLeaveApplicationsFromRows({
    rows,
    employeeId: params.employeeId,
    employeeName: params.employeeName,
    attendanceSpreadsheetId: params.attendanceSpreadsheetId,
  });

  return (
    applications.find(
      (application) =>
        application.rowIndex === params.rowIndex && application.leaveType === params.leaveType,
    ) ?? null
  );
}

export async function reviewLeaveApplication(params: {
  employeeId: string;
  attendanceSpreadsheetId: string;
  rowIndex: number;
  leaveType: LeaveBucketType;
  status: typeof LEAVE_STATUS.ACCEPTED | typeof LEAVE_STATUS.REJECTED;
  rejectReason?: string;
  rows?: string[][];
}): Promise<void> {
  const rows =
    params.rows ??
    migrateLeaveBucketRows(
      await readLeaveBucketRows({
        employeeId: params.employeeId,
        spreadsheetId: params.attendanceSpreadsheetId,
      }),
    );
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
  rows[params.rowIndex] = row;

  const ref = {
    employeeId: params.employeeId,
    spreadsheetId: params.attendanceSpreadsheetId,
  };

  if (isLeaveBucketOnFirebase()) {
    await saveLeaveBucketRows(ref, rows);
  } else {
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

  if (params.status === LEAVE_STATUS.ACCEPTED) {
    const duration = columns.duration != null ? String(row[columns.duration] ?? "").trim() : "";
    const dateIso = leaveDateToIso(date);
    if (dateIso) {
      const workMode = workModeForApprovedLeave(params.leaveType, duration);
      if (isAttendanceOnFirebase() && params.employeeId.trim()) {
        await upsertApprovedLeaveAttendanceInFirebase({
          employeeId: params.employeeId,
          dateIso,
          workMode,
        });
      } else if (params.attendanceSpreadsheetId.trim()) {
        await upsertApprovedLeaveAttendance({
          spreadsheetId: params.attendanceSpreadsheetId,
          dateIso,
          workMode,
        });
      }
    }
  }
}

async function upsertApprovedLeaveAttendanceInFirebase(params: {
  employeeId: string;
  dateIso: string;
  workMode: string;
}): Promise<void> {
  const dayRef = getAdminFirestore()
    .collection("attendance")
    .doc(params.employeeId.trim())
    .collection("days")
    .doc(params.dateIso);

  const snap = await dayRef.get();
  const existing = (snap.data() ?? {}) as Record<string, unknown>;
  const isHalfDay =
    params.workMode === WORK_MODE.HALF_DAY_UNPAID_LEAVE ||
    params.workMode === WORK_MODE.HALF_DAY_PAID_LEAVE ||
    params.workMode === WORK_MODE.WFH_HALF_DAY ||
    isHalfDayUnpaidWorkMode(params.workMode);

  const next: Record<string, string> = {
    date: params.dateIso,
    workMode: params.workMode,
    status: WORKING_STATUS.ON_LEAVE,
    punchIn: String(existing.punchIn ?? ""),
    punchOut: String(existing.punchOut ?? ""),
    breakStart: String(existing.breakStart ?? ""),
    breakEnd: String(existing.breakEnd ?? ""),
    totalBreakTime: String(existing.totalBreakTime ?? ""),
    workingHours: String(existing.workingHours ?? ""),
    overtime: String(existing.overtime ?? "—"),
    earlyLeaveReason: String(existing.earlyLeaveReason ?? ""),
    dailyUpdate: String(existing.dailyUpdate ?? ""),
    isOvertimeApproved: String(existing.isOvertimeApproved ?? OVERTIME_APPROVAL.NOT_CONSIDERED),
  };

  if (!isHalfDay) {
    next.punchIn = "";
    next.punchOut = "";
    next.breakStart = "";
    next.breakEnd = "";
    next.totalBreakTime = "";
    next.workingHours = "";
    next.overtime = "—";
    next.earlyLeaveReason = "";
  } else if (!next.punchIn.trim()) {
    next.workingHours = "";
    next.overtime = "—";
  }

  await dayRef.set(next, { merge: true });
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

/**
 * Clear Applied/Accepted leave bucket entries for a calendar date.
 * Used when HR records normal working attendance that supersedes leave.
 * Returns how many leave cells were cleared.
 */
export async function cancelLeaveApplicationsForDate(params: {
  employeeId: string;
  attendanceSpreadsheetId: string;
  dateIso: string;
}): Promise<number> {
  const dateIso = params.dateIso.trim();
  if (!dateIso || !params.employeeId.trim()) return 0;

  const ref = {
    employeeId: params.employeeId,
    spreadsheetId: params.attendanceSpreadsheetId,
  };
  const rows = migrateLeaveBucketRows(await readLeaveBucketRows(ref)).map((row) =>
    normalizeLeaveBucketRow(row),
  );

  let cleared = 0;

  for (let rowIndex = 1; rowIndex < rows.length; rowIndex++) {
    const row = rows[rowIndex];
    let rowChanged = false;

    for (const leaveType of LEAVE_TYPES) {
      const columns = LEAVE_BUCKET_COLUMN_GROUPS[leaveType];
      const date = String(row[columns.date] ?? "").trim();
      if (!date) continue;
      if (leaveDateToIso(date) !== dateIso) continue;

      const status = String(row[columns.status] ?? "")
        .trim()
        .toLowerCase();
      if (
        status &&
        status !== LEAVE_STATUS.APPLIED.toLowerCase() &&
        status !== LEAVE_STATUS.ACCEPTED.toLowerCase()
      ) {
        continue;
      }

      row[columns.date] = "";
      if (columns.duration != null) row[columns.duration] = "";
      if (columns.reason != null) row[columns.reason] = "";
      row[columns.status] = "";
      row[columns.rejectReason] = "";
      cleared += 1;
      rowChanged = true;
    }

    if (rowChanged) {
      rows[rowIndex] = row;
    }
  }

  if (cleared > 0) {
    await saveLeaveBucketRows(ref, rows);
  }

  return cleared;
}

/**
 * Ensure an Accepted leave-bucket entry exists for a date (HR manual leave attendance).
 * Replaces any prior Applied/Accepted leave on that date so on-leave dashboards stay in sync.
 */
export async function ensureAcceptedLeaveForDate(params: {
  employeeId: string;
  attendanceSpreadsheetId: string;
  dateIso: string;
  leaveType: LeaveBucketType;
  duration: "full" | "half_am" | "half_pm";
  reason?: string;
}): Promise<boolean> {
  const dateIso = params.dateIso.trim();
  if (!dateIso || !params.employeeId.trim()) return false;

  const baseDate = new Date(`${dateIso}T12:00:00`);
  if (Number.isNaN(baseDate.getTime())) return false;

  await cancelLeaveApplicationsForDate({
    employeeId: params.employeeId,
    attendanceSpreadsheetId: params.attendanceSpreadsheetId,
    dateIso,
  });

  const ref = {
    employeeId: params.employeeId,
    spreadsheetId: params.attendanceSpreadsheetId,
  };
  const rows = migrateLeaveBucketRows(await readLeaveBucketRows(ref)).map((row) =>
    normalizeLeaveBucketRow(row),
  );

  const applied = applyLeaveDatesToRows(
    rows,
    params.leaveType,
    [baseDate],
    params.duration,
    params.reason?.trim() || "Recorded by HR",
  );

  for (const entry of applied) {
    const columns = LEAVE_BUCKET_COLUMN_GROUPS[entry.leaveType];
    rows[entry.rowIndex] = normalizeLeaveBucketRow(rows[entry.rowIndex]);
    rows[entry.rowIndex][columns.status] = LEAVE_STATUS.ACCEPTED;
    rows[entry.rowIndex][columns.rejectReason] = "";
  }

  await saveLeaveBucketRows(ref, rows);

  if (!isLeaveBucketOnFirebase() && params.attendanceSpreadsheetId.trim()) {
    for (const entry of applied) {
      await applyLeaveBucketRowFormat({
        spreadsheetId: params.attendanceSpreadsheetId,
        rowIndex: entry.rowIndex,
        leaveType: entry.leaveType,
        status: LEAVE_STATUS.ACCEPTED,
      });
    }
  }

  return applied.length > 0;
}
