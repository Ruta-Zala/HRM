import {
  COMPANY,
  firstName,
  formatLongDate,
  type LetterCompanyFields,
} from "../../_shared/letter-utils";
import type { IncrementFormState, IncrementLetterData } from "./types";

function formatRupees(value: string): string {
  const amount = Number(String(value).replace(/[^\d.]/g, ""));
  if (!Number.isFinite(amount) || amount <= 0) return "-";
  return `₹${amount.toLocaleString("en-IN")}/-`;
}

export function buildIncrementLetterData(
  form: IncrementFormState,
  company: LetterCompanyFields = COMPANY,
): IncrementLetterData {
  return {
    candidateName: form.candidateName,
    candidateFirstName: firstName(form.candidateName),
    address: form.address.trim(),
    letterDate: formatLongDate(form.letterDate),
    effectiveDate: formatLongDate(form.effectiveDate),
    revisedSalary: formatRupees(form.revisedSalary),
    loyaltyBonusRate: form.loyaltyBonusRate.trim() || "10",
    interestRate: form.interestRate.trim() || "4",
    companyName: company.name || "Company",
  };
}
