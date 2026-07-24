export const SALARY_ADVANCE_STATUS = {
  ACTIVE: "Active",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
} as const;

export type SalaryAdvanceStatus =
  (typeof SALARY_ADVANCE_STATUS)[keyof typeof SALARY_ADVANCE_STATUS];

/** One month's repayment installment. */
export type SalaryAdvanceInstallment = {
  year: number;
  /** 1–12 */
  month: number;
  amount: number;
};

/**
 * UI schedule segments, e.g.
 * - [{ months: 5, amountPerMonth: 10000 }] for equal EMI
 * - [{ months: 4, amountPerMonth: 10000 }, { months: 2, amountPerMonth: 5000 }]
 */
export type SalaryAdvanceScheduleSegment = {
  months: number;
  amountPerMonth: number;
};

export type SalaryAdvance = {
  id: string;
  employeeSheetRow: number;
  employeeId: string;
  employeeName: string;
  totalAmount: number;
  reason: string;
  /** First deduction month (YYYY-MM). */
  startYear: number;
  startMonth: number;
  installments: SalaryAdvanceInstallment[];
  status: SalaryAdvanceStatus;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

export type CreateSalaryAdvanceInput = {
  employeeSheetRow: number;
  employeeId: string;
  employeeName: string;
  totalAmount: number;
  reason: string;
  startYear: number;
  startMonth: number;
  segments: SalaryAdvanceScheduleSegment[];
  /** lastIncrementDate || joiningDate used for window check */
  lastIncrementDate: string;
  joiningDate: string;
  createdBy: string;
};

/** Reschedule remaining (current + future) installments; past months stay locked. */
export type UpdateSalaryAdvanceInput = {
  id: string;
  reason: string;
  startYear: number;
  startMonth: number;
  segments: SalaryAdvanceScheduleSegment[];
  lastIncrementDate: string;
  joiningDate: string;
};
