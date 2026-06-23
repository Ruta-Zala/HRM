import type { SalaryBreakdownInput } from "./types";

function clampToMoney(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100) / 100;
}

export function calculateSalaryBreakdown(input: SalaryBreakdownInput) {
  const { basic, loyaltyBonus, professionalTax, workingDays, netPayableDays } = input;

  const ratio = workingDays > 0 ? Math.min(1, Math.max(0, netPayableDays / workingDays)) : 1;
  const earningsBasic = clampToMoney(basic * ratio);

  const totalEarnings = clampToMoney(earningsBasic);
  const loyaltyBonusRate = Math.min(100, Math.max(0, loyaltyBonus));
  const loyaltyBonusAmount = clampToMoney((totalEarnings * loyaltyBonusRate) / 100);
  const totalDeductions = clampToMoney(loyaltyBonusAmount + professionalTax);
  const netPay = clampToMoney(totalEarnings - totalDeductions);

  return {
    basic: earningsBasic,
    totalEarnings,
    loyaltyBonus: loyaltyBonusAmount,
    professionalTax: clampToMoney(professionalTax),
    totalDeductions,
    netPay,
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
