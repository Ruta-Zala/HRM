import {
  COMPANY,
  formatLongDate,
  pronouns,
  type LetterCompanyFields,
} from "../../_shared/letter-utils";
import type { ExperienceFormState, ExperienceLetterData } from "./types";

export function buildExperienceLetterData(
  form: ExperienceFormState,
  company: LetterCompanyFields = COMPANY,
): ExperienceLetterData {
  const p = pronouns(form.title);
  return {
    candidateName: form.candidateName,
    honorific: p.honorific,
    position: form.position.trim() || "-",
    startDate: formatLongDate(form.startDate),
    endDate: formatLongDate(form.endDate),
    issueDate: formatLongDate(form.issueDate),
    object: p.object,
    possessive: p.possessive,
    companyName: company.name || "Company",
    additionalRemarks: form.additionalRemarks.trim(),
  };
}
