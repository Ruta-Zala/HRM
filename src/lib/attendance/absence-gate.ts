import { ROLES } from "@/app/consts/common";
import type { UserRole } from "@/types/auth";

export const PUNCH_GATE_ROUTE = "/employee/punch";

export function isPunchRoute(pathname: string): boolean {
  return pathname === PUNCH_GATE_ROUTE || pathname.startsWith(`${PUNCH_GATE_ROUTE}/`);
}

export function roleCanPunchInOut(role: UserRole): boolean {
  return role === ROLES.HR_MANAGER || role === ROLES.EMPLOYEE;
}

export function roleRequiresAbsenceExplanationGate(role: UserRole): boolean {
  return roleCanPunchInOut(role);
}
