import { headerToFormKey, type EmployeeFormState } from "./form";

/** Header row from sheet; trims trailing blank columns only */
export function getSheetHeaders(sheetData: string[][]): string[] {
  const headers = [...((sheetData[0] as string[]) ?? [])];
  while (headers.length > 0 && !headers[headers.length - 1]?.trim()) {
    headers.pop();
  }
  return headers;
}

/** Merge server-generated fields into an existing sheet row (preserves client values). */
export function mergeRowWithFormFields(
  headers: string[],
  row: string[],
  fields: Partial<EmployeeFormState>,
): string[] {
  return headers.map((header, index) => {
    const formKey = headerToFormKey(header);
    if (formKey && fields[formKey] !== undefined && fields[formKey] !== "") {
      return String(fields[formKey]);
    }
    return row[index] ?? "";
  });
}

/** Read employee display name from a sheet row using header mapping. */
export function getEmployeeNameFromRow(headers: string[], row: string[]): string {
  const nameIndex = headers.findIndex((h) => headerToFormKey(h) === "name");
  const name = nameIndex >= 0 ? String(row[nameIndex] ?? "").trim() : "";
  return name || String(row[0] ?? "").trim() || "Employee";
}

/** Read employee ID from a sheet row; falls back to sheet row index when missing. */
export function getEmployeeIdFromRow(headers: string[], row: string[], sheetRow?: number): string {
  const idIndex = headers.findIndex((h) => headerToFormKey(h) === "employeeId");
  const id = idIndex >= 0 ? String(row[idIndex] ?? "").trim() : "";
  if (id) return id;
  if (sheetRow != null && sheetRow >= 2) {
    return `EMP${String(sheetRow - 1).padStart(3, "0")}`;
  }
  return "";
}

/** Build A1 range for a single sheet row (e.g. Sheet1!A5:L5) */
export function sheetRowToRange(sheetRow: number, columnCount: number): string {
  const endColumn = columnIndexToLetter(columnCount);
  return `Sheet1!A${sheetRow}:${endColumn}${sheetRow}`;
}

function columnIndexToLetter(columnCount: number): string {
  let letter = "";
  let n = Math.max(1, columnCount);

  while (n > 0) {
    const remainder = (n - 1) % 26;
    letter = String.fromCharCode(65 + remainder) + letter;
    n = Math.floor((n - 1) / 26);
  }

  return letter;
}
