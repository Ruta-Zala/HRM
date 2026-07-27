import type { PendingAbsenceGroup } from "@/lib/attendance/absence-explanation";

type CacheEntry = {
  groups: PendingAbsenceGroup[];
  expiresAt: number;
};

const CACHE_TTL_MS = 60_000;
const cache = new Map<string, CacheEntry>();

export function getCachedAbsenceGroups(employeeId: string): PendingAbsenceGroup[] | null {
  const entry = cache.get(employeeId);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(employeeId);
    return null;
  }
  return entry.groups;
}

export function setCachedAbsenceGroups(employeeId: string, groups: PendingAbsenceGroup[]): void {
  cache.set(employeeId, {
    groups,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });
}

export function invalidateAbsenceExplanationCache(employeeId: string): void {
  cache.delete(employeeId);
}
