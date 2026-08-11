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

export function buildOfferLetterData(form: OfferFormState): OfferLetterData {
  const basic = toAmount(form.monthlySalary);
  const rate = Number(form.loyaltyBonusRate) || 10;
  const loyaltyBonus = Math.round((basic * rate) / 100);
  const totalMonthly = basic - loyaltyBonus;

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
    loyaltyBonus: formatRupees(loyaltyBonus),
    totalMonthly: formatRupees(totalMonthly),
    salaryEffectiveDate: formatLongDate(form.salaryEffectiveDate),
  };
}
