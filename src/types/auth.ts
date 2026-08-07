import { ROLES } from "@/app/consts/common";

export type UserRole = (typeof ROLES)[keyof typeof ROLES];

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  department?: string;
  /** 1-based row index in the employee Google Sheet */
  sheetRow?: number;
  /** Epoch ms when this login session started (role-based absolute timeout). */
  loggedInAt?: number;
};
