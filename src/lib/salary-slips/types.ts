export const SALARY_HISTORY_SHEET_NAME = "SalaryHistory";
export const SALARY_SLIPS_SHEET_NAME = "SalarySlips";

export type SalaryHistoryRecord = {
  sheetRow: number;
  employeeSheetRow: number;
  effectiveFrom: string;
  effectiveTo: string;
  basic: number;
  hra: number;
  organisationAllowance: number;
  loyaltyBonus: number;
  professionalTax: number;
  lwf: number;
  revisionNote: string;
  status: "Active" | "Inactive";
  createdAt: string;
  updatedAt: string;
};

export type SalarySlipStatus = "Draft" | "Released" | "Deleted";

export type SalarySlipRecord = {
  sheetRow: number;
  slipId: string;
  employeeSheetRow: number;
  year: number;
  month: number;
  title: string;
  workingDays: number;
  netPayableDays: number;
  basic: number;
  hra: number;
  organisationAllowance: number;
  totalEarnings: number;
  loyaltyBonus: number;
  professionalTax: number;
  lwf: number;
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
  hra: number;
  organisationAllowance: number;
  loyaltyBonus: number; // percentage (5/10/15/20)
  professionalTax: number;
  lwf: number;
  workingDays: number;
  netPayableDays: number;
};
