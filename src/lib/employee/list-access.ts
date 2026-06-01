import { headerToFormKey } from "./form";
import { getSheetHeaders } from "./headers";
import { EMPLOYEE_HR_ONLY_FIELDS, EMPLOYEE_LIST_PUBLIC_FIELDS } from "./list-fields";

const PUBLIC_FIELD_SET = new Set<string>(EMPLOYEE_LIST_PUBLIC_FIELDS);

/**
 * Limit sheet rows to directory-safe columns for employees.
 * HR / super admin receive the full row (call with canViewFullDetails true).
 * Server-only — import from `@/lib/employee/list-access` in API routes.
 */
export function filterEmployeeSheetForViewer(
  data: string[][],
  canViewFullDetails: boolean,
): string[][] {
  if (!data.length || canViewFullDetails) return data;

  const headers = getSheetHeaders(data);
  const keepIndices = headers
    .map((header, index) => ({
      index,
      key: headerToFormKey(header),
    }))
    .filter(({ key }) => key != null && PUBLIC_FIELD_SET.has(key))
    .map(({ index }) => index);

  if (!keepIndices.length) {
    return [headers.map((h) => h)];
  }

  const pickCells = (row: string[]) => keepIndices.map((colIndex) => row[colIndex] ?? "");

  return [pickCells(headers), ...data.slice(1).map(pickCells)];
}

/** Filter a single row + headers pair for the current viewer role. */
export function filterEmployeeRowForViewer(
  headers: string[],
  row: string[],
  canViewFullDetails: boolean,
): { headers: string[]; row: string[] } {
  const filtered = filterEmployeeSheetForViewer([headers, row], canViewFullDetails);
  return {
    headers: filtered[0] ?? [],
    row: filtered[1] ?? [],
  };
}

const HR_ONLY_FIELD_SET = new Set<string>(EMPLOYEE_HR_ONLY_FIELDS);
const LOCKED_FOR_NON_MANAGERS_SET = new Set<string>(["role"]);

/** Clear HR-only cells in a row (e.g. own-profile API for employees). */
export function redactHrOnlyFieldsFromRow(headers: string[], row: string[]): string[] {
  const formKeyByIndex = headers.map((header) => headerToFormKey(header));

  return row.map((cell, index) => {
    const key = formKeyByIndex[index];
    if (key != null && HR_ONLY_FIELD_SET.has(key)) return "";
    return cell;
  });
}

/** Restore HR-only column values on update when the caller is not HR / super admin. */
export function preserveHrOnlyFieldsOnUpdate(
  headers: string[],
  incomingRow: string[],
  existingRow: string[],
): string[] {
  const formKeyByIndex = headers.map((header) => headerToFormKey(header));

  return incomingRow.map((cell, index) => {
    const key = formKeyByIndex[index];
    if (key != null && (HR_ONLY_FIELD_SET.has(key) || LOCKED_FOR_NON_MANAGERS_SET.has(key))) {
      return existingRow[index] ?? "";
    }
    return cell;
  });
}

export { EMPLOYEE_HR_ONLY_FIELDS, EMPLOYEE_LIST_PUBLIC_FIELDS } from "./list-fields";
