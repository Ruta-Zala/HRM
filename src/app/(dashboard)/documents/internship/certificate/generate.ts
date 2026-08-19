import { COMPANY, formatLongDate, pronouns } from "../../_shared/letter-utils";
import type { CertificateFormState, CertificateLetterData } from "./types";

export function buildCertificateData(form: CertificateFormState): CertificateLetterData {
  const p = pronouns(form.title);
  return {
    candidateName: form.candidateName,
    honorific: p.honorific,
    subject: p.subject,
    subjectLower: p.subject.toLowerCase(),
    object: p.object,
    position: form.position.trim() || "-",
    startDate: formatLongDate(form.startDate),
    endDate: formatLongDate(form.endDate),
    issueDate: formatLongDate(form.issueDate),
    companyName: COMPANY.name,
  };
}
