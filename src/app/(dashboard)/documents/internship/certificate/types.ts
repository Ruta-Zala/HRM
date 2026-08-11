import type { Title } from "../../_shared/letter-utils";

/** Editable fields for the internship certificate. */
export interface CertificateFormState {
  employeeSheetRow: string;
  candidateName: string;
  title: Title;
  project: string;
  startDate: string; // yyyy-mm-dd
  endDate: string; // yyyy-mm-dd
  issueDate: string; // yyyy-mm-dd
}

/** Render-ready internship certificate data. */
export interface CertificateLetterData {
  candidateName: string;
  candidateFirstName: string;
  honorific: string; // Mr./Ms./Mrs.
  subject: string; // He/She
  possessive: string; // his/her
  project: string;
  durationMonths: number;
  startDate: string; // long date
  endDate: string; // long date
  issueDate: string; // long date
}
