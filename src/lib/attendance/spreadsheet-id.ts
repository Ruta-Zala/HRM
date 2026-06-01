import { headerToFormKey } from "@/lib/employee";

/** Write attendance spreadsheet ID onto the employee row (any mapped header variant). */
export function setAttendanceSpreadsheetIdOnRow(
  headers: string[],
  row: string[],
  spreadsheetId: string,
): string[] {
  const updated = [...row];
  while (updated.length < headers.length) updated.push("");

  let index = headers.findIndex((h) => headerToFormKey(h) === "attendanceSpreadsheetId");

  if (index < 0) {
    index = headers.findIndex((header) => {
      const key = header
        .trim()
        .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
        .replace(/\s+/g, "_")
        .toLowerCase();
      return key.includes("attendance") && key.includes("spreadsheet") && key.includes("id");
    });
  }

  if (index >= 0) {
    updated[index] = spreadsheetId;
  }

  return updated;
}
