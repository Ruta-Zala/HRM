import {
  getLeaveBucketTemplateRows,
  migrateLeaveBucketRows,
  normalizeLeaveBucketRow,
} from "@/lib/attendance/leave-bucket-layout";
import { applyLeaveDatesToRows } from "@/lib/attendance/leave-bucket/operations";
import { mergeLeaveBucketCsvIntoRows } from "@/lib/attendance/leave-bucket/csv-import";
import { getAdminFirestore } from "@/lib/firebase/admin";

import type { LeaveBucketRepository, LeaveBucketStorageRef } from "./types";

const COLLECTION = "leave_buckets";

type LeaveBucketDoc = {
  /** Firestore does not allow nested arrays; store serialized rows instead. */
  rowsJson: string;
  updatedAt: number;
};

const emptyBucketInflight = new Map<string, Promise<string[][]>>();

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

/**
 * Firebase-only leave buckets. No Sheets bootstrap on the login/punch path —
 * missing docs get a local template and are persisted for the next read.
 */
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
    emptyBucketInflight.get(employeeId) ??
    (async () => {
      const rows = normalizeRows(getLeaveBucketTemplateRows());
      await persistRows(ref, rows);
      return rows;
    })().finally(() => {
      emptyBucketInflight.delete(employeeId);
    });

  emptyBucketInflight.set(employeeId, inflight);
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
