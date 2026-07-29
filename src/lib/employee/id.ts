/**
 * Parse numeric suffix from IDs like EMP001 / emp12.
 * Returns null when the value is not a standard EMP### id.
 */
export function parseEmployeeIdNumber(employeeId: string): number | null {
  const match = /^EMP(\d+)$/i.exec(employeeId.trim());
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isFinite(value) ? value : null;
}

/**
 * Next unique EMP### id based on the highest existing id number.
 * Uses max(existing) + 1 so deleted / reordered rows do not reuse ids.
 */
export function generateEmployeeId(existingIds: Iterable<string>): string {
  let max = 0;

  for (const id of existingIds) {
    const value = parseEmployeeIdNumber(id);
    if (value != null && value > max) {
      max = value;
    }
  }

  return `EMP${String(max + 1).padStart(3, "0")}`;
}
