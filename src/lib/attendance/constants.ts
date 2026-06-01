/** Net working time required per day (break time does not count). */
export const IDEAL_WORKING_HOURS = 8;

/** Standard paid break allowance per day. */
export const IDEAL_BREAK_HOURS = 1;

/** Default break assumed for legacy CSV imports (no break column in source file). */
export const IMPORT_DEFAULT_BREAK = "1h";

/** Typical on-site duration: work + break (e.g. 8h + 1h = 9h). */
export const IDEAL_SHIFT_HOURS = IDEAL_WORKING_HOURS + IDEAL_BREAK_HOURS;

export const ATTENDANCE_HEADERS = [
  "Date",
  "Work Mode",
  "Punch In",
  "Punch Out",
  "Break Start",
  "Break End",
  "Total Break Time",
  "Working Hours",
  "Status",
  "Overtime",
  "Early Leave Reason",
  "Daily Update",
  "Is Overtime Approved",
] as const;

/** Last column letter for attendance row ranges (A through M). */
export const ATTENDANCE_LAST_COLUMN = "M";

export type AttendanceColumn = (typeof ATTENDANCE_HEADERS)[number];

export const ATTENDANCE_COL = {
  date: 0,
  workMode: 1,
  punchIn: 2,
  punchOut: 3,
  breakStart: 4,
  breakEnd: 5,
  totalBreakTime: 6,
  workingHours: 7,
  status: 8,
  overtime: 9,
  earlyLeaveReason: 10,
  dailyUpdate: 11,
  isOvertimeApproved: 12,
} as const;

export const WORK_MODE = {
  WFH: "WFH",
  WFH_HALF_DAY: "WFH - HD",
  FULL_DAY_LEAVE: "Full Day Leave",
  PAID_LEAVE: "Paid Leave",
  SICK_LEAVE: "Sick Leave",
  CASUAL_LEAVE: "Casual Leave",
  UNPAID_LEAVE: "Unpaid Leave",
  HALF_DAY_PAID_LEAVE: "Half Day Paid Leave",
  HALF_DAY_UNPAID_LEAVE: "Half Day Unpaid Leave",
  PUBLIC_HOLIDAY: "Public Holiday",
  WEEKEND_HOLIDAY: "Weekend Holiday",
  FULL_DAY_ONSITE: "Full Day Onsite",
  HALF_DAY_LEAVE: "Half Day Leave",
  SL: "SL",
} as const;

export const WORK_MODE_OPTIONS = [
  WORK_MODE.WFH,
  WORK_MODE.WFH_HALF_DAY,
  WORK_MODE.FULL_DAY_LEAVE,
  WORK_MODE.PAID_LEAVE,
  WORK_MODE.SICK_LEAVE,
  WORK_MODE.CASUAL_LEAVE,
  WORK_MODE.UNPAID_LEAVE,
  WORK_MODE.HALF_DAY_PAID_LEAVE,
  WORK_MODE.HALF_DAY_UNPAID_LEAVE,
  WORK_MODE.PUBLIC_HOLIDAY,
  WORK_MODE.WEEKEND_HOLIDAY,
  WORK_MODE.FULL_DAY_ONSITE,
  WORK_MODE.HALF_DAY_LEAVE,
  WORK_MODE.SL,
] as const;

export type WorkMode = (typeof WORK_MODE_OPTIONS)[number];

/** Minimum characters for early leave reason on punch-out. */
export const EARLY_LEAVE_REASON_MIN_LENGTH = 10;

export const WORKING_STATUS = {
  SHORT: "Short Hours",
  COMPLETED: "Completed",
  OVERTIME: "Overtime",
  IN_PROGRESS: "In Progress",
  ABSENT: "Absent",
  ON_LEAVE: "On Leave",
  PENDING_REVIEW: "OT Approval Pending",
  OVERTIME_APPROVED: "Overtime Approved",
  OVERTIME_REJECTED: "Overtime Rejected",
  OVERTIME_REQUESTED: "Overtime Requested",
} as const;

export type WorkingStatus = (typeof WORKING_STATUS)[keyof typeof WORKING_STATUS];

export const CORRECTION_STATUS = {
  PENDING: "Pending",
  APPROVED: "Approved",
  REJECTED: "Rejected",
} as const;

export type CorrectionStatus = (typeof CORRECTION_STATUS)[keyof typeof CORRECTION_STATUS];

export const CORRECTION_FIELDS = ["punchIn", "punchOut", "breakStart", "breakEnd"] as const;

export type CorrectionField = (typeof CORRECTION_FIELDS)[number];

export const CORRECTION_SHEET_TITLE = "AttendanceCorrections";

export const CORRECTION_HEADERS = [
  "ID",
  "Employee ID",
  "Employee Name",
  "Attendance Spreadsheet ID",
  "Date",
  "Field",
  "Original Value",
  "Requested Value",
  "Reason",
  "Status",
  "Remarks",
  "Approved By",
  "Approved Date",
  "Created At",
] as const;

export const OVERTIME_APPROVAL = {
  NOT_CONSIDERED: "Not considered",
  PENDING: "Pending",
  ACCEPTED: "Accepted",
  REJECTED: "Rejected",
} as const;

export type OvertimeApprovalStatus = (typeof OVERTIME_APPROVAL)[keyof typeof OVERTIME_APPROVAL];

export const OVERTIME_REQUEST_STATUS = {
  PENDING: "Pending",
  APPROVED: "Approved",
  REJECTED: "Rejected",
} as const;

export type OvertimeRequestStatus =
  (typeof OVERTIME_REQUEST_STATUS)[keyof typeof OVERTIME_REQUEST_STATUS];

export const OVERTIME_REQUEST_SHEET_TITLE = "OvertimeRequests";

export const OVERTIME_REQUEST_HEADERS = [
  "ID",
  "Employee ID",
  "Employee Name",
  "Attendance Spreadsheet ID",
  "Date",
  "Overtime",
  "Comment",
  "Status",
  "Remarks",
  "Reviewed By",
  "Reviewed Date",
  "Created At",
] as const;
