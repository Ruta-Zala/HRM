import type { AttendanceRow } from "@/lib/google/attendance-sheets";

/** Identifies where an employee's attendance is stored (Sheets id vs Firebase employee id). */
export type AttendanceStorageRef = {
  employeeId: string;
  spreadsheetId: string;
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
};
