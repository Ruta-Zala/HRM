export type SortOrder = "asc" | "desc";

export function headerToKey(header: string): string {
  return header.trim().toLowerCase().replace(/\s+/g, "_");
}

/**
 * Sort sheet rows (keeps header row first).
 * @param sortBy - normalized column key (e.g. "name") or header label
 */
export function sortSheetData(
  data: string[][],
  sortBy?: string | null,
  order: SortOrder = "asc",
): string[][] {
  if (!data.length || !sortBy) return data;

  const [headerRow, ...bodyRows] = data;
  if (!bodyRows.length) return data;

  const headers = headerRow ?? [];
  const keys = headers.map(headerToKey);
  const sortKey = headerToKey(sortBy);

  let colIndex = keys.indexOf(sortKey);
  if (colIndex === -1) {
    colIndex = headers.findIndex((h) => h.trim().toLowerCase() === sortBy.trim().toLowerCase());
  }
  if (colIndex === -1) return data;

  const sorted = [...bodyRows].sort((a, b) => {
    const aVal = String(a[colIndex] ?? "");
    const bVal = String(b[colIndex] ?? "");

    const aTime = Date.parse(aVal);
    const bTime = Date.parse(bVal);
    if (!Number.isNaN(aTime) && !Number.isNaN(bTime)) {
      return order === "desc" ? bTime - aTime : aTime - bTime;
    }

    const cmp = aVal.localeCompare(bVal, undefined, {
      numeric: true,
      sensitivity: "base",
    });
    return order === "desc" ? -cmp : cmp;
  });

  return [headers, ...sorted];
}
