import type { EmployeeFormState } from "./form";
import { mergeRowWithFormFields } from "./headers";

/** ISO timestamp for Google Sheet audit columns (`createdAt`, `UpdatedAt`). */
export function formatSheetTimestamp(date: Date = new Date()): string {
  return date.toISOString();
}

export function sheetTimestampsForCreate(): Pick<EmployeeFormState, "createdAt" | "updatedAt"> {
  const now = formatSheetTimestamp();
  return { createdAt: now, updatedAt: now };
}

export function sheetTimestampsForUpdate(): Pick<EmployeeFormState, "updatedAt"> {
  return { updatedAt: formatSheetTimestamp() };
}

/** Sets `UpdatedAt` on a sheet row before persisting. */
export function withSheetRowUpdatedAt(headers: string[], row: string[]): string[] {
  return mergeRowWithFormFields(headers, row, sheetTimestampsForUpdate());
}
