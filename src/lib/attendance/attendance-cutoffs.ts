import { getAppZonedParts } from "@/lib/attendance/time";

/**
 * Single cutoff for today's missing punch-in (app TZ, typically IST).
 * - Before this time: login redirects to punch desk; punch-in UI is shown.
 * - At/after this time: today's missing punch requires an absence explanation.
 */
export const TODAY_NO_PUNCH_EXPLAIN_HOUR = 10;
export const TODAY_NO_PUNCH_EXPLAIN_MINUTE = 15;

export function isBeforeTodayNoPunchExplainCutoff(now: Date = new Date()): boolean {
  const parts = getAppZonedParts(now);
  return (
    parts.hour < TODAY_NO_PUNCH_EXPLAIN_HOUR ||
    (parts.hour === TODAY_NO_PUNCH_EXPLAIN_HOUR && parts.minute < TODAY_NO_PUNCH_EXPLAIN_MINUTE)
  );
}

export function isAfterTodayNoPunchExplainCutoff(now: Date = new Date()): boolean {
  return !isBeforeTodayNoPunchExplainCutoff(now);
}
