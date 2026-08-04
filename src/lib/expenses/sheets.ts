import { randomUUID } from "node:crypto";

import { sheets } from "@/lib/google/auth";
import { applySheetHeaderFormatByTitle } from "@/lib/google/sheet-format";
import {
  EXPENSE_PAYMENT_MODES,
  EXPENSE_STATUS,
  EXPENSE_TYPES,
  isExpensePaymentMode,
  isExpenseStatus,
  sheetNameForType,
  validateExpenseCategory,
  validateExpenseDueDate,
  validateExpensePaymentMode,
  type CreateExpenseInput,
  type ExpensePaymentMode,
  type ExpenseRecord,
  type ExpenseStatus,
  type ExpenseType,
  type UpdateExpenseInput,
} from "@/lib/expenses/types";

const spreadsheetId = process.env.GOOGLE_SHEET_ID as string;

/** Newer columns are appended so existing expense rows stay aligned. */
const HEADERS = [
  "id",
  "category",
  "title",
  "amount",
  "month",
  "year",
  "notes",
  "createdBy",
  "createdAt",
  "updatedAt",
  "status",
  "rejectionReason",
  "paidBy",
  "paidAt",
  "rejectedBy",
  "rejectedAt",
  "paymentMode",
  "dueDate",
] as const;

const SCHEMA_VERSION = "v3-due-date";
const readyBySheet = new Map<string, boolean>();
const requestBySheet = new Map<string, Promise<void>>();

function nowIso(): string {
  return new Date().toISOString();
}

function sheetRange(type: ExpenseType): string {
  return `'${sheetNameForType(type)}'`;
}

function roundAmount(amount: number): number {
  return Math.round(amount * 100) / 100;
}

function recordToRow(record: ExpenseRecord): string[] {
  return [
    record.id,
    record.category,
    record.title,
    String(record.amount),
    String(record.month),
    String(record.year),
    record.notes,
    record.createdBy,
    record.createdAt,
    record.updatedAt,
    record.status,
    record.rejectionReason,
    record.paidBy,
    record.paidAt,
    record.rejectedBy,
    record.rejectedAt,
    record.paymentMode,
    record.dueDate,
  ];
}

function parseStatus(raw: string): ExpenseStatus {
  const value = raw.trim();
  if (isExpenseStatus(value)) return value;
  return EXPENSE_STATUS.PENDING;
}

function parsePaymentMode(raw: string): ExpensePaymentMode {
  const value = raw.trim();
  if (isExpensePaymentMode(value)) return value;
  return EXPENSE_PAYMENT_MODES.ONLINE;
}

function rowToRecord(row: string[], type: ExpenseType): ExpenseRecord | null {
  const id = String(row[0] ?? "").trim();
  const category = String(row[1] ?? "").trim();
  const title = String(row[2] ?? "").trim();
  const amount = Number(String(row[3] ?? "").replace(/,/g, ""));
  const month = Number(row[4] ?? 0);
  const year = Number(row[5] ?? 0);
  const notes = String(row[6] ?? "").trim();
  const createdBy = String(row[7] ?? "").trim();
  const createdAt = String(row[8] ?? "").trim();
  const updatedAt = String(row[9] ?? "").trim();
  const status = parseStatus(String(row[10] ?? ""));
  const rejectionReason = String(row[11] ?? "").trim();
  const paidBy = String(row[12] ?? "").trim();
  const paidAt = String(row[13] ?? "").trim();
  const rejectedBy = String(row[14] ?? "").trim();
  const rejectedAt = String(row[15] ?? "").trim();
  const paymentMode = parsePaymentMode(String(row[16] ?? ""));
  const dueDate = String(row[17] ?? "").trim();

  if (!id || !category || !title) return null;
  if (!Number.isFinite(amount) || amount <= 0) return null;
  if (!Number.isInteger(month) || month < 1 || month > 12) return null;
  if (!Number.isInteger(year) || year < 2000 || year > 2100) return null;

  return {
    id,
    type,
    category,
    title,
    amount: roundAmount(amount),
    month,
    year,
    dueDate,
    paymentMode,
    notes,
    status,
    rejectionReason,
    paidBy,
    paidAt,
    rejectedBy,
    rejectedAt,
    createdBy,
    createdAt,
    updatedAt,
  };
}

async function ensureSheet(type: ExpenseType): Promise<void> {
  const sheetName = sheetNameForType(type);
  const readyKey = `${sheetName}:${SCHEMA_VERSION}`;
  if (readyBySheet.get(readyKey)) return;

  const inflight = requestBySheet.get(readyKey);
  if (inflight) return inflight;

  const request = (async () => {
    const metadata = await sheets.spreadsheets.get({
      spreadsheetId,
      fields: "sheets.properties",
    });
    const exists = metadata.data.sheets?.some((sheet) => sheet.properties?.title === sheetName);

    if (!exists) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [{ addSheet: { properties: { title: sheetName } } }],
        },
      });
    }

    const range = sheetRange(type);
    const headerResponse = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${range}!1:1`,
    });
    const headerRow = (headerResponse.data.values?.[0] as string[] | undefined) ?? [];
    const headersMatch = HEADERS.every(
      (header, index) => String(headerRow[index] ?? "").trim() === header,
    );

    if (!headersMatch) {
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${range}!A1`,
        valueInputOption: "RAW",
        requestBody: { values: [[...HEADERS]] },
      });
      await applySheetHeaderFormatByTitle(spreadsheetId, sheetName, HEADERS.length);
    }

    readyBySheet.set(readyKey, true);
  })().finally(() => {
    requestBySheet.delete(readyKey);
  });

  requestBySheet.set(readyKey, request);
  return request;
}

async function getSheetId(type: ExpenseType): Promise<number> {
  await ensureSheet(type);
  const sheetName = sheetNameForType(type);
  const metadata = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: "sheets.properties",
  });
  const sheet = metadata.data.sheets?.find((row) => row.properties?.title === sheetName);
  const sheetId = sheet?.properties?.sheetId;
  if (sheetId == null) throw new Error(`Sheet "${sheetName}" not found`);
  return sheetId;
}

async function readRawRows(type: ExpenseType): Promise<string[][]> {
  await ensureSheet(type);
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${sheetRange(type)}!A2:R10000`,
  });
  return (response.data.values as string[][] | undefined) ?? [];
}

async function writeRecord(
  type: ExpenseType,
  sheetRow: number,
  record: ExpenseRecord,
): Promise<void> {
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${sheetRange(type)}!A${sheetRow}:R${sheetRow}`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [recordToRow(record)] },
  });
}

function sortExpenses(records: ExpenseRecord[]): ExpenseRecord[] {
  return [...records].sort((left, right) => {
    if (left.year !== right.year) return right.year - left.year;
    if (left.month !== right.month) return right.month - left.month;
    return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
  });
}

export async function listExpenses(params?: {
  type?: ExpenseType;
  year?: number;
  month?: number;
}): Promise<ExpenseRecord[]> {
  const types: ExpenseType[] = params?.type
    ? [params.type]
    : [EXPENSE_TYPES.DEFAULT, EXPENSE_TYPES.RECURRING];

  const batches = await Promise.all(
    types.map(async (type) => {
      const rows = await readRawRows(type);
      return rows
        .map((row) => rowToRecord(row, type))
        .filter((row): row is ExpenseRecord => Boolean(row));
    }),
  );

  return sortExpenses(
    batches.flat().filter((expense) => {
      if (params?.year != null && expense.year !== params.year) return false;
      if (params?.month != null && expense.month !== params.month) return false;
      return true;
    }),
  );
}

/**
 * Pending amounts roll into default/recurring totals.
 * Paid amounts roll into totalPaid only.
 * Rejected amounts are excluded from money totals.
 */
export function summarizeExpenses(expenses: ExpenseRecord[]): {
  count: number;
  pendingCount: number;
  paidCount: number;
  rejectedCount: number;
  totalPaid: number;
  defaultTotal: number;
  recurringTotal: number;
} {
  let pendingCount = 0;
  let paidCount = 0;
  let rejectedCount = 0;
  let totalPaid = 0;
  let defaultTotal = 0;
  let recurringTotal = 0;

  for (const expense of expenses) {
    if (expense.status === EXPENSE_STATUS.PAID) {
      paidCount += 1;
      totalPaid += expense.amount;
      continue;
    }
    if (expense.status === EXPENSE_STATUS.REJECTED) {
      rejectedCount += 1;
      continue;
    }

    pendingCount += 1;
    if (expense.type === EXPENSE_TYPES.DEFAULT) defaultTotal += expense.amount;
    else recurringTotal += expense.amount;
  }

  return {
    count: expenses.length,
    pendingCount,
    paidCount,
    rejectedCount,
    totalPaid: roundAmount(totalPaid),
    defaultTotal: roundAmount(defaultTotal),
    recurringTotal: roundAmount(recurringTotal),
  };
}

export async function createExpense(input: CreateExpenseInput): Promise<ExpenseRecord> {
  const category = validateExpenseCategory(input.type, input.category);
  const paymentMode = validateExpensePaymentMode(input.paymentMode);
  const dueDate = validateExpenseDueDate(input.type, input.dueDate);
  const title = input.title.trim();
  const notes = String(input.notes ?? "").trim();
  const amount = roundAmount(Number(input.amount));
  const month = Number(input.month);
  const year = Number(input.year);

  if (!title) throw new Error("Title is required");
  if (!(amount > 0)) throw new Error("Amount must be greater than 0");
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error("Valid month is required");
  }
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    throw new Error("Valid year is required");
  }

  const now = nowIso();
  const record: ExpenseRecord = {
    id: randomUUID(),
    type: input.type,
    category,
    title,
    amount,
    month,
    year,
    dueDate,
    paymentMode,
    notes,
    status: EXPENSE_STATUS.PENDING,
    rejectionReason: "",
    paidBy: "",
    paidAt: "",
    rejectedBy: "",
    rejectedAt: "",
    createdBy: input.createdBy.trim(),
    createdAt: now,
    updatedAt: now,
  };

  await ensureSheet(input.type);
  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${sheetRange(input.type)}!A:R`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [recordToRow(record)] },
  });

  return record;
}

async function findExpenseRow(
  id: string,
  type: ExpenseType,
): Promise<{ index: number; existing: ExpenseRecord }> {
  const rows = await readRawRows(type);
  const index = rows.findIndex((row) => String(row[0] ?? "").trim() === id.trim());
  if (index < 0) throw new Error("Expense not found");

  const existing = rowToRecord(rows[index] ?? [], type);
  if (!existing) throw new Error("Expense not found");
  return { index, existing };
}

export async function updateExpense(input: UpdateExpenseInput): Promise<ExpenseRecord> {
  const { index, existing } = await findExpenseRow(input.id, input.type);

  if (existing.status !== EXPENSE_STATUS.PENDING) {
    throw new Error("Only pending expenses can be edited");
  }

  const category = validateExpenseCategory(input.type, input.category);
  const paymentMode = validateExpensePaymentMode(input.paymentMode);
  const dueDate = validateExpenseDueDate(input.type, input.dueDate);
  const title = input.title.trim();
  const notes = String(input.notes ?? "").trim();
  const amount = roundAmount(Number(input.amount));
  const month = Number(input.month);
  const year = Number(input.year);

  if (!title) throw new Error("Title is required");
  if (!(amount > 0)) throw new Error("Amount must be greater than 0");
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error("Valid month is required");
  }
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    throw new Error("Valid year is required");
  }

  const updated: ExpenseRecord = {
    ...existing,
    category,
    title,
    amount,
    month,
    year,
    dueDate,
    paymentMode,
    notes,
    updatedAt: nowIso(),
  };

  await writeRecord(input.type, index + 2, updated);
  return updated;
}

export async function markExpensePaid(input: {
  id: string;
  type: ExpenseType;
  paidBy: string;
}): Promise<ExpenseRecord> {
  const { index, existing } = await findExpenseRow(input.id, input.type);

  if (existing.status === EXPENSE_STATUS.PAID) return existing;
  if (existing.status === EXPENSE_STATUS.REJECTED) {
    throw new Error("Rejected expenses cannot be marked as paid");
  }

  const now = nowIso();
  const updated: ExpenseRecord = {
    ...existing,
    status: EXPENSE_STATUS.PAID,
    rejectionReason: "",
    paidBy: input.paidBy.trim(),
    paidAt: now,
    rejectedBy: "",
    rejectedAt: "",
    updatedAt: now,
  };

  await writeRecord(input.type, index + 2, updated);
  return updated;
}

export async function rejectExpense(input: {
  id: string;
  type: ExpenseType;
  reason: string;
  rejectedBy: string;
}): Promise<ExpenseRecord> {
  const reason = input.reason.trim();
  if (!reason) throw new Error("Rejection reason is required");

  const { index, existing } = await findExpenseRow(input.id, input.type);

  if (existing.status === EXPENSE_STATUS.REJECTED) {
    return { ...existing, rejectionReason: reason || existing.rejectionReason };
  }
  if (existing.status === EXPENSE_STATUS.PAID) {
    throw new Error("Paid expenses cannot be rejected");
  }

  const now = nowIso();
  const updated: ExpenseRecord = {
    ...existing,
    status: EXPENSE_STATUS.REJECTED,
    rejectionReason: reason,
    rejectedBy: input.rejectedBy.trim(),
    rejectedAt: now,
    paidBy: "",
    paidAt: "",
    updatedAt: now,
  };

  await writeRecord(input.type, index + 2, updated);
  return updated;
}

export async function deleteExpense(id: string, type: ExpenseType): Promise<boolean> {
  const rows = await readRawRows(type);
  const index = rows.findIndex((row) => String(row[0] ?? "").trim() === id.trim());
  if (index < 0) return false;

  const existing = rowToRecord(rows[index] ?? [], type);
  if (existing?.status === EXPENSE_STATUS.PAID) {
    throw new Error("Paid expenses cannot be deleted");
  }

  const sheetId = await getSheetId(type);
  const sheetRow = index + 2;
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          deleteDimension: {
            range: {
              sheetId,
              dimension: "ROWS",
              startIndex: sheetRow - 1,
              endIndex: sheetRow,
            },
          },
        },
      ],
    },
  });

  return true;
}
