import type { CorrectionField, CorrectionStatus } from "@/lib/attendance/constants";

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
