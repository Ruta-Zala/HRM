import { headerToKey } from "./sort";

/** Normalized column keys searched by the employee directory */
export const EMPLOYEE_SEARCH_KEYS = ["name", "role", "skills"] as const;

export function filterSheetBySearch(
  data: string[][],
  query: string | null | undefined,
): string[][] {
  if (!data.length || !query?.trim()) return data;

  const [headerRow, ...bodyRows] = data;
  const headers = headerRow ?? [];
  const keys = headers.map(headerToKey);

  const searchColIndexes = keys
    .map((key, index) => ((EMPLOYEE_SEARCH_KEYS as readonly string[]).includes(key) ? index : -1))
    .filter((index) => index >= 0);

  if (!searchColIndexes.length) return data;

  const term = query.trim().toLowerCase();
  const filtered = bodyRows.filter((row) =>
    searchColIndexes.some((colIndex) =>
      String(row[colIndex] ?? "")
        .toLowerCase()
        .includes(term),
    ),
  );

  return [headers, ...filtered];
}
