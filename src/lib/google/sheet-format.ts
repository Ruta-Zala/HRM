import type { sheets_v4 } from "googleapis";

import { getSheetsClient } from "./drive-auth";

/** Matches Exhibyte HRM teal header (readable with white bold text). */
const HEADER_BG = { red: 0.05, green: 0.45, blue: 0.42 };
const HEADER_FG = { red: 1, green: 1, blue: 1 };

async function resolveSheetId(
  sheetsApi: sheets_v4.Sheets,
  spreadsheetId: string,
  sheetTitle: string,
): Promise<number | null> {
  const meta = await sheetsApi.spreadsheets.get({
    spreadsheetId,
    fields: "sheets.properties",
  });
  const normalized = sheetTitle.trim().toLowerCase();
  const sheet = meta.data.sheets?.find(
    (s) => (s.properties?.title ?? "").trim().toLowerCase() === normalized,
  );
  return sheet?.properties?.sheetId ?? null;
}

/**
 * Bold white title row, teal background, frozen header — same look for every table.
 */
export async function applySheetHeaderRowFormat(
  sheetsApi: sheets_v4.Sheets,
  spreadsheetId: string,
  sheetId: number,
  columnCount: number,
): Promise<void> {
  if (columnCount < 1) return;

  await sheetsApi.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: { requests: headerFormatRequests(sheetId, columnCount) },
  });
}

function headerFormatRequests(sheetId: number, columnCount: number): sheets_v4.Schema$Request[] {
  return [
    {
      repeatCell: {
        range: {
          sheetId,
          startRowIndex: 0,
          endRowIndex: 1,
          startColumnIndex: 0,
          endColumnIndex: columnCount,
        },
        cell: {
          userEnteredFormat: {
            backgroundColor: HEADER_BG,
            textFormat: {
              bold: true,
              foregroundColor: HEADER_FG,
              fontSize: 10,
            },
            horizontalAlignment: "CENTER",
            verticalAlignment: "MIDDLE",
            wrapStrategy: "WRAP",
          },
        },
        fields:
          "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment,wrapStrategy)",
      },
    },
    {
      updateSheetProperties: {
        properties: {
          sheetId,
          gridProperties: { frozenRowCount: 1 },
        },
        fields: "gridProperties.frozenRowCount",
      },
    },
    {
      updateDimensionProperties: {
        range: {
          sheetId,
          dimension: "ROWS",
          startIndex: 0,
          endIndex: 1,
        },
        properties: { pixelSize: 36 },
        fields: "pixelSize",
      },
    },
  ];
}

export async function applySheetHeaderFormatByTitle(
  spreadsheetId: string,
  sheetTitle: string,
  columnCount: number,
): Promise<void> {
  const sheetsApi = await getSheetsClient();
  const sheetId = await resolveSheetId(sheetsApi, spreadsheetId, sheetTitle);
  if (sheetId == null) return;
  await applySheetHeaderRowFormat(sheetsApi, spreadsheetId, sheetId, columnCount);
}

/** Format row 1 on multiple tabs in one API call (saves quota). */
export async function applySheetHeaderFormatForTitles(
  spreadsheetId: string,
  sheetTitles: string[],
  columnCount: number,
): Promise<void> {
  if (!sheetTitles.length || columnCount < 1) return;

  const sheetsApi = await getSheetsClient();
  const meta = await sheetsApi.spreadsheets.get({
    spreadsheetId,
    fields: "sheets.properties",
  });

  const requests: sheets_v4.Schema$Request[] = [];
  const normalizedTitles = new Set(sheetTitles.map((t) => t.trim().toLowerCase()));

  for (const sheet of meta.data.sheets ?? []) {
    const title = sheet.properties?.title ?? "";
    if (!normalizedTitles.has(title.trim().toLowerCase())) continue;
    const sheetId = sheet.properties?.sheetId;
    if (sheetId == null) continue;
    requests.push(...headerFormatRequests(sheetId, columnCount));
  }

  if (!requests.length) return;

  await sheetsApi.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: { requests },
  });
}

/** Format row 1 on the default employee master tab (Employees). */
export async function applyEmployeeMasterHeaderFormat(
  spreadsheetId: string,
  columnCount: number,
): Promise<void> {
  await applySheetHeaderFormatByTitle(spreadsheetId, "Employees", columnCount);
}
