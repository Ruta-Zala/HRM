import { randomUUID } from "node:crypto";

import { sheets } from "@/lib/google/auth";
import { applySheetHeaderFormatByTitle } from "@/lib/google/sheet-format";
import {
  compareYearMonth,
  remainingAfterPeriod,
  splitLockedAndOpenInstallments,
  validateAdvanceSchedule,
} from "@/lib/salary-advances/schedule";
import {
  SALARY_ADVANCE_STATUS,
  type CreateSalaryAdvanceInput,
  type SalaryAdvance,
  type SalaryAdvanceInstallment,
  type SalaryAdvanceStatus,
  type UpdateSalaryAdvanceInput,
} from "@/lib/salary-advances/types";

const spreadsheetId = process.env.GOOGLE_SHEET_ID as string;
const SHEET_NAME = "SalaryAdvances";
const SHEET_RANGE = `'${SHEET_NAME}'`;

const HEADERS = [
  "id",
  "employeeSheetRow",
  "employeeId",
  "employeeName",
  "totalAmount",
  "reason",
  "startYear",
  "startMonth",
  "installmentsJson",
  "status",
  "createdBy",
  "createdAt",
  "updatedAt",
] as const;

let sheetReady = false;
let sheetRequest: Promise<void> | null = null;

function nowIso(): string {
  return new Date().toISOString();
}

function parseInstallments(raw: string): SalaryAdvanceInstallment[] {
  try {
    const parsed = JSON.parse(raw || "[]") as SalaryAdvanceInstallment[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((row) => ({
        year: Number(row.year),
        month: Number(row.month),
        amount: Math.round((Number(row.amount) || 0) * 100) / 100,
      }))
      .filter(
        (row) =>
          Number.isInteger(row.year) &&
          Number.isInteger(row.month) &&
          row.month >= 1 &&
          row.month <= 12 &&
          row.amount > 0,
      );
  } catch {
    return [];
  }
}

function rowToAdvance(row: string[], sheetRow: number): SalaryAdvance | null {
  const id = String(row[0] ?? "").trim();
  const employeeSheetRow = Number(row[1] ?? sheetRow);
  const employeeId = String(row[2] ?? "").trim();
  const employeeName = String(row[3] ?? "").trim();
  const totalAmount = Number(String(row[4] ?? "").replace(/,/g, ""));
  const reason = String(row[5] ?? "").trim();
  const startYear = Number(row[6] ?? 0);
  const startMonth = Number(row[7] ?? 0);
  const installments = parseInstallments(String(row[8] ?? ""));
  const status = String(row[9] ?? "").trim() as SalaryAdvanceStatus;
  const createdBy = String(row[10] ?? "").trim();
  const createdAt = String(row[11] ?? "").trim();
  const updatedAt = String(row[12] ?? "").trim();

  if (!id || !employeeName || !Number.isFinite(totalAmount) || totalAmount <= 0) return null;
  if (
    status !== SALARY_ADVANCE_STATUS.ACTIVE &&
    status !== SALARY_ADVANCE_STATUS.COMPLETED &&
    status !== SALARY_ADVANCE_STATUS.CANCELLED
  ) {
    return null;
  }

  return {
    id,
    employeeSheetRow,
    employeeId,
    employeeName,
    totalAmount,
    reason,
    startYear,
    startMonth,
    installments,
    status,
    createdBy,
    createdAt,
    updatedAt,
  };
}

function advanceToRow(advance: SalaryAdvance): string[] {
  return [
    advance.id,
    String(advance.employeeSheetRow),
    advance.employeeId,
    advance.employeeName,
    String(advance.totalAmount),
    advance.reason,
    String(advance.startYear),
    String(advance.startMonth),
    JSON.stringify(advance.installments),
    advance.status,
    advance.createdBy,
    advance.createdAt,
    advance.updatedAt,
  ];
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

    sheetReady = true;
  })().finally(() => {
    sheetRequest = null;
  });

  return sheetRequest;
}

async function readRawRows(): Promise<string[][]> {
  await ensureSheet();
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${SHEET_RANGE}!A2:M`,
  });
  return (response.data.values as string[][] | undefined) ?? [];
}

function withDerivedStatus(advance: SalaryAdvance, asOf: Date = new Date()): SalaryAdvance {
  if (advance.status !== SALARY_ADVANCE_STATUS.ACTIVE) return advance;

  const asOfYm = { year: asOf.getFullYear(), month: asOf.getMonth() + 1 };
  const last = advance.installments[advance.installments.length - 1];
  if (!last) return advance;

  if (compareYearMonth(last, asOfYm) < 0) {
    return { ...advance, status: SALARY_ADVANCE_STATUS.COMPLETED };
  }
  return advance;
}

export async function listSalaryAdvances(params?: {
  employeeSheetRow?: number;
  status?: SalaryAdvanceStatus;
}): Promise<SalaryAdvance[]> {
  const rows = await readRawRows();
  const advances = rows
    .map((row, index) => rowToAdvance(row, index + 2))
    .filter((row): row is SalaryAdvance => Boolean(row))
    .map((row) => withDerivedStatus(row));

  return advances.filter((advance) => {
    if (params?.employeeSheetRow != null && advance.employeeSheetRow !== params.employeeSheetRow) {
      return false;
    }
    if (params?.status && advance.status !== params.status) return false;
    return true;
  });
}

function installmentAmountForPeriod(advance: SalaryAdvance, year: number, month: number): number {
  if (advance.status === SALARY_ADVANCE_STATUS.CANCELLED) {
    const cancelledAt = advance.updatedAt ? new Date(advance.updatedAt) : null;
    if (cancelledAt && !Number.isNaN(cancelledAt.getTime())) {
      const cancelYm = {
        year: cancelledAt.getFullYear(),
        month: cancelledAt.getMonth() + 1,
      };
      // Stop from the cancel month onward; earlier payroll months stay recoverable.
      if (compareYearMonth({ year, month }, cancelYm) >= 0) return 0;
    }
  }

  let amount = 0;
  for (const row of advance.installments) {
    if (row.year === year && row.month === month) amount += row.amount;
  }
  return Math.round(amount * 100) / 100;
}

export async function getSalaryAdvanceDeductionForPeriod(params: {
  employeeSheetRow: number;
  year: number;
  month: number;
}): Promise<number> {
  const advances = await listSalaryAdvances({
    employeeSheetRow: params.employeeSheetRow,
  });

  let total = 0;
  for (const advance of advances) {
    total += installmentAmountForPeriod(advance, params.year, params.month);
  }
  return Math.round(total * 100) / 100;
}

/** Preload advances once for a payroll period (skips cancelled months from cancel onward). */
export async function mapSalaryAdvanceDeductionsForPeriod(
  year: number,
  month: number,
): Promise<Map<number, number>> {
  const advances = await listSalaryAdvances();
  const map = new Map<number, number>();

  for (const advance of advances) {
    const amount = installmentAmountForPeriod(advance, year, month);
    if (amount <= 0) continue;
    map.set(
      advance.employeeSheetRow,
      Math.round(((map.get(advance.employeeSheetRow) ?? 0) + amount) * 100) / 100,
    );
  }

  return map;
}

export async function createSalaryAdvance(input: CreateSalaryAdvanceInput): Promise<SalaryAdvance> {
  const { installments } = validateAdvanceSchedule({
    totalAmount: input.totalAmount,
    startYear: input.startYear,
    startMonth: input.startMonth,
    segments: input.segments,
    lastIncrementDate: input.lastIncrementDate,
    joiningDate: input.joiningDate,
  });

  const now = nowIso();
  const advance: SalaryAdvance = {
    id: randomUUID(),
    employeeSheetRow: input.employeeSheetRow,
    employeeId: input.employeeId.trim(),
    employeeName: input.employeeName.trim(),
    totalAmount: Math.round(input.totalAmount * 100) / 100,
    reason: input.reason.trim(),
    startYear: input.startYear,
    startMonth: input.startMonth,
    installments,
    status: SALARY_ADVANCE_STATUS.ACTIVE,
    createdBy: input.createdBy.trim(),
    createdAt: now,
    updatedAt: now,
  };

  await ensureSheet();
  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${SHEET_RANGE}!A:M`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [advanceToRow(advance)] },
  });

  return advance;
}

export async function getSalaryAdvanceById(id: string): Promise<SalaryAdvance | null> {
  const rows = await readRawRows();
  const index = rows.findIndex((row) => String(row[0] ?? "").trim() === id.trim());
  if (index < 0) return null;
  const existing = rowToAdvance(rows[index] ?? [], index + 2);
  return existing ? withDerivedStatus(existing) : null;
}

export async function updateSalaryAdvance(input: UpdateSalaryAdvanceInput): Promise<SalaryAdvance> {
  const rows = await readRawRows();
  const index = rows.findIndex((row) => String(row[0] ?? "").trim() === input.id.trim());
  if (index < 0) throw new Error("Advance not found");

  const existing = rowToAdvance(rows[index] ?? [], index + 2);
  if (!existing) throw new Error("Advance not found");
  if (existing.status === SALARY_ADVANCE_STATUS.CANCELLED) {
    throw new Error("Cancelled advances cannot be edited");
  }

  const { locked, lockedTotal, openTotal } = splitLockedAndOpenInstallments(existing.installments);
  const remainingToSchedule = Math.round((existing.totalAmount - lockedTotal) * 100) / 100;

  if (!(remainingToSchedule > 0)) {
    throw new Error("Nothing left to reschedule — all installments are in past months");
  }

  // Guard against sheet/installment drift
  if (Math.abs(lockedTotal + openTotal - existing.totalAmount) > 0.05) {
    // Prefer totalAmount as source of truth for remaining
  }

  const reason = String(input.reason ?? "").trim();
  if (!reason) throw new Error("Reason is required");

  const { installments: openInstallments } = validateAdvanceSchedule({
    totalAmount: remainingToSchedule,
    startYear: input.startYear,
    startMonth: input.startMonth,
    segments: input.segments,
    lastIncrementDate: input.lastIncrementDate,
    joiningDate: input.joiningDate,
  });

  const installments = [...locked, ...openInstallments];
  const first = installments[0];

  const updated: SalaryAdvance = {
    ...existing,
    reason,
    startYear: first?.year ?? existing.startYear,
    startMonth: first?.month ?? existing.startMonth,
    installments,
    status: SALARY_ADVANCE_STATUS.ACTIVE,
    updatedAt: nowIso(),
  };

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${SHEET_RANGE}!A${index + 2}:M${index + 2}`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [advanceToRow(updated)] },
  });

  return updated;
}

export async function cancelSalaryAdvance(id: string): Promise<SalaryAdvance> {
  const rows = await readRawRows();
  const index = rows.findIndex((row) => String(row[0] ?? "").trim() === id.trim());
  if (index < 0) throw new Error("Advance not found");

  const existing = rowToAdvance(rows[index] ?? [], index + 2);
  if (!existing) throw new Error("Advance not found");
  if (existing.status === SALARY_ADVANCE_STATUS.CANCELLED) return existing;

  const updated: SalaryAdvance = {
    ...existing,
    status: SALARY_ADVANCE_STATUS.CANCELLED,
    updatedAt: nowIso(),
  };

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${SHEET_RANGE}!A${index + 2}:M${index + 2}`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [advanceToRow(updated)] },
  });

  return updated;
}

export function enrichAdvanceForDisplay(advance: SalaryAdvance, asOf: Date = new Date()) {
  const asOfYm = { year: asOf.getFullYear(), month: asOf.getMonth() + 1 };
  const remaining = remainingAfterPeriod(
    advance.totalAmount,
    advance.installments,
    asOfYm.year,
    asOfYm.month,
  );
  const paid = Math.round((advance.totalAmount - remaining) * 100) / 100;
  return {
    ...withDerivedStatus(advance, asOf),
    paidAmount: paid,
    remainingAmount: remaining,
    installmentCount: advance.installments.length,
  };
}
