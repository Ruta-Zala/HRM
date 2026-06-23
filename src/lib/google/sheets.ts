import { getSheetHeaders } from "@/lib/employee";
import { sheets } from "./auth";

const spreadsheetId = process.env.GOOGLE_SHEET_ID as string;

/** Wide enough for all employee + offboarding columns (beyond column Z). */
export const EMPLOYEE_SHEET_RANGE = "Employees!A1:AZ1000";

const DEFAULT_SHEET_TITLE = "Employees";

/** Column AZ = 52; matches {@link EMPLOYEE_SHEET_RANGE}. */
const EMPLOYEE_SHEET_COLUMN_COUNT = 52;

let cachedSheetId: number | null = null;

async function getSheetId(title: string = DEFAULT_SHEET_TITLE): Promise<number> {
  if (title === DEFAULT_SHEET_TITLE && cachedSheetId != null) {
    return cachedSheetId;
  }

  const meta = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: "sheets.properties",
  });

  const sheet = meta.data.sheets?.find((s) => s.properties?.title === title);
  const sheetId = sheet?.properties?.sheetId;

  if (sheetId == null) {
    throw new Error(`Sheet "${title}" not found`);
  }

  if (title === DEFAULT_SHEET_TITLE) {
    cachedSheetId = sheetId;
  }

  return sheetId;
}

/** 1-based row number from an A1 range like `Employees!A42:L42`. */
function sheetRowFromA1Range(range?: string | null): number | null {
  if (!range) return null;
  const match = range.match(/![A-Z]+(\d+)/i);
  if (!match) return null;
  const row = parseInt(match[1], 10);
  return Number.isFinite(row) ? row : null;
}

/**
 * Copy cell formatting (and data validation) from one row to another so new
 * appends match the existing sheet layout.
 */
export async function copyRowFormatFromRow(
  sourceSheetRow: number,
  targetSheetRow: number,
  columnCount: number = EMPLOYEE_SHEET_COLUMN_COUNT,
): Promise<void> {
  if (sourceSheetRow < 1 || targetSheetRow < 1 || sourceSheetRow === targetSheetRow) {
    return;
  }

  const sheetId = await getSheetId();
  const endColumnIndex = Math.max(1, columnCount);

  const gridRange = (row: number) => ({
    sheetId,
    startRowIndex: row - 1,
    endRowIndex: row,
    startColumnIndex: 0,
    endColumnIndex,
  });

  const source = gridRange(sourceSheetRow);
  const destination = gridRange(targetSheetRow);

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          copyPaste: {
            source,
            destination,
            pasteType: "PASTE_FORMAT",
            pasteOrientation: "NORMAL",
          },
        },
        {
          copyPaste: {
            source,
            destination,
            pasteType: "PASTE_DATA_VALIDATION",
            pasteOrientation: "NORMAL",
          },
        },
      ],
    },
  });
}

export const getSheetHeadersData = async () => {
  const rows = await readSheet("Employees");

  return getSheetHeaders(rows);
};

/**
 * Read Sheet Data
 */
export const readSheet = async (range: string = "Employees") => {
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
    });

    return response.data.values || [];
  } catch (error) {
    console.error("Read Sheet Error:", error);
    throw error;
  }
};

export type AppendSheetRowOptions = {
  /** When true (default), copy format from the row above the new row. */
  copyFormatFromPreviousRow?: boolean;
  columnCount?: number;
};

/**
 * Append Rows
 */
export const appendSheetRow = async (
  values: (string | number)[][],
  options: AppendSheetRowOptions = {},
) => {
  const { copyFormatFromPreviousRow = true, columnCount } = options;

  try {
    const response = await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: DEFAULT_SHEET_TITLE,
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values,
      },
    });

    const data = response.data;

    if (copyFormatFromPreviousRow) {
      const newRow = sheetRowFromA1Range(data.updates?.updatedRange);
      if (newRow != null && newRow > 1) {
        await copyRowFormatFromRow(newRow - 1, newRow, columnCount);
      }
    }

    return data;
  } catch (error) {
    console.error("Append Row Error:", error);
    throw error;
  }
};

/**
 * Update Rows
 */
export const updateSheetRow = async (range: string, values: (string | number)[][]) => {
  try {
    const response = await sheets.spreadsheets.values.update({
      spreadsheetId,
      range,
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values,
      },
    });

    return response.data;
  } catch (error) {
    console.error("Update Sheet Error:", error);
    throw error;
  }
};

/**
 * Clear Range
 */
export const clearSheetRange = async (range: string) => {
  try {
    const response = await sheets.spreadsheets.values.clear({
      spreadsheetId,
      range,
    });

    return response.data;
  } catch (error) {
    console.error("Clear Sheet Error:", error);
    throw error;
  }
};

export const getEmployeeCount = async () => {
  const rows = await readSheet("Employees");

  // remove header row
  return Math.max(rows.length - 1, 0);
};
