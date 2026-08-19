import type { Title } from "../../_shared/letter-utils";

/** Editable fields for the No Objection Certificate. */
export interface NocFormState {
  employeeSheetRow: string;
  candidateName: string;
  title: Title;
  date: string; // yyyy-mm-dd
}

/** Render-ready NOC data. */
export interface NocLetterData {
  candidateName: string;
  honorific: string; // Mr./Ms./Mrs.
  subject: string; // He/She
  subjectLower: string; // he/she
  possessive: string; // his/her
  object: string; // him/her
  date: string; // 30th June, 2026
  companyName: string;
}
