import { COMPANY, formatLongDate, pronouns } from "../../_shared/letter-utils";
import type { NocFormState, NocLetterData } from "./types";

export function buildNocData(form: NocFormState): NocLetterData {
  const p = pronouns(form.title);
  return {
    candidateName: form.candidateName,
    honorific: p.honorific,
    subject: p.subject,
    subjectLower: p.subject.toLowerCase(),
    possessive: p.possessive,
    object: p.object,
    date: formatLongDate(form.date),
    companyName: COMPANY.name,
  };
}
