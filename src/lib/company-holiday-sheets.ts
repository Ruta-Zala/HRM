import { randomUUID } from "node:crypto";

import { COMPANY_HOLIDAYS_2026, type CompanyHoliday } from "@/lib/company-holidays";
import { sheets } from "@/lib/google/auth";
import { applySheetHeaderFormatByTitle } from "@/lib/google/sheet-format";

const spreadsheetId = process.env.GOOGLE_SHEET_ID as string;
const SHEET_NAME = "Company Holidays";
const SHEET_RANGE = `'${SHEET_NAME}'`;

const HEADERS = ["id", "date", "name", "type", "createdAt", "updatedAt"] as const;

let sheetReady = false;
let sheetRequest: Promise<void> | null = null;

function nowIso(): string {
  return new Date().toISOString();
}

function rowToHoliday(row: string[]): CompanyHoliday | null {
  const id = String(row[0] ?? "").trim();
  const date = String(row[1] ?? "").trim();
  const name = String(row[2] ?? "").trim();
  const type = String(row[3] ?? "")
    .trim()
    .toLowerCase();

  if (!id || !date || !name) return null;
  if (type !== "leave" && type !== "celebration") return null;

  return { id, date, name, type };
}

async function ensureSheet(): Promise<void> {
  if (sheetReady) return;
  if (sheetRequest) return sheetRequest;

  sheetRequest = (async () => {
    const metadata = await sheets.spreadsheets.get({
      spreadsheetId,
      fields: "sheets.properties",
    });
    const exists = metadata.data.sheets?.some((sheet) => sheet.properties?.title === SHEET_NAME);

    if (!exists) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [{ addSheet: { properties: { title: SHEET_NAME } } }],
        },
      });
    }

    const headerResponse = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${SHEET_RANGE}!1:1`,
    });
    const headerRow = (headerResponse.data.values?.[0] as string[] | undefined) ?? [];
    const headersMatch = HEADERS.every(
      (header, index) => String(headerRow[index] ?? "").trim() === header,
    );

    if (!headersMatch) {
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${SHEET_RANGE}!A1`,
        valueInputOption: "RAW",
        requestBody: { values: [[...HEADERS]] },
      });
      await applySheetHeaderFormatByTitle(spreadsheetId, SHEET_NAME, HEADERS.length);
    }

    const dataResponse = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${SHEET_RANGE}!A2:F`,
    });
    const existingRows = dataResponse.data.values ?? [];

    if (existingRows.length === 0) {
      const createdAt = nowIso();
      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: `${SHEET_RANGE}!A:F`,
        valueInputOption: "USER_ENTERED",
        requestBody: {
          values: COMPANY_HOLIDAYS_2026.map((holiday) => [
            holiday.id,
            holiday.date,
            holiday.name,
            holiday.type,
            createdAt,
            createdAt,
          ]),
        },
      });
    }

    sheetReady = true;
  })().finally(() => {
    sheetRequest = null;
  });

  return sheetRequest;
}

async function readRows(): Promise<string[][]> {
  await ensureSheet();
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${SHEET_RANGE}!A2:F`,
  });
  return (response.data.values as string[][] | undefined) ?? [];
}

export async function listCompanyHolidays(year?: number): Promise<CompanyHoliday[]> {
  const rows = await readRows();
  return rows
    .map(rowToHoliday)
    .filter((holiday): holiday is CompanyHoliday => {
      if (!holiday) return false;
      return year == null || holiday.date.startsWith(`${year}-`);
    })
    .sort((a, b) => a.date.localeCompare(b.date));
}

export async function createCompanyHoliday(input: {
  date: string;
  name: string;
  type: CompanyHoliday["type"];
}): Promise<CompanyHoliday> {
  await ensureSheet();
  const holiday: CompanyHoliday = {
    id: randomUUID(),
    date: input.date,
    name: input.name,
    type: input.type,
  };
  const timestamp = nowIso();

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${SHEET_RANGE}!A:F`,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [[holiday.id, holiday.date, holiday.name, holiday.type, timestamp, timestamp]],
    },
  });

  return holiday;
}

export async function updateCompanyHoliday(input: CompanyHoliday): Promise<CompanyHoliday | null> {
  const rows = await readRows();
  const rowIndex = rows.findIndex((row) => String(row[0] ?? "").trim() === input.id);
  if (rowIndex < 0) return null;

  const existing = rows[rowIndex] ?? [];
  const sheetRow = rowIndex + 2;
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${SHEET_RANGE}!A${sheetRow}:F${sheetRow}`,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [
        [
          input.id,
          input.date,
          input.name,
          input.type,
          String(existing[4] ?? "").trim() || nowIso(),
          nowIso(),
        ],
      ],
    },
  });

  return input;
}

export async function deleteCompanyHoliday(id: string): Promise<boolean> {
  const rows = await readRows();
  const rowIndex = rows.findIndex((row) => String(row[0] ?? "").trim() === id);
  if (rowIndex < 0) return false;

  const sheetRow = rowIndex + 2;
  await sheets.spreadsheets.values.clear({
    spreadsheetId,
    range: `${SHEET_RANGE}!A${sheetRow}:F${sheetRow}`,
  });

  return true;
}
