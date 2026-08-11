import { COMPANY, formatShortDate, pronouns } from "../../_shared/letter-utils";
import type { NocFormState, NocLetterData } from "./types";

export function buildNocData(form: NocFormState): NocLetterData {
  const p = pronouns(form.title);
  return {
    candidateName: form.candidateName,
    honorific: p.honorific,
    subject: p.subject,
    subjectLower: p.subject.toLowerCase(),
    possessive: p.possessive,
    date: formatShortDate(form.date),
    companyName: COMPANY.name,
  };
}
