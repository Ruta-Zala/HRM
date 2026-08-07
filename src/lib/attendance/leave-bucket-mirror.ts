import { getAdminFirestore } from "@/lib/firebase/admin";
import { isFirebaseDailyStorage } from "@/lib/storage/backend";
import {
  addGroupedLeaveDatesToBucket as addGroupedLeaveDatesToBucketSheets,
  readLeaveBucketRows as readLeaveBucketRowsSheets,
} from "@/lib/google/attendance-sheets";
import type { LeaveBucketType } from "@/lib/attendance/leave-bucket-layout";

type LeaveBucketMirrorDoc = {
  spreadsheetId: string;
  rowsJson: string;
  refreshedAt: number;
};

const COLLECTION = "leave_bucket_mirrors";

// Avoid repeated Firestore reads when the user keeps the absence panel open.
const MEMORY_CACHE_TTL_MS = 60_000;

// Periodically refresh from Sheets so HR reviews eventually propagate.
// (This avoids needing dual-write into sheets for every HR action.)
const FIRESTORE_REFRESH_TTL_MS = 30 * 60_000;

const memoryCache: Map<string, { rows: string[][]; refreshedAt: number; cachedAt: number }> =
  new Map();

const inflightFetches = new Map<string, Promise<string[][]>>();

function mirrorDocRef(spreadsheetId: string) {
  return getAdminFirestore().collection(COLLECTION).doc(spreadsheetId);
}

async function refreshMirrorFromSheets(spreadsheetId: string): Promise<string[][]> {
  const rows = await readLeaveBucketRowsSheets(spreadsheetId);
  const doc = mirrorDocRef(spreadsheetId);
  const payload: LeaveBucketMirrorDoc = {
    spreadsheetId,
    rowsJson: JSON.stringify(rows),
    refreshedAt: Date.now(),
  };
  await doc.set(payload, { merge: true });
  memoryCache.set(spreadsheetId, { rows, refreshedAt: payload.refreshedAt, cachedAt: Date.now() });
  return rows;
}

export async function readLeaveBucketRowsCached(spreadsheetId: string): Promise<string[][]> {
  return readLeaveBucketRowsForAbsenceExplanation(spreadsheetId);
}

export async function readLeaveBucketRowsForAbsenceExplanation(
  spreadsheetId: string,
): Promise<string[][]> {
  if (!isFirebaseDailyStorage()) {
    return readLeaveBucketRowsSheets(spreadsheetId);
  }

  const trimmed = spreadsheetId.trim();
  if (!trimmed) return [[]];

  const cached = memoryCache.get(trimmed);
  if (cached && Date.now() - cached.cachedAt < MEMORY_CACHE_TTL_MS) {
    return cached.rows;
  }

  const doc = mirrorDocRef(trimmed);
  const snap = await doc.get();

  const staleRows: string[][] | null = (() => {
    if (!snap.exists) return null;
    const data = snap.data() as Partial<LeaveBucketMirrorDoc>;
    const rowsJson = data?.rowsJson;
    if (!rowsJson) return null;
    try {
      const parsed = JSON.parse(rowsJson) as unknown;
      if (!Array.isArray(parsed)) return null;
      return parsed as string[][];
    } catch {
      return null;
    }
  })();

  const refreshedAt: number = snap.exists
    ? ((snap.data()?.refreshedAt as number | undefined) ?? 0)
    : 0;

  const isFresh =
    Boolean(staleRows) && refreshedAt > 0 && Date.now() - refreshedAt < FIRESTORE_REFRESH_TTL_MS;
  if (isFresh && staleRows) {
    memoryCache.set(trimmed, {
      rows: staleRows,
      refreshedAt,
      cachedAt: Date.now(),
    });
    return staleRows;
  }

  // If multiple users request at the same time, dedupe the bootstrapping/refresh.
  const inflight =
    inflightFetches.get(trimmed) ??
    refreshMirrorFromSheets(trimmed).finally(() => {
      inflightFetches.delete(trimmed);
    });
  inflightFetches.set(trimmed, inflight);

  try {
    const rows = await inflight;
    return rows;
  } catch (error) {
    // If Sheets quota is exceeded during refresh, allow serving the last known mirror.
    if (staleRows && staleRows.length > 0) return staleRows;
    throw error;
  }
}

export async function addGroupedLeaveDatesToBucketForAbsenceExplanation(
  spreadsheetId: string,
  groups: Array<{ leaveType: LeaveBucketType; dates: Date[] }>,
  duration: "full" | "half_am" | "half_pm" = "full",
  reason = "",
): Promise<void> {
  if (!isFirebaseDailyStorage()) {
    await addGroupedLeaveDatesToBucketSheets(spreadsheetId, groups, duration, reason);
    return;
  }

  // Leave bucket write logic is still implemented in Sheets. After writing,
  // refresh the Firestore mirror so absence-explanation immediately reflects it.
  await addGroupedLeaveDatesToBucketSheets(spreadsheetId, groups, duration, reason);
  try {
    await refreshMirrorFromSheets(spreadsheetId);
  } catch (error) {
    // Best-effort mirror sync; future reads will refresh based on TTL.
    console.error("[leave-bucket-mirror] refresh after write failed:", error);
  }
}
