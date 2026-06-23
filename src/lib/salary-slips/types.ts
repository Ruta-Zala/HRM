export const SALARY_HISTORY_SHEET_NAME = "SalaryHistory";
export const SALARY_SLIPS_SHEET_NAME = "SalarySlips";

export type SalaryHistoryRecord = {
  sheetRow: number;
  employeeSheetRow: number;
  employeeName: string;
  effectiveFrom: string;
  effectiveTo: string;
  basic: number;
  loyaltyBonus: number;
  professionalTax: number;
  status: "Active" | "Inactive";
  createdAt: string;
  updatedAt: string;
};

export type SalarySlipStatus = "Draft" | "Released" | "Deleted";

export type SalarySlipRecord = {
  sheetRow: number;
  slipId: string;
  employeeSheetRow: number;
  employeeName: string;
  year: number;
  month: number;
  title: string;
  workingDays: number;
  netPayableDays: number;
  basic: number;
  totalEarnings: number;
  loyaltyBonus: number;
  professionalTax: number;
  totalDeductions: number;
  netPay: number;
  amountInWords: string;
  status: SalarySlipStatus;
  driveFileId: string;
  driveFileName: string;
  driveParentFolderId: string;
  createdAt: string;
  releasedAt: string;
  deletedAt: string;
};

export type SalaryBreakdownInput = {
  basic: number;
  loyaltyBonus: number; // percentage (5/10/15/20)
  professionalTax: number;
  workingDays: number;
  netPayableDays: number;
};
