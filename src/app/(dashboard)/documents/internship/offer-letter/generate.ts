import { firstName, formatShortDate } from "../../_shared/letter-utils";
import type { OfferFormState, OfferLetterData } from "./types";

const WORKING_DAYS = "Monday to Friday";
const WORKING_HOURS = "9:30 AM to 6:30 PM";

export function buildOfferLetterData(form: OfferFormState): OfferLetterData {
  return {
    candidateName: form.candidateName,
    candidateFirstName: firstName(form.candidateName),
    position: form.position.trim() || "-",
    offerDate: formatShortDate(form.offerDate),
    durationStart: formatShortDate(form.durationStart),
    durationEnd: formatShortDate(form.durationEnd),
    workingDays: WORKING_DAYS,
    workingHours: WORKING_HOURS,
    acceptanceDeadline: formatShortDate(form.acceptanceDeadline),
  };
}
