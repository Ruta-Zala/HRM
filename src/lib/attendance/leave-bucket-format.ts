import {
  LEAVE_BUCKET_COLUMN_GROUPS,
  type LeaveBucketType,
} from "@/lib/attendance/leave-bucket-layout";
import { LEAVE_STATUS } from "@/lib/attendance/leave-status";
import { getSheetsClient } from "@/lib/google/drive-auth";

const LEAVE_BUCKET_SHEET_NAME = "Leave Bucket";

const APPLIED_LEAVE_BG = { red: 0.92, green: 0.92, blue: 0.92 };
const ACCEPTED_LEAVE_BG = { red: 0.85, green: 0.95, blue: 0.85 };
const REJECTED_LEAVE_BG = { red: 0.98, green: 0.88, blue: 0.88 };

async function getLeaveBucketSheetId(spreadsheetId: string): Promise<number | null> {
  const sheetsApi = await getSheetsClient();
  const meta = await sheetsApi.spreadsheets.get({
    spreadsheetId,
    fields: "sheets.properties",
  });

  const normalized = LEAVE_BUCKET_SHEET_NAME.trim().toLowerCase();
  const sheet = meta.data.sheets?.find(
    (entry) => (entry.properties?.title ?? "").trim().toLowerCase() === normalized,
  );

  return sheet?.properties?.sheetId ?? null;
}

function getLeaveTypeColumnRange(leaveType: LeaveBucketType): {
  startColumnIndex: number;
  endColumnIndex: number;
} {
  const columns = LEAVE_BUCKET_COLUMN_GROUPS[leaveType];
  const indexes = [columns.date, columns.status, columns.rejectReason];
  if (columns.duration != null) indexes.push(columns.duration);
  if (columns.reason != null) indexes.push(columns.reason);

  const startColumnIndex = Math.min(...indexes);
  const endColumnIndex = Math.max(...indexes) + 1;
  return { startColumnIndex, endColumnIndex };
}

function backgroundForStatus(status: string) {
  const normalized = status.trim().toLowerCase();
  if (normalized === LEAVE_STATUS.APPLIED.toLowerCase()) return APPLIED_LEAVE_BG;
  if (normalized === LEAVE_STATUS.ACCEPTED.toLowerCase()) return ACCEPTED_LEAVE_BG;
  if (normalized === LEAVE_STATUS.REJECTED.toLowerCase()) return REJECTED_LEAVE_BG;
  return null;
}

export async function applyLeaveBucketRowFormat(params: {
  spreadsheetId: string;
  rowIndex: number;
  leaveType: LeaveBucketType;
  status: string;
}): Promise<void> {
  const sheetId = await getLeaveBucketSheetId(params.spreadsheetId);
  if (sheetId == null) return;

  const backgroundColor = backgroundForStatus(params.status);
  if (!backgroundColor) return;

  const { startColumnIndex, endColumnIndex } = getLeaveTypeColumnRange(params.leaveType);
  const sheetsApi = await getSheetsClient();

  await sheetsApi.spreadsheets.batchUpdate({
    spreadsheetId: params.spreadsheetId,
    requestBody: {
      requests: [
        {
          repeatCell: {
            range: {
              sheetId,
              startRowIndex: params.rowIndex,
              endRowIndex: params.rowIndex + 1,
              startColumnIndex,
              endColumnIndex,
            },
            cell: {
              userEnteredFormat: {
                backgroundColor,
              },
            },
            fields: "userEnteredFormat.backgroundColor",
          },
        },
      ],
    },
  });
}

export async function applyLeaveBucketRowFormats(
  spreadsheetId: string,
  entries: Array<{ rowIndex: number; leaveType: LeaveBucketType; status: string }>,
): Promise<void> {
  for (const entry of entries) {
    await applyLeaveBucketRowFormat({
      spreadsheetId,
      rowIndex: entry.rowIndex,
      leaveType: entry.leaveType,
      status: entry.status,
    });
  }
}
