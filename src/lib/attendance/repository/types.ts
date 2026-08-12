import type { AttendanceRow } from "@/lib/google/attendance-sheets";
import type { CorrectionField } from "@/lib/attendance/constants";

/** Identifies where an employee's attendance is stored (Sheets id vs Firebase employee id). */
export type AttendanceStorageRef = {
  employeeId: string;
  spreadsheetId: string;
};

export type AttendanceImportRecord = {
  dateIso: string;
  punchIn: string;
  punchOut: string;
  dailyUpdate?: string;
  workMode?: string;
};

export type AttendanceRepository = {
  getTodayAttendance(ref: AttendanceStorageRef, date?: Date): Promise<AttendanceRow | null>;
  /** Day row for a date, even when punch-in is empty (used by dashboard absence checks). */
  getAttendanceForDate(ref: AttendanceStorageRef, dateIso: string): Promise<AttendanceRow | null>;
  getMonthAttendance(
    ref: AttendanceStorageRef,
    year: number,
    monthIndex: number,
  ): Promise<AttendanceRow[]>;
  listMonthlySheetsAcrossYears(ref: AttendanceStorageRef): Promise<string[]>;
  punchIn(
    ref: AttendanceStorageRef,
    date?: Date,
    options?: { workMode?: string },
  ): Promise<AttendanceRow>;
  punchOut(
    ref: AttendanceStorageRef,
    date?: Date,
    options?: { earlyLeaveReason?: string; dailyUpdate?: string },
  ): Promise<AttendanceRow>;
  startBreak(ref: AttendanceStorageRef, date?: Date): Promise<AttendanceRow>;
  endBreak(ref: AttendanceStorageRef, date?: Date): Promise<AttendanceRow>;
  updateDailyUpdate(
    ref: AttendanceStorageRef,
    dateIso: string,
    dailyUpdate: string,
  ): Promise<AttendanceRow>;
  /** Close an open session left past midnight; returns null when nothing to close. */
  autoPunchOutOpenSession(
    ref: AttendanceStorageRef,
    dateIso: string,
  ): Promise<AttendanceRow | null>;
  updateAttendanceField(
    ref: AttendanceStorageRef,
    dateIso: string,
    field: CorrectionField | "dailyUpdate" | "isOvertimeApproved",
    value: string,
  ): Promise<AttendanceRow>;
  updateOvertimeApproval(
    ref: AttendanceStorageRef,
    dateIso: string,
    overtimeApproval: string,
  ): Promise<AttendanceRow>;
  importAttendanceRecords(
    ref: AttendanceStorageRef,
    records: AttendanceImportRecord[],
  ): Promise<{ imported: number; updated: number }>;
  upsertManualAttendance(
    ref: AttendanceStorageRef,
    params: {
      dateIso: string;
      punchIn?: string;
      punchOut?: string;
      breakStart?: string;
      breakEnd?: string;
      totalBreakTime?: string;
      workMode?: string;
    },
  ): Promise<AttendanceRow>;
};
