import {
  addGroupedLeaveDatesToBucket as addGroupedLeaveDatesToBucketSheets,
  importLeaveBucketCsv as importLeaveBucketCsvSheets,
  readLeaveBucketRows as readLeaveBucketRowsSheets,
  writeLeaveBucketRows as writeLeaveBucketRowsSheets,
} from "@/lib/google/attendance-sheets";

import type { LeaveBucketRepository, LeaveBucketStorageRef } from "./types";

function requireSpreadsheetId(ref: LeaveBucketStorageRef): string {
  const spreadsheetId = ref.spreadsheetId?.trim();
  if (!spreadsheetId) {
    throw new Error("Leave bucket spreadsheet not found for employee");
  }
  return spreadsheetId;
}

export const sheetsLeaveBucketRepository: LeaveBucketRepository = {
  async readRows(ref) {
    return readLeaveBucketRowsSheets(requireSpreadsheetId(ref));
  },

  async saveRows(ref, rows) {
    await writeLeaveBucketRowsSheets(requireSpreadsheetId(ref), rows);
  },

  async addGroupedLeaveDates(ref, groups, duration, reason) {
    await addGroupedLeaveDatesToBucketSheets(requireSpreadsheetId(ref), groups, duration, reason);
  },

  async importCsv(ref, content) {
    await importLeaveBucketCsvSheets(requireSpreadsheetId(ref), content);
  },
};
