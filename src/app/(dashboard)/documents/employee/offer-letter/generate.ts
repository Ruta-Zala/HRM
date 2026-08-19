import { COMPANY, firstName, formatLongDate } from "../../_shared/letter-utils";
import type { OfferFormState, OfferLetterData } from "./types";

function toAmount(value: string): number {
  const n = Number(String(value).replace(/[^\d.]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

/** Indian-grouped rupees with the "/-" suffix, e.g. 15000 ÔåÆ "15,000/-". */
function formatRupees(amount: number): string {
  if (amount <= 0) return "-";
  return `${amount.toLocaleString("en-IN")}/-`;
}

const MIN_INTEREST_RATE = 4;

function parseInterestParts(value: string): number[] {
  return value
    .trim()
    .split(/\s*(?:-|–|—|to)\s*/i)
    .map((part) => Number(part.replace(/[^\d.]/g, "")))
    .filter((n) => Number.isFinite(n) && n > 0);
}

function formatInterestNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : String(value);
}

/** Accepts "4", "4%", "4-6", or "4%-6%" and renders "4%" or "4%-6%". */
export function formatInterestRate(value: string): string {
  const parts = parseInterestParts(value);
  if (parts.length === 0) return `${MIN_INTEREST_RATE}%`;
  if (parts.length === 1) return `${formatInterestNumber(parts[0])}%`;
  return `${formatInterestNumber(parts[0])}%-${formatInterestNumber(parts[parts.length - 1])}%`;
}

export function interestRateMeetsMinimum(value: string): boolean {
  const parts = parseInterestParts(value);
  if (parts.length === 0) return false;
  return Math.min(...parts) >= MIN_INTEREST_RATE;
}

export function buildOfferLetterData(form: OfferFormState): OfferLetterData {
  const basic = toAmount(form.monthlySalary);
  const rate = Number(form.loyaltyBonusRate) || 10;
  const loyaltyBonus = Math.round((basic * rate) / 100);
  const totalMonthly = basic - loyaltyBonus;
  const interestRate = formatInterestRate(form.interestRate);

  return {
    candidateName: form.candidateName,
    candidateFirstName: firstName(form.candidateName),
    position: form.position.trim() || "-",
    companyName: COMPANY.name,
    companyAddress: COMPANY.address,
    commencementDate: formatLongDate(form.commencementDate),
    monthlySalary: formatRupees(basic),
    basic: formatRupees(basic),
    loyaltyBonusRate: String(rate),
    interestRate,
    loyaltyBonus: formatRupees(loyaltyBonus),
    totalMonthly: formatRupees(totalMonthly),
    salaryEffectiveDate: formatLongDate(form.salaryEffectiveDate),
  };
}
