import { COMPANY, firstName, formatLongDate } from "../../_shared/letter-utils";
import type { IncrementFormState, IncrementLetterData } from "./types";

export function buildIncrementLetterData(form: IncrementFormState): IncrementLetterData {
  return {
    candidateName: form.candidateName,
    candidateFirstName: firstName(form.candidateName),
    address: form.address.trim(),
    effectiveDate: formatLongDate(form.effectiveDate),
    revisedSalary: form.revisedSalary.trim() || "-",
    loyaltyBonusRate: form.loyaltyBonusRate.trim() || "10",
    companyName: COMPANY.name,
  };
}
