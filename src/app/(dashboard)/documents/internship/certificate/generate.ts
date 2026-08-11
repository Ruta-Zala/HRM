import { firstName, formatLongDate, monthsBetween, pronouns } from "../../_shared/letter-utils";
import type { CertificateFormState, CertificateLetterData } from "./types";

export function buildCertificateData(form: CertificateFormState): CertificateLetterData {
  const p = pronouns(form.title);
  return {
    candidateName: form.candidateName,
    candidateFirstName: firstName(form.candidateName),
    honorific: p.honorific,
    subject: p.subject,
    possessive: p.possessive,
    project: form.project.trim() || "assigned",
    durationMonths: monthsBetween(form.startDate, form.endDate),
    startDate: formatLongDate(form.startDate),
    endDate: formatLongDate(form.endDate),
    issueDate: formatLongDate(form.issueDate),
  };
}
