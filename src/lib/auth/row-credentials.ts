import { getSheetHeaders, headerToFormKey } from "@/lib/employee";

import { hashPassword, isBcryptHash } from "./password";

/** Remove password values from every data row (keeps headers). */
export function redactPasswordsFromSheetData(data: string[][]): string[][] {
  if (!data.length) return data;

  const headers = getSheetHeaders(data);
  const passwordIndex = headers.findIndex((h) => headerToFormKey(h) === "password");
  if (passwordIndex < 0) return data;

  return data.map((row, rowIndex) => {
    if (rowIndex === 0) return row;
    const copy = [...row];
    copy[passwordIndex] = "";
    return copy;
  });
}

/** Clear password column before sending a row to the client. */
export function redactPasswordFromRow(headers: string[], row: string[]): string[] {
  const passwordIndex = headers.findIndex((h) => headerToFormKey(h) === "password");
  if (passwordIndex < 0) return row;

  const copy = [...row];
  copy[passwordIndex] = "";
  return copy;
}

/**
 * Hash a new plain-text password, or keep the existing hash when the field is left blank on edit.
 */
export async function applyPasswordToRowValues(
  headers: string[],
  rowValues: string[],
  existingRow?: string[],
): Promise<string[]> {
  const passwordIndex = headers.findIndex((h) => headerToFormKey(h) === "password");
  if (passwordIndex < 0) return rowValues;

  const copy = [...rowValues];
  const incoming = String(copy[passwordIndex] ?? "").trim();

  if (!incoming) {
    if (existingRow) {
      copy[passwordIndex] = existingRow[passwordIndex] ?? "";
    }
    return copy;
  }

  if (isBcryptHash(incoming)) {
    return copy;
  }

  copy[passwordIndex] = await hashPassword(incoming);
  return copy;
}
