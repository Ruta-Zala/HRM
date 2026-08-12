import type { CorrectionField } from "@/lib/attendance/constants";
import type { AttendanceEmployeeContext } from "@/lib/attendance/employee";
import { CORRECTION_STATUS } from "@/lib/attendance/constants";
import { isFirebaseDailyStorage } from "@/lib/storage/backend";

import {
  createCorrectionRequestFirestore,
  listCorrectionRequestsFirestore,
  reviewCorrectionRequestFirestore,
} from "./firestore";
import {
  createCorrectionRequestSheets,
  listCorrectionRequestsSheets,
  reviewCorrectionRequestSheets,
} from "./sheets";

export type { CorrectionRequest } from "./types";

export async function listCorrectionRequests(options: { employeeId?: string }) {
  if (isFirebaseDailyStorage()) {
    return listCorrectionRequestsFirestore(options);
  }
  return listCorrectionRequestsSheets(options);
}

export async function createCorrectionRequest(params: {
  employee: AttendanceEmployeeContext;
  date: string;
  field: CorrectionField;
  originalValue: string;
  requestedValue: string;
  reason: string;
}) {
  if (isFirebaseDailyStorage()) {
    return createCorrectionRequestFirestore(params);
  }
  return createCorrectionRequestSheets(params);
}

export async function reviewCorrectionRequest(params: {
  id: string;
  status: typeof CORRECTION_STATUS.APPROVED | typeof CORRECTION_STATUS.REJECTED;
  remarks?: string;
  reviewerName: string;
}) {
  if (isFirebaseDailyStorage()) {
    return reviewCorrectionRequestFirestore(params);
  }
  return reviewCorrectionRequestSheets(params);
}
