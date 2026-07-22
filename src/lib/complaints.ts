import { randomUUID } from "node:crypto";

import { sheets } from "@/lib/google/auth";
import { applySheetHeaderFormatByTitle } from "@/lib/google/sheet-format";

const spreadsheetId = process.env.GOOGLE_SHEET_ID as string;
const SHEET_NAME = "Complaints";
const SHEET_RANGE = `'${SHEET_NAME}'`;

const HEADERS = [
  "id",
  "submitterSheetRow",
  "submitterEmployeeId",
  "submitterName",
  "subject",
  "category",
  "severity",
  "details",
  "status",
  "reviewNote",
  "reviewedBySheetRow",
  "reviewedByName",
  "createdAt",
  "updatedAt",
  "reviewedAt",
] as const;

export const COMPLAINT_CATEGORIES = ["workplace", "it", "people", "facilities", "other"] as const;
export const COMPLAINT_SEVERITIES = ["low", "normal", "high"] as const;
export const COMPLAINT_STATUSES = ["Pending", "Approved", "Rejected"] as const;

export type ComplaintCategory = (typeof COMPLAINT_CATEGORIES)[number];
export type ComplaintSeverity = (typeof COMPLAINT_SEVERITIES)[number];
export type ComplaintStatus = (typeof COMPLAINT_STATUSES)[number];

export type ComplaintRecord = {
  id: string;
  submitterSheetRow: number;
  submitterEmployeeId: string;
  submitterName: string;
  subject: string;
  category: ComplaintCategory;
  severity: ComplaintSeverity;
  details: string;
  status: ComplaintStatus;
  reviewNote: string;
  reviewedBySheetRow: number | null;
  reviewedByName: string;
  createdAt: string;
  updatedAt: string;
  reviewedAt: string;
};

let sheetReady = false;
let sheetRequest: Promise<void> | null = null;

function nowIso(): string {
  return new Date().toISOString();
}

function recordToRow(record: ComplaintRecord): string[] {
  return [
    record.id,
    String(record.submitterSheetRow),
    record.submitterEmployeeId,
    record.submitterName,
    record.subject,
    record.category,
    record.severity,
    record.details,
    record.status,
    record.reviewNote,
    record.reviewedBySheetRow == null ? "" : String(record.reviewedBySheetRow),
    record.reviewedByName,
    record.createdAt,
    record.updatedAt,
    record.reviewedAt,
  ];
}

function rowToRecord(row: string[]): ComplaintRecord | null {
  const id = String(row[0] ?? "").trim();
  const submitterSheetRow = Number(row[1]);
  const category = String(row[5] ?? "").trim() as ComplaintCategory;
  const severity = String(row[6] ?? "").trim() as ComplaintSeverity;
  const status = String(row[8] ?? "").trim() as ComplaintStatus;
  if (!id || !Number.isInteger(submitterSheetRow) || submitterSheetRow < 2) return null;
  if (!COMPLAINT_CATEGORIES.includes(category)) return null;
  if (!COMPLAINT_SEVERITIES.includes(severity)) return null;
  if (!COMPLAINT_STATUSES.includes(status)) return null;

  const reviewedBySheetRow = Number(row[10]);
  return {
    id,
    submitterSheetRow,
    submitterEmployeeId: String(row[2] ?? "").trim(),
    submitterName: String(row[3] ?? "").trim() || "Employee",
    subject: String(row[4] ?? "").trim(),
    category,
    severity,
    details: String(row[7] ?? "").trim(),
    status,
    reviewNote: String(row[9] ?? "").trim(),
    reviewedBySheetRow:
      Number.isInteger(reviewedBySheetRow) && reviewedBySheetRow >= 2 ? reviewedBySheetRow : null,
    reviewedByName: String(row[11] ?? "").trim(),
    createdAt: String(row[12] ?? "").trim(),
    updatedAt: String(row[13] ?? "").trim(),
    reviewedAt: String(row[14] ?? "").trim(),
  };
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

    const current = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${SHEET_RANGE}!1:1`,
    });
    const headerRow = (current.data.values?.[0] as string[] | undefined) ?? [];
    const matches = HEADERS.every(
      (header, index) => String(headerRow[index] ?? "").trim() === header,
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

async function readRows(): Promise<string[][]> {
  await ensureSheet();
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${SHEET_RANGE}!A2:O10000`,
  });
  return (response.data.values as string[][] | undefined) ?? [];
}

export async function listComplaints(): Promise<ComplaintRecord[]> {
  const rows = await readRows();
  return rows
    .map(rowToRecord)
    .filter((record): record is ComplaintRecord => Boolean(record))
    .sort(
      (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
    );
}

export async function createComplaint(input: {
  submitterSheetRow: number;
  submitterEmployeeId: string;
  submitterName: string;
  subject: string;
  category: ComplaintCategory;
  severity: ComplaintSeverity;
  details: string;
}): Promise<ComplaintRecord> {
  await ensureSheet();
  const timestamp = nowIso();
  const complaint: ComplaintRecord = {
    id: randomUUID(),
    ...input,
    status: "Pending",
    reviewNote: "",
    reviewedBySheetRow: null,
    reviewedByName: "",
    createdAt: timestamp,
    updatedAt: timestamp,
    reviewedAt: "",
  };

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${SHEET_RANGE}!A:O`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [recordToRow(complaint)] },
  });
  return complaint;
}

export async function reviewComplaint(input: {
  id: string;
  status: "Approved" | "Rejected";
  reviewNote: string;
  reviewedBySheetRow: number;
  reviewedByName: string;
}): Promise<{ complaint: ComplaintRecord | null; alreadyReviewed: boolean }> {
  const rows = await readRows();
  const rowIndex = rows.findIndex((row) => String(row[0] ?? "").trim() === input.id);
  if (rowIndex < 0) return { complaint: null, alreadyReviewed: false };

  const current = rowToRecord(rows[rowIndex] ?? []);
  if (!current) return { complaint: null, alreadyReviewed: false };
  if (current.status !== "Pending") {
    return { complaint: current, alreadyReviewed: true };
  }

  const timestamp = nowIso();
  const complaint: ComplaintRecord = {
    ...current,
    status: input.status,
    reviewNote: input.reviewNote,
    reviewedBySheetRow: input.reviewedBySheetRow,
    reviewedByName: input.reviewedByName,
    updatedAt: timestamp,
    reviewedAt: timestamp,
  };
  const sheetRow = rowIndex + 2;
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${SHEET_RANGE}!A${sheetRow}:O${sheetRow}`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [recordToRow(complaint)] },
  });
  return { complaint, alreadyReviewed: false };
}
