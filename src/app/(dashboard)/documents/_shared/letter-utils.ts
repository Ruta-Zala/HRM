/** Fixed signatory / company details used across all generated letters. */
export const COMPANY = {
  name: "ExhiByte Solutions",
  signatoryName: "Authorised Signatory",
  hrTitle: "HR Manager",
  /** Fixed work location — not editable per letter. */
  address: "364, Raj Imperia Vraj Chowk, Nana Varachha, Surat, Gujarat 395006",
} as const;

export type Title = "Mr" | "Ms" | "Mrs";

export const TITLE_OPTIONS: { value: Title; label: string }[] = [
  { value: "Mr", label: "Mr." },
  { value: "Ms", label: "Ms." },
  { value: "Mrs", label: "Mrs." },
];

export type Pronouns = {
  subject: string; // He / She
  object: string; // him / her
  possessive: string; // his / her
  honorific: string; // Mr. / Ms. / Mrs.
};

export function pronouns(title: Title): Pronouns {
  const female = title === "Ms" || title === "Mrs";
  return {
    subject: female ? "She" : "He",
    object: female ? "her" : "him",
    possessive: female ? "her" : "his",
    honorific: `${title}.`,
  };
}

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/** Parse a yyyy-mm-dd form value as a local date (avoids UTC off-by-one). */
function parseIso(iso: string): Date | null {
  if (!iso) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso.trim());
  if (match) {
    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  }
  const fallback = new Date(iso);
  return Number.isNaN(fallback.getTime()) ? null : fallback;
}

function ordinal(day: number): string {
  const suffixes = ["th", "st", "nd", "rd"];
  const value = day % 100;
  return `${day}${suffixes[(value - 20) % 10] ?? suffixes[value] ?? suffixes[0]}`;
}

/** dd/mm/yyyy — e.g. 30/09/2025 */
export function formatShortDate(iso: string): string {
  const date = parseIso(iso);
  if (!date) return "-";
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${date.getFullYear()}`;
}

/** 31st July, 2025 */
export function formatLongDate(iso: string): string {
  const date = parseIso(iso);
  if (!date) return "-";
  return `${ordinal(date.getDate())} ${MONTHS[date.getMonth()]}, ${date.getFullYear()}`;
}

export function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] || fullName.trim();
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function plusDaysIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Inclusive whole-month span between two yyyy-mm-dd dates (min 1). */
export function monthsBetween(startIso: string, endIso: string): number {
  const start = /^(\d{4})-(\d{2})/.exec(startIso);
  const end = /^(\d{4})-(\d{2})/.exec(endIso);
  if (!start || !end) return 1;
  const months = (Number(end[1]) - Number(start[1])) * 12 + (Number(end[2]) - Number(start[2])) + 1;
  return Math.max(1, months);
}

/** Opens the browser print dialog; the letter is the only visible element (see letter.module.css). */
export function printLetter(): void {
  window.print();
}
