export const LEAVE_STATUS = {
  APPLIED: "Applied",
  ACCEPTED: "Accepted",
  REJECTED: "Rejected",
} as const;

export type LeaveStatus = (typeof LEAVE_STATUS)[keyof typeof LEAVE_STATUS];

export function isActiveLeaveStatus(status: string): boolean {
  const normalized = status.trim().toLowerCase();
  return (
    normalized === LEAVE_STATUS.APPLIED.toLowerCase() ||
    normalized === LEAVE_STATUS.ACCEPTED.toLowerCase()
  );
}

export function countsTowardLeaveQuota(status: string): boolean {
  return isActiveLeaveStatus(status);
}
