import { ROLES } from "@/app/consts/common";
import type { UserRole } from "@/types/auth";

export const PUNCH_GATE_ROUTE = "/employee/punch";

export function roleRequiresAbsenceExplanationGate(role: UserRole): boolean {
  return role === ROLES.HR_MANAGER || role === ROLES.EMPLOYEE;
}
