import {
  computeLiveWorkedMs,
  endBreak,
  getMonthAttendance,
  getTodayAttendance,
  listAttendanceMonthlySheetsAcrossYears,
  punchIn,
  punchOut,
  startBreak,
  updateDailyUpdate,
} from "@/lib/google/attendance-sheets";

import type { AttendanceRepository } from "./types";

export const sheetsAttendanceRepository: AttendanceRepository = {
  getTodayAttendance(ref, date) {
    return getTodayAttendance(ref.spreadsheetId, date);
  },
  getMonthAttendance(ref, year, monthIndex) {
    return getMonthAttendance(ref.spreadsheetId, year, monthIndex);
  },
  listMonthlySheetsAcrossYears(ref) {
    return listAttendanceMonthlySheetsAcrossYears(ref.spreadsheetId);
  },
  punchIn(ref, date, options) {
    return punchIn(ref.spreadsheetId, date, options);
  },
  punchOut(ref, date, options) {
    return punchOut(ref.spreadsheetId, date, options);
  },
  startBreak(ref, date) {
    return startBreak(ref.spreadsheetId, date);
  },
  endBreak(ref, date) {
    return endBreak(ref.spreadsheetId, date);
  },
  updateDailyUpdate(ref, dateIso, dailyUpdate) {
    return updateDailyUpdate(ref.spreadsheetId, dateIso, dailyUpdate);
  },
};

export { computeLiveWorkedMs };
