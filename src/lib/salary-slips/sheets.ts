import { randomUUID } from "node:crypto";

import { sheets } from "@/lib/google/auth";

import {
  SALARY_HISTORY_SHEET_NAME,
  SALARY_SLIPS_SHEET_NAME,
  type SalaryHistoryRecord,
  type SalarySlipRecord,
} from "./types";

const spreadsheetId = process.env.GOOGLE_SHEET_ID as string;

const SALARY_HISTORY_HEADERS = [
  "employeeSheetRow",
  "effectiveFrom",
  "effectiveTo",
  "basic",
  "hra",
  "organisationAllowance",
  "loyaltyBonus",
  "professionalTax",
  "lwf",
  "revisionNote",
  "status",
  "createdAt",
  "updatedAt",
] as const;

const SALARY_SLIPS_HEADERS = [
  "slipId",
  "employeeSheetRow",
  "year",
  "month",
  "title",
  "workingDays",
  "netPayableDays",
  "basic",
  "hra",
  "organisationAllowance",
  "totalEarnings",
  "loyaltyBonus",
  "professionalTax",
  "lwf",
  "totalDeductions",
  "netPay",
  "amountInWords",
  "status",
  "driveFileId",
  "driveFileName",
  "driveParentFolderId",
  "createdAt",
  "releasedAt",
  "deletedAt",
] as const;

function nowIso(): string {
  return new Date().toISOString();
}

function asNumber(value: string): number {
  const n = Number(
    String(value ?? "")
      .replace(/,/g, "")
      .trim(),
  );
  return Number.isFinite(n) ? n : 0;
}

function normalizeDateOnly(value: string): string {
  const v = String(value ?? "").trim();
  if (!v) return "";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

async function getSheetMeta() {
  const response = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: "sheets.properties",
  });
  return response.data.sheets ?? [];
}

async function ensureSheetExists(title: string): Promise<void> {
  const all = await getSheetMeta();
  const exists = all.some((s) => s.properties?.title === title);
  if (exists) return;

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [{ addSheet: { properties: { title } } }],
    },
  });
}

async function ensureHeaders(title: string, headers: readonly string[]): Promise<void> {
  await ensureSheetExists(title);
  const range = `${title}!1:1`;
  const current = await sheets.spreadsheets.values.get({ spreadsheetId, range });
  const headerRow = (current.data.values?.[0] as string[] | undefined) ?? [];
  const same =
    headerRow.length >= headers.length &&
    headers.every((h, i) => String(headerRow[i] ?? "").trim() === h);
  if (same) return;

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${title}!A1`,
    valueInputOption: "RAW",
    requestBody: { values: [headers as readonly string[]] },
  });
}

function sheetRowRange(title: string, row: number, colCount: number): string {
  const end = columnIndexToLetter(colCount);
  return `${title}!A${row}:${end}${row}`;
}

function columnIndexToLetter(columnCount: number): string {
  let letter = "";
  let n = Math.max(1, columnCount);
  while (n > 0) {
    const rem = (n - 1) % 26;
    letter = String.fromCharCode(65 + rem) + letter;
    n = Math.floor((n - 1) / 26);
  }
  return letter;
}

async function readRows(title: string): Promise<string[][]> {
  await ensureSheetExists(title);
  const data = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: title,
  });
  return (data.data.values as string[][] | undefined) ?? [];
}

function readCell(row: string[], headers: readonly string[], key: string): string {
  const idx = headers.indexOf(key);
  return idx >= 0 ? String(row[idx] ?? "") : "";
}

export async function listSalaryHistoryRecords(): Promise<SalaryHistoryRecord[]> {
  await ensureHeaders(SALARY_HISTORY_SHEET_NAME, SALARY_HISTORY_HEADERS);
  const rows = await readRows(SALARY_HISTORY_SHEET_NAME);
  if (rows.length <= 1) return [];

  return rows.slice(1).map((row, i) => ({
    sheetRow: i + 2,
    employeeSheetRow: asNumber(readCell(row, SALARY_HISTORY_HEADERS, "employeeSheetRow")),
    effectiveFrom: normalizeDateOnly(readCell(row, SALARY_HISTORY_HEADERS, "effectiveFrom")),
    effectiveTo: normalizeDateOnly(readCell(row, SALARY_HISTORY_HEADERS, "effectiveTo")),
    basic: asNumber(readCell(row, SALARY_HISTORY_HEADERS, "basic")),
    hra: asNumber(readCell(row, SALARY_HISTORY_HEADERS, "hra")),
    organisationAllowance: asNumber(readCell(row, SALARY_HISTORY_HEADERS, "organisationAllowance")),
    loyaltyBonus: asNumber(readCell(row, SALARY_HISTORY_HEADERS, "loyaltyBonus")),
    professionalTax: asNumber(readCell(row, SALARY_HISTORY_HEADERS, "professionalTax")),
    lwf: asNumber(readCell(row, SALARY_HISTORY_HEADERS, "lwf")),
    revisionNote: readCell(row, SALARY_HISTORY_HEADERS, "revisionNote"),
    status:
      readCell(row, SALARY_HISTORY_HEADERS, "status").toLowerCase() === "inactive"
        ? "Inactive"
        : "Active",
    createdAt: readCell(row, SALARY_HISTORY_HEADERS, "createdAt"),
    updatedAt: readCell(row, SALARY_HISTORY_HEADERS, "updatedAt"),
  }));
}

export function assertNonOverlappingEffectiveRanges(records: SalaryHistoryRecord[]): void {
  const sorted = [...records].sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom));

  for (let i = 1; i < sorted.length; i += 1) {
    const prev = sorted[i - 1];
    const curr = sorted[i];
    const prevEnd = prev.effectiveTo || "9999-12-31";
    if (curr.effectiveFrom <= prevEnd) {
      throw new Error(
        `Salary history overlap detected (${prev.effectiveFrom}..${prevEnd}) and ${curr.effectiveFrom}`,
      );
    }
  }
}

export async function createSalaryHistoryRecord(input: {
  employeeSheetRow: number;
  effectiveFrom: string;
  effectiveTo?: string;
  basic: number;
  hra: number;
  organisationAllowance: number;
  loyaltyBonus: number;
  professionalTax: number;
  lwf: number;
  revisionNote?: string;
  status?: "Active" | "Inactive";
}) {
  await ensureHeaders(SALARY_HISTORY_SHEET_NAME, SALARY_HISTORY_HEADERS);
  const all = await listSalaryHistoryRecords();
  const employeeRows = all.filter((r) => r.employeeSheetRow === input.employeeSheetRow);
  const payload: SalaryHistoryRecord = {
    sheetRow: 0,
    employeeSheetRow: input.employeeSheetRow,
    effectiveFrom: normalizeDateOnly(input.effectiveFrom),
    effectiveTo: normalizeDateOnly(input.effectiveTo ?? ""),
    basic: input.basic,
    hra: input.hra,
    organisationAllowance: input.organisationAllowance,
    loyaltyBonus: Math.min(20, Math.max(0, input.loyaltyBonus)),
    professionalTax: input.professionalTax > 0 ? input.professionalTax : 200,
    lwf: input.lwf,
    revisionNote: input.revisionNote?.trim() ?? "",
    status: input.status ?? "Active",
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };

  if (!payload.effectiveFrom) {
    throw new Error("effectiveFrom is required (YYYY-MM-DD)");
  }

  assertNonOverlappingEffectiveRanges([...employeeRows, payload]);

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: SALARY_HISTORY_SHEET_NAME,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [
        [
          payload.employeeSheetRow,
          payload.effectiveFrom,
          payload.effectiveTo,
          payload.basic,
          payload.hra,
          payload.organisationAllowance,
          payload.loyaltyBonus,
          payload.professionalTax,
          payload.lwf,
          payload.revisionNote,
          payload.status,
          payload.createdAt,
          payload.updatedAt,
        ],
      ],
    },
  });
}

export async function findEffectiveSalaryForPeriod(args: {
  employeeSheetRow: number;
  periodStart: string;
  periodEnd: string;
}): Promise<SalaryHistoryRecord | null> {
  const records = await listSalaryHistoryRecords();
  const filtered = records
    .filter((r) => r.employeeSheetRow === args.employeeSheetRow && r.status === "Active")
    .filter((r) => r.effectiveFrom <= args.periodEnd)
    .filter((r) => !r.effectiveTo || r.effectiveTo >= args.periodStart)
    .sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom));
  return filtered[0] ?? null;
}

export async function listSalarySlips(): Promise<SalarySlipRecord[]> {
  await ensureHeaders(SALARY_SLIPS_SHEET_NAME, SALARY_SLIPS_HEADERS);
  const rows = await readRows(SALARY_SLIPS_SHEET_NAME);
  if (rows.length <= 1) return [];

  return rows.slice(1).map((row, i) => ({
    sheetRow: i + 2,
    slipId: readCell(row, SALARY_SLIPS_HEADERS, "slipId"),
    employeeSheetRow: asNumber(readCell(row, SALARY_SLIPS_HEADERS, "employeeSheetRow")),
    year: asNumber(readCell(row, SALARY_SLIPS_HEADERS, "year")),
    month: asNumber(readCell(row, SALARY_SLIPS_HEADERS, "month")),
    title: readCell(row, SALARY_SLIPS_HEADERS, "title"),
    workingDays: asNumber(readCell(row, SALARY_SLIPS_HEADERS, "workingDays")),
    netPayableDays: asNumber(readCell(row, SALARY_SLIPS_HEADERS, "netPayableDays")),
    basic: asNumber(readCell(row, SALARY_SLIPS_HEADERS, "basic")),
    hra: asNumber(readCell(row, SALARY_SLIPS_HEADERS, "hra")),
    organisationAllowance: asNumber(readCell(row, SALARY_SLIPS_HEADERS, "organisationAllowance")),
    totalEarnings: asNumber(readCell(row, SALARY_SLIPS_HEADERS, "totalEarnings")),
    loyaltyBonus: asNumber(readCell(row, SALARY_SLIPS_HEADERS, "loyaltyBonus")),
    professionalTax: asNumber(readCell(row, SALARY_SLIPS_HEADERS, "professionalTax")),
    lwf: asNumber(readCell(row, SALARY_SLIPS_HEADERS, "lwf")),
    totalDeductions: asNumber(readCell(row, SALARY_SLIPS_HEADERS, "totalDeductions")),
    netPay: asNumber(readCell(row, SALARY_SLIPS_HEADERS, "netPay")),
    amountInWords: readCell(row, SALARY_SLIPS_HEADERS, "amountInWords"),
    status:
      (readCell(row, SALARY_SLIPS_HEADERS, "status") as SalarySlipRecord["status"]) || "Draft",
    driveFileId: readCell(row, SALARY_SLIPS_HEADERS, "driveFileId"),
    driveFileName: readCell(row, SALARY_SLIPS_HEADERS, "driveFileName"),
    driveParentFolderId: readCell(row, SALARY_SLIPS_HEADERS, "driveParentFolderId"),
    createdAt: readCell(row, SALARY_SLIPS_HEADERS, "createdAt"),
    releasedAt: readCell(row, SALARY_SLIPS_HEADERS, "releasedAt"),
    deletedAt: readCell(row, SALARY_SLIPS_HEADERS, "deletedAt"),
  }));
}

export async function saveSalarySlipRecord(
  row: Omit<SalarySlipRecord, "sheetRow" | "slipId" | "createdAt"> & {
    slipId?: string;
    createdAt?: string;
  },
): Promise<string> {
  await ensureHeaders(SALARY_SLIPS_SHEET_NAME, SALARY_SLIPS_HEADERS);
  const slipId = row.slipId?.trim() || randomUUID();
  const createdAt = row.createdAt?.trim() || nowIso();
  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: SALARY_SLIPS_SHEET_NAME,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [
        [
          slipId,
          row.employeeSheetRow,
          row.year,
          row.month,
          row.title,
          row.workingDays,
          row.netPayableDays,
          row.basic,
          row.hra,
          row.organisationAllowance,
          row.totalEarnings,
          row.loyaltyBonus,
          row.professionalTax,
          row.lwf,
          row.totalDeductions,
          row.netPay,
          row.amountInWords,
          row.status,
          row.driveFileId,
          row.driveFileName,
          row.driveParentFolderId,
          createdAt,
          row.releasedAt,
          row.deletedAt,
        ],
      ],
    },
  });
  return slipId;
}

export async function updateSalarySlipRecord(
  sheetRow: number,
  patch: Partial<Pick<SalarySlipRecord, "status" | "deletedAt" | "driveFileId" | "driveFileName">>,
): Promise<void> {
  const records = await listSalarySlips();
  const current = records.find((r) => r.sheetRow === sheetRow);
  if (!current) throw new Error("Salary slip not found");
  const merged = { ...current, ...patch };
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: sheetRowRange(SALARY_SLIPS_SHEET_NAME, sheetRow, SALARY_SLIPS_HEADERS.length),
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [
        [
          merged.slipId,
          merged.employeeSheetRow,
          merged.year,
          merged.month,
          merged.title,
          merged.workingDays,
          merged.netPayableDays,
          merged.basic,
          merged.hra,
          merged.organisationAllowance,
          merged.totalEarnings,
          merged.loyaltyBonus,
          merged.professionalTax,
          merged.lwf,
          merged.totalDeductions,
          merged.netPay,
          merged.amountInWords,
          merged.status,
          merged.driveFileId,
          merged.driveFileName,
          merged.driveParentFolderId,
          merged.createdAt,
          merged.releasedAt,
          merged.deletedAt,
        ],
      ],
    },
  });
}
