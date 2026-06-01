export type TodayAttendance = {
  date: string;
  workMode?: string;
  punchIn: string;
  punchOut: string;
  breakStart: string;
  breakEnd: string;
  totalBreakTime: string;
  workingHours: string;
  overtime: string;
  status: string;
  onBreak: boolean;
  hasPunchedIn: boolean;
  hasPunchedOut: boolean;
  workedMs: number;
  workedFormatted: string;
  workedShort: string;
  idealHours: number;
  idealBreakHours: number;
  idealShiftHours: number;
  remainingMs: number;
  remainingFormatted: string;
  breakAllowanceFormatted: string;
  earlyLeaveReason?: string;
  dailyUpdate?: string;
};

export type AttendanceHistoryRow = {
  id: string;
  date: string;
  workMode?: string;
  punchIn: string;
  punchOut: string;
  breakTime: string;
  workingHours: string;
  overtime: string;
  status: string;
  overtimeApproval?: string;
  earlyLeaveReason?: string;
  dailyUpdate?: string;
};

export type AttendancePeriod = {
  year: number;
  months: { month: number; label: string }[];
};

export type CorrectionRequestDto = {
  id: string;
  employeeId: string;
  employeeName: string;
  date: string;
  field: string;
  originalValue: string;
  requestedValue: string;
  reason: string;
  status: string;
  remarks: string;
  approvedBy: string;
  approvedDate: string;
  createdAt: string;
};

export type OvertimeRequestDto = {
  id: string;
  employeeId: string;
  employeeName: string;
  attendanceSpreadsheetId: string;
  date: string;
  overtime: string;
  comment: string;
  status: "Pending" | "Approved" | "Rejected";
  remarks: string;
  reviewedBy: string;
  reviewedDate: string;
  createdAt: string;
};

export async function fetchTodayAttendance(): Promise<TodayAttendance | null> {
  const res = await fetch("/api/attendance", { credentials: "include" });
  const data = await res.json();
  if (!data.success) throw new Error(data.message ?? "Failed to load attendance");
  return data.today ?? null;
}

export type AttendanceActionPayload = {
  earlyLeaveReason?: string;
  dailyUpdate?: string;
  workMode?: string;
};

export async function postAttendanceAction(
  action: "punch-in" | "punch-out" | "break-start" | "break-end",
  payload?: AttendanceActionPayload,
): Promise<TodayAttendance> {
  const res = await fetch("/api/attendance", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, ...payload }),
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.message ?? "Action failed");

  const record = data.record;
  return {
    date: record.date || new Date().toISOString().slice(0, 10),
    workMode: record.workMode ?? "",
    punchIn: record.punchIn,
    punchOut: record.punchOut,
    breakStart: record.breakStart,
    breakEnd: record.breakEnd,
    totalBreakTime: record.totalBreakTime,
    workingHours: record.workingHours,
    overtime: record.overtime ?? "—",
    status: record.status,
    onBreak: record.onBreak,
    hasPunchedIn: record.hasPunchedIn,
    hasPunchedOut: record.hasPunchedOut,
    workedMs: record.workedMs,
    workedFormatted: record.workedFormatted,
    workedShort: record.workedFormatted,
    idealHours: record.idealHours ?? 8,
    idealBreakHours: record.idealBreakHours ?? 1,
    idealShiftHours: record.idealShiftHours ?? 9,
    remainingMs: Math.max(0, (record.idealHours ?? 8) * 60 * 60 * 1000 - record.workedMs),
    remainingFormatted: "",
    breakAllowanceFormatted: record.breakAllowanceFormatted ?? "0h / 1h",
    earlyLeaveReason: record.earlyLeaveReason ?? "",
    dailyUpdate: record.dailyUpdate ?? "",
  };
}

export async function updateDailyUpdate(
  date: string,
  dailyUpdate: string,
): Promise<TodayAttendance> {
  const res = await fetch("/api/attendance", {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ date, dailyUpdate }),
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.message ?? "Failed to update daily update");

  const record = data.record;
  return {
    date: record.date || date,
    workMode: record.workMode ?? "",
    punchIn: record.punchIn,
    punchOut: record.punchOut,
    breakStart: record.breakStart,
    breakEnd: record.breakEnd,
    totalBreakTime: record.totalBreakTime,
    workingHours: record.workingHours,
    overtime: record.overtime ?? "—",
    status: record.status,
    onBreak: record.onBreak,
    hasPunchedIn: record.hasPunchedIn,
    hasPunchedOut: record.hasPunchedOut,
    workedMs: record.workedMs,
    workedFormatted: record.workedFormatted,
    workedShort: record.workedFormatted,
    idealHours: record.idealHours ?? 8,
    idealBreakHours: record.idealBreakHours ?? 1,
    idealShiftHours: record.idealShiftHours ?? 9,
    remainingMs: Math.max(0, (record.idealHours ?? 8) * 60 * 60 * 1000 - record.workedMs),
    remainingFormatted: "",
    breakAllowanceFormatted: record.breakAllowanceFormatted ?? "0h / 1h",
    earlyLeaveReason: record.earlyLeaveReason ?? "",
    dailyUpdate: record.dailyUpdate ?? "",
  };
}

function attendanceSearchParams(base: Record<string, string>, employeeSheetRow?: number): string {
  const params = new URLSearchParams(base);
  if (employeeSheetRow != null) {
    params.set("employeeSheetRow", String(employeeSheetRow));
  }
  return params.toString();
}

export async function fetchAttendancePeriods(
  employeeSheetRow?: number,
): Promise<AttendancePeriod[]> {
  const res = await fetch(
    `/api/attendance?${attendanceSearchParams({ mode: "periods" }, employeeSheetRow)}`,
    { credentials: "include" },
  );
  const data = await res.json();
  if (!data.success) throw new Error(data.message ?? "Failed to load periods");
  return data.periods ?? [];
}

export async function fetchAttendanceHistory(
  year: number,
  month: number,
  employeeSheetRow?: number,
): Promise<AttendanceHistoryRow[]> {
  const res = await fetch(
    `/api/attendance?${attendanceSearchParams({ year: String(year), month: String(month) }, employeeSheetRow)}`,
    { credentials: "include" },
  );
  const data = await res.json();
  if (!data.success) throw new Error(data.message ?? "Failed to load history");
  return data.records ?? [];
}

export async function submitCorrectionRequest(body: {
  field: string;
  requestedTime: string;
  reason: string;
  date?: string;
}): Promise<void> {
  const res = await fetch("/api/attendance/corrections", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.message ?? "Failed to submit correction");
}

export async function fetchCorrectionRequests(): Promise<CorrectionRequestDto[]> {
  const res = await fetch("/api/attendance/corrections", { credentials: "include" });
  const data = await res.json();
  if (!data.success) throw new Error(data.message ?? "Failed to load corrections");
  return data.requests ?? [];
}

export type ImportAttendanceResult = {
  message: string;
  imported: number;
  updated: number;
  holidaysSkipped: number;
  errors: string[];
  employee?: {
    employeeId: string;
    employeeName: string;
  };
};

export async function importAttendanceCsv(
  file: File,
  employeeSheetRow: number,
): Promise<ImportAttendanceResult> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("employeeSheetRow", String(employeeSheetRow));

  const res = await fetch("/api/attendance/import", {
    method: "POST",
    credentials: "include",
    body: formData,
  });
  const data = await res.json();
  if (!data.success) {
    throw new Error(
      data.errors?.length
        ? `${data.message}: ${data.errors.join("; ")}`
        : (data.message ?? "Import failed"),
    );
  }
  return {
    message: data.message,
    imported: data.imported,
    updated: data.updated,
    holidaysSkipped: data.holidaysSkipped ?? 0,
    errors: data.errors ?? [],
    employee: data.employee,
  };
}

export async function reviewCorrection(
  id: string,
  status: "Approved" | "Rejected",
  remarks?: string,
): Promise<void> {
  const res = await fetch("/api/attendance/corrections", {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, status, remarks }),
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.message ?? "Failed to review correction");
}

export async function submitOvertimeRequest(body: {
  date: string;
  comment?: string;
  employeeSheetRow?: number;
}): Promise<void> {
  const res = await fetch("/api/attendance/overtime-requests", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.message ?? "Failed to submit overtime request");
}

export async function fetchOvertimeRequests(): Promise<OvertimeRequestDto[]> {
  const res = await fetch("/api/attendance/overtime-requests", { credentials: "include" });
  const data = await res.json();
  if (!data.success) throw new Error(data.message ?? "Failed to load overtime requests");
  return data.requests ?? [];
}

export async function reviewOvertimeRequest(
  id: string,
  status: "Approved" | "Rejected",
  remarks?: string,
): Promise<void> {
  const res = await fetch("/api/attendance/overtime-requests", {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, status, remarks }),
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.message ?? "Failed to review overtime request");
}
