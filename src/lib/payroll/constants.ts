/** Fixed payroll deduction: 10% of monthly salary. */
export const DEFAULT_LOYALTY_PERCENT = 10;

/** Fixed professional tax per employee per month (Rs.). */
export const DEFAULT_PROFESSIONAL_TAX = 200;

/** Fixed labour welfare fund per employee per month (Rs.). */
export const DEFAULT_LWF = 6;

/** Standard working hours in a full day. */
export const HOURS_PER_DAY = 8;

/**
 * Attendance day codes used in payroll / salary sheet.
 *
 * P = Full Day Onsite (present)
 * A = Paid Leave
 * H = Half Day Paid Leave
 * U = Half Day Unpaid Leave
 * F = Unpaid Leave
 */
export const PAYROLL_DAY_CODE = {
  PRESENT: "P",
  PAID_FULL: "A",
  PAID_HALF: "H",
  UNPAID_HALF: "U",
  UNPAID_FULL: "F",
} as const;

export type PayrollDayCode = (typeof PAYROLL_DAY_CODE)[keyof typeof PAYROLL_DAY_CODE];

/** Short human labels for each payroll day code. */
export const PAYROLL_DAY_CODE_LABEL: Record<PayrollDayCode, string> = {
  [PAYROLL_DAY_CODE.PRESENT]: "Full Day Onsite / Present",
  [PAYROLL_DAY_CODE.PAID_FULL]: "Paid Leave",
  [PAYROLL_DAY_CODE.PAID_HALF]: "Half Day Paid Leave",
  [PAYROLL_DAY_CODE.UNPAID_HALF]: "Half Day Unpaid Leave",
  [PAYROLL_DAY_CODE.UNPAID_FULL]: "Unpaid Leave",
};

/** Legend rows for payroll UI: code → meaning. */
export const PAYROLL_DAY_CODE_LEGEND: Array<{ code: PayrollDayCode; label: string }> = [
  { code: PAYROLL_DAY_CODE.PRESENT, label: "Full Day Onsite" },
  { code: PAYROLL_DAY_CODE.PAID_FULL, label: "Paid Leave" },
  { code: PAYROLL_DAY_CODE.PAID_HALF, label: "Half Day Paid Leave" },
  { code: PAYROLL_DAY_CODE.UNPAID_HALF, label: "Half Day Unpaid Leave" },
  { code: PAYROLL_DAY_CODE.UNPAID_FULL, label: "Unpaid Leave" },
];
