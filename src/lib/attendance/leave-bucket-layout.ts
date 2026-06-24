export type LeaveBucketType = "paid" | "casual" | "sick" | "unpaid" | "birthday";

export const LEAVE_BUCKET_HEADERS = [
  "Month",
  "Paid Leave",
  "Paid Duration",
  "Paid Reason",
  "Paid Status",
  "Paid Reject Reason",
  "Casual Leave",
  "Casual Duration",
  "Casual Reason",
  "Casual Status",
  "Casual Reject Reason",
  "Sick Leave",
  "Sick Duration",
  "Sick Reason",
  "Sick Status",
  "Sick Reject Reason",
  "Unpaid Leave",
  "Unpaid Duration",
  "Unpaid Reason",
  "Unpaid Status",
  "Unpaid Reject Reason",
  "Birthday Leave",
  "Birthday Status",
  "Birthday Reject Reason",
] as const;

export const LEAVE_BUCKET_COLUMN_COUNT = LEAVE_BUCKET_HEADERS.length;

export type LeaveBucketColumns = {
  date: number;
  status: number;
  rejectReason: number;
  duration?: number;
  reason?: number;
};

export const LEAVE_BUCKET_COLUMN_GROUPS: Record<LeaveBucketType, LeaveBucketColumns> = {
  paid: { date: 1, duration: 2, reason: 3, status: 4, rejectReason: 5 },
  casual: { date: 6, duration: 7, reason: 8, status: 9, rejectReason: 10 },
  sick: { date: 11, duration: 12, reason: 13, status: 14, rejectReason: 15 },
  unpaid: { date: 16, duration: 17, reason: 18, status: 19, rejectReason: 20 },
  birthday: { date: 21, status: 22, rejectReason: 23 },
};

const V2_LEAVE_BUCKET_GROUPS: Record<
  LeaveBucketType,
  { date: number; duration?: number; reason?: number }
> = {
  paid: { date: 1, duration: 2, reason: 3 },
  casual: { date: 4, duration: 5, reason: 6 },
  sick: { date: 7, duration: 8, reason: 9 },
  unpaid: { date: 10, duration: 11, reason: 12 },
  birthday: { date: 13, duration: 14, reason: 15 },
};

const LEGACY_LEAVE_BUCKET_COLUMNS = {
  paid: 1,
  casual: 2,
  sick: 3,
  unpaid: 4,
  birthday: 5,
  duration: 6,
  reason: 7,
} as const;

export function isCurrentLeaveBucketHeaders(headers: string[]): boolean {
  const normalized = headers.map((header) => String(header).trim().toLowerCase());
  return normalized.some((header) => header.includes("paid status"));
}

export function isV2LeaveBucketHeaders(headers: string[]): boolean {
  const normalized = headers.map((header) => String(header).trim().toLowerCase());
  return (
    normalized.some((header) => header.includes("paid duration")) &&
    !normalized.some((header) => header.includes("paid status"))
  );
}

export function isLegacyLeaveBucketHeaders(headers: string[]): boolean {
  const normalized = headers.map((header) => String(header).trim().toLowerCase());
  return !normalized.some((header) => header.includes("paid duration"));
}

export function normalizeLeaveBucketRow(row: string[]): string[] {
  const padded = row.slice();
  while (padded.length < LEAVE_BUCKET_COLUMN_COUNT) {
    padded.push("");
  }
  return padded.slice(0, LEAVE_BUCKET_COLUMN_COUNT);
}

function migrateV2LeaveBucketRow(row: string[]): string[] {
  const migrated = new Array(LEAVE_BUCKET_COLUMN_COUNT).fill("");
  migrated[0] = String(row[0] ?? "");

  for (const type of Object.keys(V2_LEAVE_BUCKET_GROUPS) as LeaveBucketType[]) {
    const source = V2_LEAVE_BUCKET_GROUPS[type];
    const target = LEAVE_BUCKET_COLUMN_GROUPS[type];
    const date = String(row[source.date] ?? "").trim();
    if (!date) continue;

    migrated[target.date] = date;
    if (source.duration != null && target.duration != null) {
      migrated[target.duration] = String(row[source.duration] ?? "").trim();
    }
    if (source.reason != null && target.reason != null) {
      migrated[target.reason] = String(row[source.reason] ?? "").trim();
    }
  }

  return migrated;
}

export function migrateLegacyLeaveBucketRow(row: string[]): string[] {
  const migrated = new Array(LEAVE_BUCKET_COLUMN_COUNT).fill("");
  migrated[0] = String(row[0] ?? "");

  const sharedDuration = String(row[LEGACY_LEAVE_BUCKET_COLUMNS.duration] ?? "").trim();
  const sharedReason = String(row[LEGACY_LEAVE_BUCKET_COLUMNS.reason] ?? "").trim();

  for (const type of Object.keys(LEGACY_LEAVE_BUCKET_COLUMNS) as Array<
    keyof typeof LEGACY_LEAVE_BUCKET_COLUMNS
  >) {
    if (type === "duration" || type === "reason") continue;

    const legacyIndex = LEGACY_LEAVE_BUCKET_COLUMNS[type];
    const date = String(row[legacyIndex] ?? "").trim();
    if (!date) continue;

    const columns = LEAVE_BUCKET_COLUMN_GROUPS[type];
    migrated[columns.date] = date;
    if (columns.duration != null) migrated[columns.duration] = sharedDuration;
    if (columns.reason != null) migrated[columns.reason] = sharedReason;
  }

  return migrated;
}

export function migrateLeaveBucketRows(rows: string[][]): string[][] {
  if (rows.length === 0) {
    return [[...LEAVE_BUCKET_HEADERS]];
  }

  const headerRow = rows[0] ?? [];
  if (isCurrentLeaveBucketHeaders(headerRow)) {
    return rows.map((row) => normalizeLeaveBucketRow(row));
  }

  if (isV2LeaveBucketHeaders(headerRow)) {
    return [[...LEAVE_BUCKET_HEADERS], ...rows.slice(1).map((row) => migrateV2LeaveBucketRow(row))];
  }

  return [
    [...LEAVE_BUCKET_HEADERS],
    ...rows.slice(1).map((row) => migrateLegacyLeaveBucketRow(row)),
  ];
}

export function formatBirthdayLeaveDate(birthdayDate: string): string {
  const trimmed = birthdayDate.trim();
  if (!trimmed) return "";

  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    const year = new Date().getFullYear();
    const month = Number(isoMatch[2]);
    const day = Number(isoMatch[3]);
    return `${day}/${month}/${year}`;
  }

  const slashMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashMatch) {
    const year = new Date().getFullYear();
    const day = Number(slashMatch[1]);
    const month = Number(slashMatch[2]);
    return `${day}/${month}/${year}`;
  }

  const parsed = new Date(trimmed);
  if (!Number.isNaN(parsed.getTime())) {
    const year = new Date().getFullYear();
    return `${parsed.getDate()}/${parsed.getMonth() + 1}/${year}`;
  }

  return trimmed;
}

export function formatBirthdayLeaveDateIso(birthdayDate: string): string {
  const trimmed = birthdayDate.trim();
  if (!trimmed) return "";

  const year = new Date().getFullYear();

  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    return `${year}-${isoMatch[2]}-${isoMatch[3]}`;
  }

  const slashMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashMatch) {
    const month = String(Number(slashMatch[2])).padStart(2, "0");
    const day = String(Number(slashMatch[1])).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  const parsed = new Date(trimmed);
  if (!Number.isNaN(parsed.getTime())) {
    const month = String(parsed.getMonth() + 1).padStart(2, "0");
    const day = String(parsed.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  return "";
}

export function getLeaveBucketTemplateRows(birthdayDate = ""): string[][] {
  const rows: string[][] = [
    [...LEAVE_BUCKET_HEADERS],
    ...[
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ].map((month) =>
      Array.from({ length: LEAVE_BUCKET_COLUMN_COUNT }, (_, index) => (index === 0 ? month : "")),
    ),
  ];

  const formattedBirthday = formatBirthdayLeaveDate(birthdayDate);
  if (formattedBirthday) {
    const januaryRow = rows[1];
    const birthdayColumns = LEAVE_BUCKET_COLUMN_GROUPS.birthday;
    januaryRow[birthdayColumns.date] = formattedBirthday;
  }

  return rows;
}
