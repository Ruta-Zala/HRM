import { randomUUID } from "node:crypto";

import {
  CORRECTION_STATUS,
  type CorrectionField,
  type CorrectionStatus,
} from "@/lib/attendance/constants";
import type { AttendanceEmployeeContext } from "@/lib/attendance/employee";
import { getAttendanceRepository } from "@/lib/attendance/repository";
import { getAdminFirestore } from "@/lib/firebase/admin";

import type { CorrectionRequest } from "./types";

const COLLECTION = "attendance_corrections";

function correctionsCollection() {
  return getAdminFirestore().collection(COLLECTION);
}

function docToCorrection(id: string, data: Record<string, unknown>): CorrectionRequest | null {
  const employeeId = String(data.employeeId ?? "").trim();
  if (!employeeId) return null;

  return {
    id,
    employeeId,
    employeeName: String(data.employeeName ?? "").trim(),
    attendanceSpreadsheetId: String(data.attendanceSpreadsheetId ?? "").trim(),
    date: String(data.date ?? "").trim(),
    field: String(data.field ?? "").trim() as CorrectionField,
    originalValue: String(data.originalValue ?? ""),
    requestedValue: String(data.requestedValue ?? ""),
    reason: String(data.reason ?? ""),
    status: (String(data.status ?? CORRECTION_STATUS.PENDING).trim() ||
      CORRECTION_STATUS.PENDING) as CorrectionStatus,
    remarks: String(data.remarks ?? ""),
    approvedBy: String(data.approvedBy ?? ""),
    approvedDate: String(data.approvedDate ?? ""),
    createdAt: String(data.createdAt ?? ""),
    sheetRow: 0,
  };
}

export async function listCorrectionRequestsFirestore(options: {
  employeeId?: string;
}): Promise<CorrectionRequest[]> {
  const snap = options.employeeId
    ? await correctionsCollection().where("employeeId", "==", options.employeeId).get()
    : await correctionsCollection().get();

  return snap.docs
    .map((doc) => docToCorrection(doc.id, doc.data() as Record<string, unknown>))
    .filter((row): row is CorrectionRequest => Boolean(row))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function createCorrectionRequestFirestore(params: {
  employee: AttendanceEmployeeContext;
  date: string;
  field: CorrectionField;
  originalValue: string;
  requestedValue: string;
  reason: string;
}): Promise<CorrectionRequest> {
  const id = randomUUID();
  const createdAt = new Date().toISOString();
  const request: CorrectionRequest = {
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

  await correctionsCollection().doc(id).set(request);
  return request;
}

export async function reviewCorrectionRequestFirestore(params: {
  id: string;
  status: typeof CORRECTION_STATUS.APPROVED | typeof CORRECTION_STATUS.REJECTED;
  remarks?: string;
  reviewerName: string;
}): Promise<CorrectionRequest> {
  const ref = correctionsCollection().doc(params.id);
  const snap = await ref.get();
  if (!snap.exists) {
    throw new Error("Correction request not found");
  }

  const request = docToCorrection(snap.id, snap.data() as Record<string, unknown>);
  if (!request) {
    throw new Error("Correction request not found");
  }
  if (request.status !== CORRECTION_STATUS.PENDING) {
    throw new Error("Correction request already reviewed");
  }

  const approvedDate = new Date().toISOString();
  const updated: CorrectionRequest = {
    ...request,
    status: params.status,
    remarks: params.remarks ?? "",
    approvedBy: params.reviewerName,
    approvedDate,
  };

  await ref.set(updated);

  if (params.status === CORRECTION_STATUS.APPROVED) {
    await getAttendanceRepository().updateAttendanceField(
      {
        employeeId: request.employeeId,
        spreadsheetId: request.attendanceSpreadsheetId,
      },
      request.date,
      request.field,
      request.requestedValue,
    );
  }

  return updated;
}
