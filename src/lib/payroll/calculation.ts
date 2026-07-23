import {
  DEFAULT_LWF,
  DEFAULT_LOYALTY_PERCENT,
  DEFAULT_PROFESSIONAL_TAX,
  HOURS_PER_DAY,
} from "@/lib/payroll/constants";
import { summarizeAttendanceDays } from "@/lib/payroll/attendance-codes";

function round2(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100) / 100;
}

export type PayrollEmployeeInput = {
  monthlySalary: number;
  /** Loyalty deduction percentage of monthly salary (default 10). */
  loyaltyPercent?: number;
  professionalTax?: number;
  lwf?: number;
  workingDays: number;
  scheduledDates: string[];
  attendanceByDate: Map<string, { workMode?: string; status?: string }>;
};

export type PayrollEmployeeResult = {
  monthlySalary: number;
  workingDays: number;
  perDay: number;
  perHour: number;
  halfPaidLeave: number;
  fullPaidLeave: number;
  halfUnpaidLeave: number;
  fullUnpaidLeave: number;
  totalPaidLeave: number;
  totalUnpaidLeave: number;
  attendDays: number;
  paidLeaveAmount: number;
  unpaidLeaveAmount: number;
  /** Salary after unpaid attendance deduction (before fixed deductions). */
  amountAfterAttendance: number;
  loyaltyPercent: number;
  loyaltyBonus: number;
  professionalTax: number;
  lwf: number;
  totalFixedDeductions: number;
  finalPayment: number;
  dayCodes: Record<string, string>;
};

/**
 * Correct monthly salary flow:
 * 1. Fixed reference deductions from monthly salary:
 *    - loyaltyBonus = monthlySalary × 10%
 *    - professionalTax = Rs. 200
 *    - lwf = Rs. 6
 * 2. workingDays = company Mon–Fri excluding leave-type public holidays (not celebrations)
 * 3. perDay = monthlySalary / workingDays
 * 4. perHour = perDay / 8
 * 5. Attendance is evaluated only on the employee's employment dates in that month
 *    (after joining / before last working day). Unpaid leave reduces pay:
 *    amountAfterAttendance = (employmentWorkingDays − unpaidLeaveDays) × perDay
 *    For a full-month employee this equals monthlySalary − unpaidLeaveAmount.
 * 6. finalPayment = amountAfterAttendance − loyaltyBonus − PT − LWF
 *
 * Paid leave (A/H) does not reduce pay.
 */
export function calculateEmployeePayroll(input: PayrollEmployeeInput): PayrollEmployeeResult {
  const monthlySalary = Math.max(0, Number(input.monthlySalary) || 0);
  const workingDays = Math.max(0, Number(input.workingDays) || 0);
  const loyaltyPercent =
    input.loyaltyPercent != null && Number.isFinite(input.loyaltyPercent)
      ? Math.min(100, Math.max(0, input.loyaltyPercent))
      : DEFAULT_LOYALTY_PERCENT;
  const professionalTax =
    input.professionalTax != null && Number.isFinite(input.professionalTax)
      ? Math.max(0, input.professionalTax)
      : DEFAULT_PROFESSIONAL_TAX;
  const lwf =
    input.lwf != null && Number.isFinite(input.lwf) ? Math.max(0, input.lwf) : DEFAULT_LWF;

  // Step 1 — fixed deductions based on monthly salary
  const loyaltyBonus = round2((monthlySalary * loyaltyPercent) / 100);
  const pt = round2(professionalTax);
  const lwfAmount = round2(lwf);
  const totalFixedDeductions = round2(loyaltyBonus + pt + lwfAmount);

  // Steps 2–4 — working-day rates (company calendar)
  const perDay = workingDays > 0 ? monthlySalary / workingDays : 0;
  const perHour = perDay / HOURS_PER_DAY;

  // Step 5 — unpaid leave deduction within employment dates for this month
  const attendance = summarizeAttendanceDays(input.scheduledDates, input.attendanceByDate);
  const employmentWorkingDays = input.scheduledDates.length;
  const unpaidLeaveAmount = round2(attendance.totalUnpaidLeave * perDay);
  const paidLeaveAmount = round2(attendance.totalPaidLeave * perDay);
  const payableDayWeight = Math.max(0, employmentWorkingDays - attendance.totalUnpaidLeave);
  const amountAfterAttendance = round2(payableDayWeight * perDay);

  // Step 6 — deduct loyalty, PT, LWF from post-attendance amount
  const finalPayment = round2(Math.max(0, amountAfterAttendance - totalFixedDeductions));

  return {
    monthlySalary: round2(monthlySalary),
    workingDays,
    perDay: round2(perDay),
    perHour: round2(perHour),
    halfPaidLeave: attendance.halfPaidLeave,
    fullPaidLeave: attendance.fullPaidLeave,
    halfUnpaidLeave: attendance.halfUnpaidLeave,
    fullUnpaidLeave: attendance.fullUnpaidLeave,
    totalPaidLeave: attendance.totalPaidLeave,
    totalUnpaidLeave: attendance.totalUnpaidLeave,
    attendDays: attendance.attendDays,
    paidLeaveAmount,
    unpaidLeaveAmount,
    amountAfterAttendance,
    loyaltyPercent,
    loyaltyBonus,
    professionalTax: pt,
    lwf: lwfAmount,
    totalFixedDeductions,
    finalPayment,
    dayCodes: attendance.dayCodes,
  };
}

export type PayrollPeriodAggregate = {
  employeeCount: number;
  totalNetPayable: number;
  totalLoyalty: number;
  totalProfessionalTax: number;
  totalLwf: number;
  totalUnpaidLeaveAmount: number;
  employeesWithPt: number;
  employeesWithLwf: number;
  employeesWithLoyalty: number;
  employeesWithUnpaid: number;
};

export function aggregatePayroll(
  rows: Pick<
    PayrollEmployeeResult,
    "finalPayment" | "loyaltyBonus" | "professionalTax" | "lwf" | "unpaidLeaveAmount"
  >[],
): PayrollPeriodAggregate {
  let totalNetPayable = 0;
  let totalLoyalty = 0;
  let totalProfessionalTax = 0;
  let totalLwf = 0;
  let totalUnpaidLeaveAmount = 0;
  let employeesWithPt = 0;
  let employeesWithLwf = 0;
  let employeesWithLoyalty = 0;
  let employeesWithUnpaid = 0;

  for (const row of rows) {
    totalNetPayable += row.finalPayment;
    totalLoyalty += row.loyaltyBonus;
    totalProfessionalTax += row.professionalTax;
    totalLwf += row.lwf;
    totalUnpaidLeaveAmount += row.unpaidLeaveAmount;
    if (row.professionalTax > 0) employeesWithPt += 1;
    if (row.lwf > 0) employeesWithLwf += 1;
    if (row.loyaltyBonus > 0) employeesWithLoyalty += 1;
    if (row.unpaidLeaveAmount > 0) employeesWithUnpaid += 1;
  }

  return {
    employeeCount: rows.length,
    totalNetPayable: round2(totalNetPayable),
    totalLoyalty: round2(totalLoyalty),
    totalProfessionalTax: round2(totalProfessionalTax),
    totalLwf: round2(totalLwf),
    totalUnpaidLeaveAmount: round2(totalUnpaidLeaveAmount),
    employeesWithPt,
    employeesWithLwf,
    employeesWithLoyalty,
    employeesWithUnpaid,
  };
}
