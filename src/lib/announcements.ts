import { randomUUID } from "node:crypto";

import { sheets } from "@/lib/google/auth";
import { applySheetHeaderFormatByTitle } from "@/lib/google/sheet-format";

export type AnnouncementCategory = "general" | "office_leave" | "important";

export type AnnouncementRecord = {
  id: string;
  title: string;
  message: string;
  category: AnnouncementCategory;
  authorSheetRow: number;
  authorName: string;
  recipientCount: number;
  createdAt: string;
};

const spreadsheetId = process.env.GOOGLE_SHEET_ID as string;
const SHEET_NAME = "Announcements";
const SHEET_RANGE = `'${SHEET_NAME}'`;
const HEADERS = [
  "id",
  "title",
  "message",
  "category",
  "authorSheetRow",
  "authorName",
  "recipientCount",
  "createdAt",
] as const;

let sheetReady = false;
let sheetRequest: Promise<void> | null = null;

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

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${SHEET_RANGE}!1:1`,
    });
    const current = (response.data.values?.[0] as string[] | undefined) ?? [];
    const matches = HEADERS.every(
      (header, index) => String(current[index] ?? "").trim() === header,
    );

    if (!matches) {
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${SHEET_RANGE}!A1`,
        valueInputOption: "RAW",
        requestBody: { values: [[...HEADERS]] },
      });
      await applySheetHeaderFormatByTitle(spreadsheetId, SHEET_NAME, HEADERS.length);
    }

    sheetReady = true;
  })().finally(() => {
    sheetRequest = null;
  });

  return sheetRequest;
}

function rowToAnnouncement(row: string[]): AnnouncementRecord | null {
  const id = String(row[0] ?? "").trim();
  const title = String(row[1] ?? "").trim();
  const message = String(row[2] ?? "").trim();
  const category = String(row[3] ?? "").trim() as AnnouncementCategory;
  if (!id || !title || !message) return null;
  if (category !== "general" && category !== "office_leave" && category !== "important") {
    return null;
  }

  return {
    id,
    title,
    message,
    category,
    authorSheetRow: Number(row[4]) || 0,
    authorName: String(row[5] ?? "").trim(),
    recipientCount: Number(row[6]) || 0,
    createdAt: String(row[7] ?? "").trim(),
  };
}

export async function listAnnouncements(): Promise<AnnouncementRecord[]> {
  await ensureSheet();
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${SHEET_RANGE}!A2:H`,
  });

  return ((response.data.values as string[][] | undefined) ?? [])
    .map(rowToAnnouncement)
    .filter((record): record is AnnouncementRecord => Boolean(record))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function createAnnouncement(input: {
  title: string;
  message: string;
  category: AnnouncementCategory;
  authorSheetRow: number;
  authorName: string;
  recipientCount: number;
}): Promise<AnnouncementRecord> {
  await ensureSheet();
  const record: AnnouncementRecord = {
    id: randomUUID(),
    ...input,
    createdAt: new Date().toISOString(),
  };

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${SHEET_RANGE}!A:H`,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [
        [
          record.id,
          record.title,
          record.message,
          record.category,
          record.authorSheetRow,
          record.authorName,
          record.recipientCount,
          record.createdAt,
        ],
      ],
    },
  });

  return record;
}
