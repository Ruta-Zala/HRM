/** Editable fields for the internship offer letter. Candidates aren't in the
 * employee system yet at offer stage (they're only added after accepting),
 * so the name is free text rather than a picker. */
export interface OfferFormState {
  candidateName: string;
  position: string;
  durationStart: string; // yyyy-mm-dd
  durationEnd: string; // yyyy-mm-dd
  offerDate: string; // yyyy-mm-dd
  acceptanceDeadline: string; // yyyy-mm-dd
}

/** Render-ready internship offer letter data. */
export interface OfferLetterData {
  candidateName: string;
  candidateFirstName: string;
  position: string;
  offerDate: string; // dd/mm/yyyy
  durationStart: string; // dd/mm/yyyy
  durationEnd: string; // dd/mm/yyyy
  workingDays: string;
  workingHours: string;
  acceptanceDeadline: string; // dd/mm/yyyy
}
