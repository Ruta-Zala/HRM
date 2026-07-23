import { WORK_MODE, WORKING_STATUS } from "@/lib/attendance/constants";
import { PAYROLL_DAY_CODE, type PayrollDayCode } from "@/lib/payroll/constants";

export type DayWeights = {
  code: PayrollDayCode;
  /** Day weight that reduces pay (unpaid). */
  unpaid: number;
  /** Day weight that is paid leave (still paid). */
  paidLeave: number;
  /** Day weight counted as attendance/presence. */
  present: number;
};

const WEIGHTS: Record<PayrollDayCode, Omit<DayWeights, "code">> = {
  [PAYROLL_DAY_CODE.PRESENT]: { unpaid: 0, paidLeave: 0, present: 1 },
  [PAYROLL_DAY_CODE.PAID_FULL]: { unpaid: 0, paidLeave: 1, present: 0 },
  [PAYROLL_DAY_CODE.PAID_HALF]: { unpaid: 0, paidLeave: 0.5, present: 0.5 },
  [PAYROLL_DAY_CODE.UNPAID_HALF]: { unpaid: 0.5, paidLeave: 0, present: 0.5 },
  [PAYROLL_DAY_CODE.UNPAID_FULL]: { unpaid: 1, paidLeave: 0, present: 0 },
};

export function weightsForCode(code: PayrollDayCode): DayWeights {
  return { code, ...WEIGHTS[code] };
}

/**
 * Map HRMS work mode / status into salary-sheet day codes (P/A/H/U/F).
 * Missing attendance on a scheduled working day should be treated as full unpaid (F).
 */
export function mapAttendanceToPayrollCode(input: {
  workMode?: string;
  status?: string;
  hasRow: boolean;
}): PayrollDayCode {
  if (!input.hasRow) return PAYROLL_DAY_CODE.UNPAID_FULL;

  const workMode = String(input.workMode ?? "").trim();
  const status = String(input.status ?? "").trim();

  if (status === WORKING_STATUS.ABSENT) {
    return PAYROLL_DAY_CODE.UNPAID_FULL;
  }

  if (workMode === WORK_MODE.UNPAID_LEAVE) {
    return PAYROLL_DAY_CODE.UNPAID_FULL;
  }

  if (workMode === WORK_MODE.HALF_DAY_UNPAID_LEAVE) {
    return PAYROLL_DAY_CODE.UNPAID_HALF;
  }

  if (
    workMode === WORK_MODE.PAID_LEAVE ||
    workMode === WORK_MODE.SICK_LEAVE ||
    workMode === WORK_MODE.CASUAL_LEAVE ||
    workMode === WORK_MODE.SL ||
    workMode === WORK_MODE.FULL_DAY_LEAVE
  ) {
    return PAYROLL_DAY_CODE.PAID_FULL;
  }

  if (
    workMode === WORK_MODE.HALF_DAY_PAID_LEAVE ||
    workMode === WORK_MODE.HALF_DAY_LEAVE ||
    workMode === WORK_MODE.WFH_HALF_DAY
  ) {
    return PAYROLL_DAY_CODE.PAID_HALF;
  }

  if (workMode === WORK_MODE.PUBLIC_HOLIDAY || workMode === WORK_MODE.WEEKEND_HOLIDAY) {
    // Scheduled working calendar already excludes leave-type holidays / weekends.
    // If a holiday row still appears, do not deduct pay.
    return PAYROLL_DAY_CODE.PRESENT;
  }

  if (status === WORKING_STATUS.ON_LEAVE) {
    return PAYROLL_DAY_CODE.PAID_FULL;
  }

  return PAYROLL_DAY_CODE.PRESENT;
}

export function summarizeAttendanceDays(
  scheduledDates: string[],
  attendanceByDate: Map<string, { workMode?: string; status?: string }>,
): {
  halfPaidLeave: number;
  fullPaidLeave: number;
  halfUnpaidLeave: number;
  fullUnpaidLeave: number;
  totalPaidLeave: number;
  totalUnpaidLeave: number;
  attendDays: number;
  dayCodes: Record<string, PayrollDayCode>;
} {
  let halfPaidLeave = 0;
  let fullPaidLeave = 0;
  let halfUnpaidLeave = 0;
  let fullUnpaidLeave = 0;
  let totalPaidLeave = 0;
  let totalUnpaidLeave = 0;
  let attendDays = 0;
  const dayCodes: Record<string, PayrollDayCode> = {};

  for (const date of scheduledDates) {
    const row = attendanceByDate.get(date);
    const code = mapAttendanceToPayrollCode({
      workMode: row?.workMode,
      status: row?.status,
      hasRow: Boolean(row),
    });
    const weights = weightsForCode(code);
    dayCodes[date] = code;

    if (code === PAYROLL_DAY_CODE.PAID_HALF) halfPaidLeave += weights.paidLeave;
    if (code === PAYROLL_DAY_CODE.PAID_FULL) fullPaidLeave += weights.paidLeave;
    if (code === PAYROLL_DAY_CODE.UNPAID_HALF) halfUnpaidLeave += weights.unpaid;
    if (code === PAYROLL_DAY_CODE.UNPAID_FULL) fullUnpaidLeave += weights.unpaid;

    totalPaidLeave += weights.paidLeave;
    totalUnpaidLeave += weights.unpaid;
    attendDays += weights.present;
  }

  return {
    halfPaidLeave,
    fullPaidLeave,
    halfUnpaidLeave,
    fullUnpaidLeave,
    totalPaidLeave,
    totalUnpaidLeave,
    attendDays,
    dayCodes,
  };
}
