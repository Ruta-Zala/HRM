import type { Title } from "../../_shared/letter-utils";

/** Editable fields for the experience letter. */
export interface ExperienceFormState {
  employeeSheetRow: string;
  candidateName: string;
  title: Title;
  position: string;
  startDate: string; // yyyy-mm-dd
  endDate: string; // yyyy-mm-dd
  issueDate: string; // yyyy-mm-dd
}

/** Render-ready experience letter data. */
export interface ExperienceLetterData {
  candidateName: string;
  honorific: string; // Mr./Ms./Mrs.
  position: string;
  startDate: string; // long date
  endDate: string; // long date
  issueDate: string; // long date
  subjectLower: string; // he/she
  object: string; // him/her
  possessive: string; // his/her
  possessiveCap: string; // His/Her
  companyName: string;
}
