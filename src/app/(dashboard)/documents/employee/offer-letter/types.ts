/** Editable fields for the employment offer letter (2-page format). */
export interface OfferFormState {
  employeeSheetRow: string;
  candidateName: string;
  position: string;
  commencementDate: string; // yyyy-mm-dd — employment start
  monthlySalary: string; // numeric string, e.g. "15000"
  loyaltyBonusRate: string; // %, e.g. "10"
  interestRate: string; // %, e.g. "4" or "4-6"
  salaryEffectiveDate: string; // yyyy-mm-dd — salary calculation effective from
}

/** Render-ready offer letter data. */
export interface OfferLetterData {
  candidateName: string;
  candidateFirstName: string;
  position: string;
  companyName: string;
  companyAddress: string;
  commencementDate: string; // long date
  monthlySalary: string; // e.g. "15,000/-"
  basic: string;
  loyaltyBonusRate: string; // %
  interestRate: string; // e.g. "4%" or "4%-6%"
  loyaltyBonus: string;
  totalMonthly: string;
  salaryEffectiveDate: string; // long date
}
