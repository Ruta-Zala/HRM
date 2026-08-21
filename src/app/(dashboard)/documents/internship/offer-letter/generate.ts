import {
  COMPANY,
  firstName,
  formatLongDate,
  formatShortDate,
  type LetterCompanyFields,
} from "../../_shared/letter-utils";
import type { OfferFormState, OfferLetterData } from "./types";

const WORKING_DAYS = "Monday to Friday";
const FULL_TIME_HOURS = "9:30 AM to 6:30 PM";
const MIN_PART_TIME_MINUTES = 4 * 60;

function timeToMinutes(time: string): number | null {
  const match = /^(\d{1,2}):(\d{2})/.exec(time.trim());
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  return hour * 60 + minute;
}

/** Part-time internships must be at least 4 hours in a single day. */
export function partTimeHoursMeetMinimum(start: string, end: string): boolean {
  const startMinutes = timeToMinutes(start);
  const endMinutes = timeToMinutes(end);
  if (startMinutes == null || endMinutes == null) return false;
  return endMinutes - startMinutes >= MIN_PART_TIME_MINUTES;
}

/** "09:30" → "9:30 AM" */
function formatClock(time: string): string {
  const match = /^(\d{1,2}):(\d{2})/.exec(time.trim());
  if (!match) return "-";
  const hour24 = Number(match[1]);
  const minutes = match[2];
  if (hour24 > 23) return "-";
  const period = hour24 >= 12 ? "PM" : "AM";
  const hour12 = hour24 % 12 || 12;
  return `${hour12}:${minutes} ${period}`;
}

export function buildOfferLetterData(
  form: OfferFormState,
  company: LetterCompanyFields = COMPANY,
): OfferLetterData {
  const workingHours =
    form.internshipType === "part-time"
      ? `${formatClock(form.partTimeStart)} to ${formatClock(form.partTimeEnd)}`
      : FULL_TIME_HOURS;

  return {
    candidateName: form.candidateName,
    candidateFirstName: firstName(form.candidateName),
    position: form.position.trim() || "-",
    companyName: company.name || "Company",
    internshipTypeLabel: form.internshipType,
    offerDate: formatLongDate(form.offerDate),
    durationStart: formatShortDate(form.durationStart),
    durationEnd: formatShortDate(form.durationEnd),
    workingDays: WORKING_DAYS,
    workingHours,
    acceptanceDeadline: formatShortDate(form.acceptanceDeadline),
  };
}
