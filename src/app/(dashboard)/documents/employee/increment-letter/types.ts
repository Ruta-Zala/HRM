/** Editable fields for the increment letter. */
export interface IncrementFormState {
  employeeSheetRow: string;
  candidateName: string;
  address: string;
  letterDate: string; // yyyy-mm-dd — date printed at the top
  effectiveDate: string; // yyyy-mm-dd — increment effective date
  revisedSalary: string; // numeric string, e.g. "17000"
  loyaltyBonusRate: string; // %, e.g. "10"
  interestRate: string; // %, e.g. "4"
}

/** Render-ready increment letter data. */
export interface IncrementLetterData {
  candidateName: string;
  candidateFirstName: string;
  address: string;
  letterDate: string; // long date
  effectiveDate: string; // long date
  revisedSalary: string; // e.g. "₹17,000/-"
  loyaltyBonusRate: string;
  interestRate: string;
  companyName: string;
}
