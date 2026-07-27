import { ROLES } from "@/app/consts/common";
import type { UserRole } from "@/types/auth";

export function canManageEmployees(role: UserRole): boolean {
  return role === ROLES.HR_MANAGER || role === ROLES.SUPER_ADMIN;
}

export function canReviewOvertime(role: UserRole): boolean {
  return role === ROLES.SUPER_ADMIN;
}

export {
  roleRequiresAbsenceExplanationGate,
  PUNCH_GATE_ROUTE,
} from "@/lib/attendance/absence-gate";
