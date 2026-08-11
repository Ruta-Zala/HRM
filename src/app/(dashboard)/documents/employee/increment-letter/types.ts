/** Editable fields for the increment letter. */
export interface IncrementFormState {
  employeeSheetRow: string;
  candidateName: string;
  address: string;
  effectiveDate: string; // yyyy-mm-dd — also the letter date
  revisedSalary: string; // free text, e.g. "Ôé╣25,000/-"
  loyaltyBonusRate: string; // %, e.g. "10"
}

/** Render-ready increment letter data. */
export interface IncrementLetterData {
  candidateName: string;
  candidateFirstName: string;
  address: string;
  effectiveDate: string; // long date
  revisedSalary: string;
  loyaltyBonusRate: string;
  companyName: string;
}
