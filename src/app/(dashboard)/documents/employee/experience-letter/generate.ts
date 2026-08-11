import { COMPANY, formatLongDate, pronouns } from "../../_shared/letter-utils";
import type { ExperienceFormState, ExperienceLetterData } from "./types";

export function buildExperienceLetterData(form: ExperienceFormState): ExperienceLetterData {
  const p = pronouns(form.title);
  return {
    candidateName: form.candidateName,
    honorific: p.honorific,
    position: form.position.trim() || "-",
    startDate: formatLongDate(form.startDate),
    endDate: formatLongDate(form.endDate),
    issueDate: formatLongDate(form.issueDate),
    subjectLower: p.subject.toLowerCase(),
    object: p.object,
    possessive: p.possessive,
    possessiveCap: `${p.possessive.charAt(0).toUpperCase()}${p.possessive.slice(1)}`,
    companyName: COMPANY.name,
  };
}
