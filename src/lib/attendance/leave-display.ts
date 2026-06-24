export function leaveDaysFromEntry(entry: string): number {
  const trimmed = entry.trim();
  if (!trimmed) return 0;

  if (/\b(AM|PM)\s*$/i.test(trimmed) || /\(half_am\)|\(half_pm\)/i.test(trimmed)) {
    return 0.5;
  }

  return 1;
}

export function leaveDaysFromDurationLabel(label: string): number {
  const normalized = label.trim().toLowerCase();
  if (normalized.includes("half")) return 0.5;
  return 1;
}

export function leaveDaysFromRecord(params: {
  date: string;
  duration?: string;
  days?: number;
}): number {
  if (params.duration?.trim()) {
    return leaveDaysFromDurationLabel(params.duration);
  }

  if (params.days != null && params.days > 0) {
    return params.days;
  }

  return leaveDaysFromEntry(params.date);
}

export function formatLeaveDayCount(days: number): string {
  if (days === 0.5) return "0.5 day";
  return `${days} day${days === 1 ? "" : "s"}`;
}
