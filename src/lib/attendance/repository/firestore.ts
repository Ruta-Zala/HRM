import {
  EARLY_LEAVE_REASON_MIN_LENGTH,
  OVERTIME_APPROVAL,
  WORK_MODE,
  WORKING_STATUS,
  isHalfDayUnpaidWorkMode,
} from "@/lib/attendance/constants";
import {
  computeAttendanceMetrics,
  formatClockTime,
  formatDuration,
  formatIsoDate,
  monthlySheetTitle,
  normalizeSheetDate,
  parseDurationToMs,
  parseTimeOnDate,
} from "@/lib/attendance/time";
import type { AttendanceRow } from "@/lib/google/attendance-sheets";
import { getAdminFirestore } from "@/lib/firebase/admin";

import type { AttendanceRepository, AttendanceStorageRef } from "./types";

const COLLECTION = "attendance";

type DayFields = Omit<AttendanceRow, "sheetRow">;

function resolveAttendanceStatus(
  baseStatus: string,
  overtimeApproval: string,
  overtimeValue: string,
): string {
  const approval = overtimeApproval.trim();
  const overtime = overtimeValue.trim();
  const hasPositiveOvertime =
    overtime.length > 0 && overtime !== "—" && !overtime.startsWith("-") && /\d/.test(overtime);

  if (!hasPositiveOvertime) return baseStatus;

  if (approval === OVERTIME_APPROVAL.PENDING) return WORKING_STATUS.OVERTIME_REQUESTED;
  if (approval === OVERTIME_APPROVAL.ACCEPTED) return WORKING_STATUS.OVERTIME_APPROVED;
  if (approval === OVERTIME_APPROVAL.REJECTED) return WORKING_STATUS.OVERTIME_REJECTED;
  return baseStatus;
}

function emptyDay(date: Date): DayFields {
  return {
    date: formatIsoDate(date),
    workMode: WORK_MODE.FULL_DAY_ONSITE,
    punchIn: "",
    punchOut: "",
    breakStart: "",
    breakEnd: "",
    totalBreakTime: "",
    workingHours: "",
    status: WORKING_STATUS.IN_PROGRESS,
    overtime: "—",
    earlyLeaveReason: "",
    dailyUpdate: "",
    isOvertimeApproved: OVERTIME_APPROVAL.NOT_CONSIDERED,
  };
}

function toAttendanceRow(fields: DayFields): AttendanceRow {
  const dateStr = normalizeSheetDate(fields.date);
  const baseDate = dateStr ? new Date(dateStr) : new Date();
  const punchedOut = Boolean(fields.punchOut.trim());
  const metrics = computeAttendanceMetrics({
    punchIn: fields.punchIn,
    punchOut: fields.punchOut,
    totalBreakTime: fields.totalBreakTime,
    baseDate,
    punchedOut,
    workMode: fields.workMode,
  });

  return {
    sheetRow: 0,
    date: dateStr,
    workMode: fields.workMode,
    punchIn: fields.punchIn,
    punchOut: fields.punchOut,
    breakStart: fields.breakStart,
    breakEnd: fields.breakEnd,
    totalBreakTime: fields.totalBreakTime,
    workingHours: punchedOut ? metrics.workingHours : fields.workingHours,
    status: punchedOut
      ? resolveAttendanceStatus(metrics.status, fields.isOvertimeApproved, metrics.overtime)
      : fields.status,
    overtime: punchedOut ? metrics.overtime : fields.overtime,
    earlyLeaveReason: fields.earlyLeaveReason,
    dailyUpdate: fields.dailyUpdate,
    isOvertimeApproved: fields.isOvertimeApproved,
  };
}

function applyPunchOutMetrics(fields: DayFields, baseDate: Date): void {
  const metrics = computeAttendanceMetrics({
    punchIn: fields.punchIn,
    punchOut: fields.punchOut,
    totalBreakTime: fields.totalBreakTime,
    baseDate,
    punchedOut: true,
    workMode: fields.workMode,
  });
  fields.workingHours = metrics.workingHours;
  fields.overtime = metrics.overtime;
  fields.status = resolveAttendanceStatus(
    metrics.status,
    fields.isOvertimeApproved,
    metrics.overtime,
  );
}

function daysCollection(employeeId: string) {
  return getAdminFirestore().collection(COLLECTION).doc(employeeId).collection("days");
}

async function getDayFields(ref: AttendanceStorageRef, dateIso: string): Promise<DayFields | null> {
  const snap = await daysCollection(ref.employeeId).doc(dateIso).get();
  if (!snap.exists) return null;
  const data = snap.data() as Partial<DayFields>;
  return {
    ...emptyDay(new Date(`${dateIso}T12:00:00`)),
    ...data,
    date: normalizeSheetDate(String(data.date ?? dateIso)),
  };
}

async function saveDayFields(ref: AttendanceStorageRef, fields: DayFields): Promise<AttendanceRow> {
  const dateIso = normalizeSheetDate(fields.date);
  await daysCollection(ref.employeeId).doc(dateIso).set(fields, { merge: true });
  return toAttendanceRow({ ...fields, date: dateIso });
}

async function getOrCreateDayFields(ref: AttendanceStorageRef, date: Date): Promise<DayFields> {
  const dateIso = formatIsoDate(date);
  const existing = await getDayFields(ref, dateIso);
  return existing ?? emptyDay(date);
}

export const firestoreAttendanceRepository: AttendanceRepository = {
  async getTodayAttendance(ref, date = new Date()) {
    const fields = await getDayFields(ref, formatIsoDate(date));
    if (!fields || !fields.punchIn.trim()) return null;
    return toAttendanceRow(fields);
  },

  async getMonthAttendance(ref, year, monthIndex) {
    const start = formatIsoDate(new Date(year, monthIndex, 1));
    const end = formatIsoDate(new Date(year, monthIndex + 1, 0));
    const snap = await daysCollection(ref.employeeId)
      .where("date", ">=", start)
      .where("date", "<=", end)
      .get();

    const records: AttendanceRow[] = [];
    for (const doc of snap.docs) {
      const data = doc.data() as Partial<DayFields>;
      if (!String(data.date ?? doc.id).trim()) continue;
      records.push(toAttendanceRow({ ...emptyDay(new Date(`${doc.id}T12:00:00`)), ...data }));
    }
    return records.sort((a, b) => a.date.localeCompare(b.date));
  },

  async listMonthlySheetsAcrossYears(ref) {
    const snap = await daysCollection(ref.employeeId).select("date").get();
    const unique = new Set<string>();
    for (const doc of snap.docs) {
      const dateIso = normalizeSheetDate(String(doc.data().date ?? doc.id));
      if (!dateIso) continue;
      const parsed = new Date(`${dateIso}T12:00:00`);
      unique.add(monthlySheetTitle(parsed));
    }
    return [...unique];
  },

  async punchIn(ref, date = new Date(), options) {
    const fields = await getOrCreateDayFields(ref, date);
    if (fields.punchIn.trim()) {
      throw new Error("Already punched in today");
    }

    fields.workMode = options?.workMode?.trim() || fields.workMode || WORK_MODE.FULL_DAY_ONSITE;
    fields.punchIn = formatClockTime(date);
    fields.punchOut = "";
    fields.breakStart = "";
    fields.breakEnd = "";
    fields.totalBreakTime = "";
    fields.workingHours = "";
    fields.overtime = "—";
    fields.status = WORKING_STATUS.IN_PROGRESS;

    return saveDayFields(ref, fields);
  },

  async punchOut(ref, date = new Date(), options) {
    const fields = await getOrCreateDayFields(ref, date);
    if (!fields.punchIn.trim()) {
      throw new Error("Punch in first before punching out");
    }
    if (fields.punchOut.trim()) {
      throw new Error("Already punched out today");
    }
    if (fields.breakStart.trim() && !fields.breakEnd.trim()) {
      throw new Error("End your break before punching out");
    }

    fields.punchOut = formatClockTime(date);
    applyPunchOutMetrics(fields, date);

    if (fields.status === WORKING_STATUS.SHORT) {
      const reason = options?.earlyLeaveReason?.trim() ?? "";
      if (!reason) {
        throw new Error("Please provide a reason for leaving early");
      }
      if (reason.length < EARLY_LEAVE_REASON_MIN_LENGTH) {
        throw new Error(
          `Early leave reason must be at least ${EARLY_LEAVE_REASON_MIN_LENGTH} characters`,
        );
      }
      fields.earlyLeaveReason = reason;
    } else {
      fields.earlyLeaveReason = "";
    }
    fields.dailyUpdate = options?.dailyUpdate?.trim() ?? "";

    return saveDayFields(ref, fields);
  },

  async startBreak(ref, date = new Date()) {
    const fields = await getOrCreateDayFields(ref, date);
    if (!fields.punchIn.trim()) {
      throw new Error("Punch in first before starting a break");
    }
    if (fields.punchOut.trim()) {
      throw new Error("Cannot start a break after punch out");
    }
    if (isHalfDayUnpaidWorkMode(fields.workMode)) {
      throw new Error("Break is not allowed for Half Day Unpaid Leave");
    }
    if (fields.breakStart.trim() && !fields.breakEnd.trim()) {
      throw new Error("Already on break");
    }

    fields.breakStart = formatClockTime(date);
    fields.breakEnd = "";

    return saveDayFields(ref, fields);
  },

  async endBreak(ref, date = new Date()) {
    const fields = await getOrCreateDayFields(ref, date);
    if (!fields.breakStart.trim() || fields.breakEnd.trim()) {
      throw new Error("No active break to end");
    }

    const breakEnd = formatClockTime(date);
    const breakStartMs = parseTimeOnDate(fields.breakStart, date);
    const breakEndMs = parseTimeOnDate(breakEnd, date);
    const breakMs =
      breakStartMs != null && breakEndMs != null && breakEndMs > breakStartMs
        ? breakEndMs - breakStartMs
        : 0;

    const existingBreakMs = parseDurationToMs(fields.totalBreakTime);
    fields.totalBreakTime = formatDuration(existingBreakMs + breakMs);
    fields.breakStart = "";
    fields.breakEnd = "";

    return saveDayFields(ref, fields);
  },

  async updateDailyUpdate(ref, dateIso, dailyUpdate) {
    const normalized = normalizeSheetDate(dateIso);
    if (!normalized) {
      throw new Error("Date is required for daily update");
    }
    const fields = await getOrCreateDayFields(ref, new Date(`${normalized}T12:00:00`));
    fields.dailyUpdate = dailyUpdate.trim();
    return saveDayFields(ref, fields);
  },
};
