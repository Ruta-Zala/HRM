import {
  LEAVE_BUCKET_COLUMN_GROUPS,
  LEAVE_BUCKET_HEADERS,
  getLeaveBucketTemplateRows,
  migrateLeaveBucketRows,
  normalizeLeaveBucketRow,
  type LeaveBucketType,
} from "@/lib/attendance/leave-bucket-layout";

function normalizeMonthName(value: string): string {
  const trimmed = value.trim().toLowerCase();
  const monthMap: Record<string, string> = {
    january: "January",
    february: "February",
    march: "March",
    april: "April",
    may: "May",
    june: "June",
    july: "July",
    august: "August",
    september: "September",
    october: "October",
    november: "November",
    december: "December",
    jan: "January",
    feb: "February",
    mar: "March",
    apr: "April",
    jun: "June",
    jul: "July",
    aug: "August",
    sep: "September",
    oct: "October",
    nov: "November",
    dec: "December",
  };
  return monthMap[trimmed] ?? value;
}

function parseDelimitedRows(content: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < content.length; i++) {
    const ch = content[i];
    const next = content[i + 1];

    if (ch === '"') {
      if (inQuotes && next === '"') {
        cell += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (!inQuotes && (ch === "," || ch === "\t")) {
      row.push(cell.trim());
      cell = "";
      continue;
    }

    if (!inQuotes && (ch === "\n" || ch === "\r")) {
      if (ch === "\r" && next === "\n") i++;
      row.push(cell.trim());
      const hasAnyValue = row.some((c) => c.length > 0);
      if (hasAnyValue) rows.push(row);
      row = [];
      cell = "";
      continue;
    }

    cell += ch;
  }

  row.push(cell.trim());
  if (row.some((c) => c.length > 0)) rows.push(row);
  return rows;
}

export function mergeLeaveBucketCsvIntoRows(existingRows: string[][], content: string): string[][] {
  const rows = parseDelimitedRows(content);
  if (rows.length < 2) {
    throw new Error("CSV must contain a header row and at least one data row.");
  }

  const headers = rows[0].map((value) => value.trim().toLowerCase());
  const monthIndex = headers.findIndex((header) => header.includes("month"));

  if (monthIndex === -1) {
    throw new Error("Leave bucket CSV must contain a Month column.");
  }

  const findHeaderIndex = (label: string) => {
    const normalized = label.trim().toLowerCase();
    const exact = headers.findIndex((header) => header === normalized);
    if (exact >= 0) return exact;
    return headers.findIndex((header) => header.includes(normalized));
  };

  const leaveTypes = Object.keys(LEAVE_BUCKET_COLUMN_GROUPS) as LeaveBucketType[];
  const columnIndexes = Object.fromEntries(
    leaveTypes.map((type) => {
      const columns = LEAVE_BUCKET_COLUMN_GROUPS[type];
      return [
        type,
        {
          date: findHeaderIndex(LEAVE_BUCKET_HEADERS[columns.date]),
          duration:
            columns.duration != null ? findHeaderIndex(LEAVE_BUCKET_HEADERS[columns.duration]) : -1,
          reason:
            columns.reason != null ? findHeaderIndex(LEAVE_BUCKET_HEADERS[columns.reason]) : -1,
          status: findHeaderIndex(LEAVE_BUCKET_HEADERS[columns.status]),
          rejectReason: findHeaderIndex(LEAVE_BUCKET_HEADERS[columns.rejectReason]),
        },
      ];
    }),
  ) as Record<
    LeaveBucketType,
    {
      date: number;
      duration: number;
      reason: number;
      status: number;
      rejectReason: number;
    }
  >;

  const legacyDurationIndex = headers.findIndex(
    (header) => header === "duration" || header.endsWith(" duration"),
  );
  const legacyReasonIndex = headers.findIndex(
    (header) => header === "reason" || header.endsWith(" reason"),
  );

  const resultValues = migrateLeaveBucketRows(
    existingRows.length > 0 ? existingRows : getLeaveBucketTemplateRows(),
  ).map((row) => normalizeLeaveBucketRow(row));

  const monthIndexMap = new Map<string, number>();
  for (let i = 1; i < resultValues.length; i++) {
    const month = String(resultValues[i][0] ?? "")
      .trim()
      .toLowerCase();
    if (month) monthIndexMap.set(month, i);
  }

  const normalizeCellValues = (cell: string) =>
    cell
      .split(/[,;]+/)
      .map((item) => item.trim())
      .filter((item) => item && item !== "0/1")
      .map((item) => item.replace(/\s+/g, " ").trim());

  const setColumn = (
    targetRowIndex: number,
    columnIndex: number,
    columnValue: string | undefined,
  ) => {
    if (columnIndex < 0) return;
    const items = normalizeCellValues(String(columnValue ?? ""));
    if (items.length === 0) return;
    const current = String(resultValues[targetRowIndex][columnIndex] ?? "").trim();
    const existing = current.length ? current.split(/\s*,\s*/).filter(Boolean) : [];
    for (const item of items) {
      if (!existing.includes(item)) existing.push(item);
    }
    resultValues[targetRowIndex][columnIndex] = existing.join(", ");
  };

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const monthRaw = String(row[monthIndex] ?? "").trim();
    const month = normalizeMonthName(monthRaw).toLowerCase();
    const targetRowIndex = monthIndexMap.get(month);
    if (targetRowIndex == null) continue;

    for (const type of leaveTypes) {
      const indexes = columnIndexes[type];
      const sheetColumns = LEAVE_BUCKET_COLUMN_GROUPS[type];

      setColumn(targetRowIndex, sheetColumns.date, row[indexes.date]);

      const durationValue = String(
        indexes.duration >= 0 ? row[indexes.duration] : row[legacyDurationIndex],
      ).trim();
      if (durationValue && sheetColumns.duration != null) {
        resultValues[targetRowIndex][sheetColumns.duration] = durationValue;
      }

      const reasonValue = String(
        indexes.reason >= 0 ? row[indexes.reason] : row[legacyReasonIndex],
      ).trim();
      if (reasonValue && sheetColumns.reason != null) {
        resultValues[targetRowIndex][sheetColumns.reason] = reasonValue;
      }

      const statusValue = String(row[indexes.status] ?? "").trim();
      if (statusValue) {
        resultValues[targetRowIndex][sheetColumns.status] = statusValue;
      }

      const rejectValue = String(row[indexes.rejectReason] ?? "").trim();
      if (rejectValue) {
        resultValues[targetRowIndex][sheetColumns.rejectReason] = rejectValue;
      }
    }
  }

  return resultValues;
}
