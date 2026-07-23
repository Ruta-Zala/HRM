/** Fixed payroll deduction: 10% of monthly salary. */
export const DEFAULT_LOYALTY_PERCENT = 10;

/** Fixed professional tax per employee per month (Rs.). */
export const DEFAULT_PROFESSIONAL_TAX = 200;

/** Fixed labour welfare fund per employee per month (Rs.). */
export const DEFAULT_LWF = 6;

/** Standard working hours in a full day. */
export const HOURS_PER_DAY = 8;

/**
 * Attendance day codes used in the HR salary sheet.
 * P = Present (full day)
 * A = Full day paid leave
 * H = Half paid leave
 * U = Half unpaid leave
 * F = Full unpaid leave
 */
export const PAYROLL_DAY_CODE = {
  PRESENT: "P",
  PAID_FULL: "A",
  PAID_HALF: "H",
  UNPAID_HALF: "U",
  UNPAID_FULL: "F",
} as const;

export type PayrollDayCode = (typeof PAYROLL_DAY_CODE)[keyof typeof PAYROLL_DAY_CODE];
