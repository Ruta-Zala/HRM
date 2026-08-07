import {
  getLeaveBucketTemplateRows,
  migrateLeaveBucketRows,
  normalizeLeaveBucketRow,
} from "@/lib/attendance/leave-bucket-layout";
import { applyLeaveDatesToRows } from "@/lib/attendance/leave-bucket/operations";
import { mergeLeaveBucketCsvIntoRows } from "@/lib/attendance/leave-bucket/csv-import";
import { getAdminFirestore } from "@/lib/firebase/admin";
import { readLeaveBucketRows as readLeaveBucketRowsSheets } from "@/lib/google/attendance-sheets";

import type { LeaveBucketRepository, LeaveBucketStorageRef } from "./types";

const COLLECTION = "leave_buckets";

type LeaveBucketDoc = {
  /** Firestore does not allow nested arrays; store serialized rows instead. */
  rowsJson: string;
  updatedAt: number;
};

const bootstrapInflight = new Map<string, Promise<string[][]>>();

function leaveBucketDocRef(employeeId: string) {
  return getAdminFirestore().collection(COLLECTION).doc(employeeId.trim());
}

function normalizeRows(rows: string[][]): string[][] {
  return migrateLeaveBucketRows(rows).map((row) => normalizeLeaveBucketRow(row));
}

function parseStoredRows(data: Record<string, unknown> | undefined): string[][] | null {
  if (!data) return null;

  const rowsJson = data.rowsJson;
  if (typeof rowsJson === "string" && rowsJson.trim()) {
    try {
      const parsed = JSON.parse(rowsJson) as unknown;
      if (Array.isArray(parsed) && parsed.length > 0) {
        return normalizeRows(parsed as string[][]);
      }
    } catch {
      return null;
    }
  }

  // Legacy shape from an earlier attempt (nested arrays — not writable in Firestore).
  const legacyRows = data.rows;
  if (Array.isArray(legacyRows) && legacyRows.length > 0) {
    return normalizeRows(legacyRows as string[][]);
  }

  return null;
}

async function persistRows(ref: LeaveBucketStorageRef, rows: string[][]): Promise<void> {
  const normalized = normalizeRows(rows);
  const payload: LeaveBucketDoc = {
    rowsJson: JSON.stringify(normalized),
    updatedAt: Date.now(),
  };
  await leaveBucketDocRef(ref.employeeId).set(payload, { merge: true });
}

async function bootstrapFromSheets(ref: LeaveBucketStorageRef): Promise<string[][]> {
  const spreadsheetId = ref.spreadsheetId?.trim();
  if (!spreadsheetId) {
    return normalizeRows(getLeaveBucketTemplateRows());
  }

  try {
    const rows = normalizeRows(await readLeaveBucketRowsSheets(spreadsheetId));
    await persistRows(ref, rows);
    return rows;
  } catch (error) {
    console.warn(
      `[leave-bucket/firestore] bootstrap from sheets failed for ${ref.employeeId}:`,
      error,
    );
    return normalizeRows(getLeaveBucketTemplateRows());
  }
}

async function ensureBootstrapped(ref: LeaveBucketStorageRef): Promise<string[][]> {
  const employeeId = ref.employeeId.trim();
  if (!employeeId) {
    throw new Error("Employee id is required for leave bucket storage");
  }

  const snap = await leaveBucketDocRef(employeeId).get();
  const storedRows = snap.exists ? parseStoredRows(snap.data()) : null;
  if (storedRows) {
    return storedRows;
  }

  const inflight =
    bootstrapInflight.get(employeeId) ??
    bootstrapFromSheets(ref).finally(() => {
      bootstrapInflight.delete(employeeId);
    });
  bootstrapInflight.set(employeeId, inflight);
  return inflight;
}

export const firestoreLeaveBucketRepository: LeaveBucketRepository = {
  async readRows(ref) {
    return ensureBootstrapped(ref);
  },

  async saveRows(ref, rows) {
    await persistRows(ref, rows);
  },

  async addGroupedLeaveDates(ref, groups, duration, reason) {
    const rows = await ensureBootstrapped(ref);

    for (const group of groups) {
      if (group.dates.length === 0) continue;
      applyLeaveDatesToRows(rows, group.leaveType, group.dates, duration, reason);
    }

    await persistRows(ref, rows);
  },

  async importCsv(ref, content) {
    const rows = await ensureBootstrapped(ref);
    const merged = mergeLeaveBucketCsvIntoRows(rows, content);
    await persistRows(ref, merged);
  },
};
