import {
  canonicalizeWorkMode,
  WORK_MODE_DAY_CODE,
  WORKING_STATUS,
  type WorkMode,
} from "@/lib/attendance/constants";
import { PAYROLL_DAY_CODE, type PayrollDayCode } from "@/lib/payroll/constants";

export type PayrollAttendanceDay = {
  workMode?: string;
  status?: string;
  punchIn?: string;
  punchOut?: string;
  overtime?: string;
  isOvertimeApproved?: string;
};

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

function dayCodeFromWorkMode(workMode: string): PayrollDayCode | null {
  const code = WORK_MODE_DAY_CODE[workMode as WorkMode];
  if (!code) return null;
  return code as PayrollDayCode;
}

/**
 * Map attendance-sheet work modes into payroll day codes:
 * P = Full Day Onsite, A = Paid Leave, H = Half Day Paid Leave,
 * U = Half Day Unpaid Leave, F = Unpaid Leave.
 *
 * Missing attendance on a due scheduled working day = F.
 */
export function mapAttendanceToPayrollCode(input: {
  workMode?: string;
  status?: string;
  hasRow: boolean;
  punchIn?: string;
  punchOut?: string;
}): PayrollDayCode {
  if (!input.hasRow) return PAYROLL_DAY_CODE.UNPAID_FULL;

  const workMode = canonicalizeWorkMode(String(input.workMode ?? ""));
  const status = String(input.status ?? "").trim();
  const hasPunch = Boolean(input.punchIn?.trim() || input.punchOut?.trim());

  if (status === WORKING_STATUS.ABSENT) {
    return PAYROLL_DAY_CODE.UNPAID_FULL;
  }

  const fromMode = dayCodeFromWorkMode(workMode);
  if (fromMode) return fromMode;

  // Punched day with blank/unknown work mode = P (present)
  if (hasPunch) {
    return PAYROLL_DAY_CODE.PRESENT;
  }

  // Leave marked only by status (no explicit work mode) = A (paid leave, no deduction)
  if (status === WORKING_STATUS.ON_LEAVE) {
    return PAYROLL_DAY_CODE.PAID_FULL;
  }

  return PAYROLL_DAY_CODE.PRESENT;
}

export function summarizeAttendanceDays(
  scheduledDates: string[],
  attendanceByDate: Map<string, PayrollAttendanceDay>,
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
      punchIn: row?.punchIn,
      punchOut: row?.punchOut,
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
