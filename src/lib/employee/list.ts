import type { Employee, EmployeeStatus } from "@/types/employee";
import type { SheetPagination } from "@/types/sheet";
import { headerToFormKey, normalizeStatus, type EmployeeFormState } from "./form";

const PICKER_FIELD_KEYS = [
  "employeeId",
  "name",
  "role",
  "status",
  "position",
  "email",
] as const satisfies readonly (keyof EmployeeFormState)[];

type EmployeeListApiResponse = {
  success: boolean;
  data?: string[][];
  sheetRows?: number[];
  pagination?: SheetPagination;
};

/** Parse paginated `/api/employee` payload into picker list items. */
export function parseEmployeeListApiResponse(result: EmployeeListApiResponse): Employee[] {
  if (!result.success || !result.data?.length) return [];

  const sheetData = result.data;
  const headers = (sheetData[0] as string[]) ?? [];
  const dataRows = sheetData.slice(1);
  const sheetRows: number[] = result.sheetRows ?? [];

  return dataRows.map((row, index) => {
    const fields = pickSheetRowFields(headers, row, PICKER_FIELD_KEYS);
    return {
      sheetRow: String(sheetRows[index] ?? index + 1),
      employeeId: fields.employeeId ?? "",
      name: fields.name ?? "",
      role: fields.role ?? "",
      status: normalizeStatus(fields.status ?? "") as EmployeeStatus,
      position: fields.position ?? "",
      email: fields.email ?? "",
    };
  });
}

/** Read selected form fields from a sheet row using header mapping. */
export function pickSheetRowFields(
  headers: string[],
  row: string[],
  fields: readonly (keyof EmployeeFormState)[],
): Record<string, string> {
  const formKeyByIndex = headers.map(headerToFormKey);
  const record: Record<string, string> = {};

  for (const field of fields) {
    const colIndex = formKeyByIndex.indexOf(field);
    record[field] = colIndex >= 0 ? String(row[colIndex] ?? "") : "";
  }

  return record;
}
