import { ROLES } from "@/app/consts/common";
import type { UserRole } from "@/types/auth";

export function canManageEmployees(role: UserRole): boolean {
  return role === ROLES.HR_MANAGER || role === ROLES.SUPER_ADMIN;
}

export function canReviewOvertime(role: UserRole): boolean {
  return role === ROLES.SUPER_ADMIN;
}

export function canManageCompanyBranding(role: UserRole): boolean {
  return role === ROLES.SUPER_ADMIN;
}

export {
  roleRequiresAbsenceExplanationGate,
  roleCanPunchInOut,
  roleCanApplyLeave,
  isPunchRoute,
  isLeaveDeskRoute,
  PUNCH_GATE_ROUTE,
  LEAVE_DESK_ROUTE,
} from "@/lib/attendance/absence-gate";
