import { randomUUID } from "node:crypto";

import {
  ATTENDANCE_COL,
  CORRECTION_HEADERS,
  CORRECTION_SHEET_TITLE,
  CORRECTION_STATUS,
  type CorrectionField,
  type CorrectionStatus,
} from "@/lib/attendance/constants";
import type { AttendanceEmployeeContext } from "@/lib/attendance/employee";
import { updateAttendanceField } from "@/lib/google/attendance-sheets";
import { sheets } from "@/lib/google/auth";
import { applySheetHeaderFormatByTitle } from "@/lib/google/sheet-format";
import { readSheet } from "@/lib/google/sheets";

const masterSpreadsheetId = process.env.GOOGLE_SHEET_ID as string;

export type CorrectionRequest = {
  id: string;
  employeeId: string;
  employeeName: string;
  attendanceSpreadsheetId: string;
  date: string;
  field: CorrectionField;
  originalValue: string;
  requestedValue: string;
  reason: string;
  status: CorrectionStatus;
  remarks: string;
  approvedBy: string;
  approvedDate: string;
  createdAt: string;
  sheetRow: number;
};

const COL = {
  id: 0,
  employeeId: 1,
  employeeName: 2,
  attendanceSpreadsheetId: 3,
  date: 4,
  field: 5,
  originalValue: 6,
  requestedValue: 7,
  reason: 8,
  status: 9,
  remarks: 10,
  approvedBy: 11,
  approvedDate: 12,
  createdAt: 13,
} as const;

function rowToCorrection(row: string[], sheetRow: number): CorrectionRequest {
  return {
    id: row[COL.id] ?? "",
    employeeId: row[COL.employeeId] ?? "",
    employeeName: row[COL.employeeName] ?? "",
    attendanceSpreadsheetId: row[COL.attendanceSpreadsheetId] ?? "",
    date: row[COL.date] ?? "",
    field: row[COL.field] as CorrectionField,
    originalValue: row[COL.originalValue] ?? "",
    requestedValue: row[COL.requestedValue] ?? "",
    reason: row[COL.reason] ?? "",
    status: (row[COL.status] ?? CORRECTION_STATUS.PENDING) as CorrectionStatus,
    remarks: row[COL.remarks] ?? "",
    approvedBy: row[COL.approvedBy] ?? "",
    approvedDate: row[COL.approvedDate] ?? "",
    createdAt: row[COL.createdAt] ?? "",
    sheetRow,
  };
}

async function ensureCorrectionSheet(): Promise<void> {
  const meta = await sheets.spreadsheets.get({
    spreadsheetId: masterSpreadsheetId,
    fields: "sheets.properties.title",
  });

  const exists = meta.data.sheets?.some((s) => s.properties?.title === CORRECTION_SHEET_TITLE);

  if (exists) {
    await applySheetHeaderFormatByTitle(
      masterSpreadsheetId,
      CORRECTION_SHEET_TITLE,
      CORRECTION_HEADERS.length,
    );
    return;
  }

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: masterSpreadsheetId,
    requestBody: {
      requests: [
        {
          addSheet: {
            properties: { title: CORRECTION_SHEET_TITLE },
          },
        },
      ],
    },
  });

  await sheets.spreadsheets.values.update({
    spreadsheetId: masterSpreadsheetId,
    range: `'${CORRECTION_SHEET_TITLE}'!A1:N1`,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [CORRECTION_HEADERS as unknown as string[]],
    },
  });

  await applySheetHeaderFormatByTitle(
    masterSpreadsheetId,
    CORRECTION_SHEET_TITLE,
    CORRECTION_HEADERS.length,
  );
}

async function readCorrections(): Promise<CorrectionRequest[]> {
  await ensureCorrectionSheet();
  const rows = await readSheet(`'${CORRECTION_SHEET_TITLE}'!A:N`);
  const results: CorrectionRequest[] = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i] ?? [];
    if (!(row[COL.id] ?? "").trim()) continue;
    results.push(rowToCorrection(row, i + 1));
  }

  return results;
}

export async function listCorrectionRequests(options: {
  employeeId?: string;
}): Promise<CorrectionRequest[]> {
  const all = await readCorrections();
  if (!options.employeeId) return all;
  return all.filter((r) => r.employeeId === options.employeeId);
}

export async function createCorrectionRequest(params: {
  employee: AttendanceEmployeeContext;
  date: string;
  field: CorrectionField;
  originalValue: string;
  requestedValue: string;
  reason: string;
}): Promise<CorrectionRequest> {
  await ensureCorrectionSheet();

  const id = randomUUID();
  const createdAt = new Date().toISOString();

  const row = [
    id,
    params.employee.employeeId,
    params.employee.employeeName,
    params.employee.attendanceSpreadsheetId,
    params.date,
    params.field,
    params.originalValue,
    params.requestedValue,
    params.reason,
    CORRECTION_STATUS.PENDING,
    "",
    "",
    "",
    createdAt,
  ];

  await sheets.spreadsheets.values.append({
    spreadsheetId: masterSpreadsheetId,
    range: `'${CORRECTION_SHEET_TITLE}'!A:N`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [row] },
  });

  return {
    id,
    employeeId: params.employee.employeeId,
    employeeName: params.employee.employeeName,
    attendanceSpreadsheetId: params.employee.attendanceSpreadsheetId,
    date: params.date,
    field: params.field,
    originalValue: params.originalValue,
    requestedValue: params.requestedValue,
    reason: params.reason,
    status: CORRECTION_STATUS.PENDING,
    remarks: "",
    approvedBy: "",
    approvedDate: "",
    createdAt,
    sheetRow: 0,
  };
}

const fieldToColumn: Record<CorrectionField, keyof typeof ATTENDANCE_COL> = {
  punchIn: "punchIn",
  punchOut: "punchOut",
  breakStart: "breakStart",
  breakEnd: "breakEnd",
};

export async function reviewCorrectionRequest(params: {
  id: string;
  status: typeof CORRECTION_STATUS.APPROVED | typeof CORRECTION_STATUS.REJECTED;
  remarks?: string;
  reviewerName: string;
}): Promise<CorrectionRequest> {
  const all = await readCorrections();
  const request = all.find((r) => r.id === params.id);

  if (!request) {
    throw new Error("Correction request not found");
  }
  if (request.status !== CORRECTION_STATUS.PENDING) {
    throw new Error("Correction request already reviewed");
  }

  const approvedDate = new Date().toISOString();
  const row = [
    request.id,
    request.employeeId,
    request.employeeName,
    request.attendanceSpreadsheetId,
    request.date,
    request.field,
    request.originalValue,
    request.requestedValue,
    request.reason,
    params.status,
    params.remarks ?? "",
    params.reviewerName,
    approvedDate,
    request.createdAt,
  ];

  await sheets.spreadsheets.values.update({
    spreadsheetId: masterSpreadsheetId,
    range: `'${CORRECTION_SHEET_TITLE}'!A${request.sheetRow}:N${request.sheetRow}`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [row] },
  });

  if (params.status === CORRECTION_STATUS.APPROVED) {
    await updateAttendanceField(
      request.attendanceSpreadsheetId,
      request.date,
      fieldToColumn[request.field],
      request.requestedValue,
    );
  }

  return {
    ...request,
    status: params.status,
    remarks: params.remarks ?? "",
    approvedBy: params.reviewerName,
    approvedDate,
  };
}
