import type { SalaryBreakdownInput } from "./types";

function clampToMoney(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100) / 100;
}

/** Earnings after unpaid / mid-month days (used by payroll final pay). */
export function proratedEarningsTotal(input: {
  basic: number;
  hra: number;
  organizationAllowance: number;
  workingDays: number;
  netPayableDays: number;
}): number {
  const workingDays = Math.max(0, Number(input.workingDays) || 0);
  const ratio =
    workingDays > 0
      ? Math.min(1, Math.max(0, (Number(input.netPayableDays) || 0) / workingDays))
      : 1;
  return clampToMoney(
    clampToMoney(input.basic * ratio) +
      clampToMoney((input.hra || 0) * ratio) +
      clampToMoney((input.organizationAllowance || 0) * ratio),
  );
}

export function calculateSalaryBreakdown(input: SalaryBreakdownInput) {
  const {
    basic,
    hra,
    organizationAllowance,
    loyaltyBonus,
    professionalTax,
    lwf,
    workingDays,
    netPayableDays,
  } = input;

  const earningsBasic = clampToMoney(basic);
  const earningsHra = clampToMoney(hra || 0);
  const earningsOrgAllowance = clampToMoney(organizationAllowance || 0);
  const totalEarnings = clampToMoney(earningsBasic + earningsHra + earningsOrgAllowance);

  const unpaidDays = Math.max(0, workingDays - netPayableDays);
  const unpaidLeaveAmount = clampToMoney(
    input.unpaidLeaveAmount != null
      ? input.unpaidLeaveAmount
      : workingDays > 0
        ? unpaidDays * (totalEarnings / workingDays)
        : 0,
  );

  const loyaltyBonusRate = Math.min(100, Math.max(0, loyaltyBonus));
  const loyaltyBonusAmount = clampToMoney((basic * loyaltyBonusRate) / 100);
  const professionalTaxAmount = clampToMoney(professionalTax);
  const lwfAmount = clampToMoney(lwf);
  const totalDeductions = clampToMoney(
    loyaltyBonusAmount + professionalTaxAmount + lwfAmount + unpaidLeaveAmount,
  );
  const netPay = clampToMoney(totalEarnings - totalDeductions);
  const overtimeAmount = clampToMoney(input.overtimeAmount || 0);
  const totalPay = clampToMoney(netPay + overtimeAmount);

  return {
    basic: earningsBasic,
    hra: earningsHra,
    organizationAllowance: earningsOrgAllowance,
    unpaidLeaveAmount,
    totalEarnings,
    loyaltyBonus: loyaltyBonusAmount,
    professionalTax: professionalTaxAmount,
    lwf: lwfAmount,
    totalDeductions,
    netPay,
    overtimeAmount,
    totalPay,
    workingDays,
    netPayableDays,
  };
}

const BELOW_TWENTY = [
  "",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
  "eleven",
  "twelve",
  "thirteen",
  "fourteen",
  "fifteen",
  "sixteen",
  "seventeen",
  "eighteen",
  "nineteen",
] as const;
const TENS = [
  "",
  "",
  "twenty",
  "thirty",
  "forty",
  "fifty",
  "sixty",
  "seventy",
  "eighty",
  "ninety",
] as const;

function twoDigitWords(n: number): string {
  if (n < 20) return BELOW_TWENTY[n] ?? "";
  const ten = Math.floor(n / 10);
  const rem = n % 10;
  return rem ? `${TENS[ten]}-${BELOW_TWENTY[rem]}` : TENS[ten];
}

function threeDigitWords(n: number): string {
  if (n < 100) return twoDigitWords(n);
  const hundred = Math.floor(n / 100);
  const rem = n % 100;
  return rem
    ? `${BELOW_TWENTY[hundred]} hundred ${twoDigitWords(rem)}`
    : `${BELOW_TWENTY[hundred]} hundred`;
}

/** Convert integer rupees to Indian words format (lakh/crore). */
export function amountToIndianWords(amount: number): string {
  const whole = Math.max(0, Math.floor(amount));
  if (whole === 0) return "zero";

  const crore = Math.floor(whole / 10000000);
  const lakh = Math.floor((whole % 10000000) / 100000);
  const thousand = Math.floor((whole % 100000) / 1000);
  const hundredPart = whole % 1000;
  const parts: string[] = [];

  if (crore) parts.push(`${threeDigitWords(crore)} crore`);
  if (lakh) parts.push(`${threeDigitWords(lakh)} lakh`);
  if (thousand) parts.push(`${threeDigitWords(thousand)} thousand`);
  if (hundredPart) parts.push(threeDigitWords(hundredPart));
  return parts.join(" ").trim();
}
