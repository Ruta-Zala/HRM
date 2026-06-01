import { ROLES } from "@/app/consts/common";
import {
  getSheetHeaders,
  headerToFormKey,
  isEmployeeStatusActive,
  sheetRowToForm,
  sheetRowToRange,
} from "@/lib/employee";
import { EMPLOYEE_SHEET_RANGE, readSheet, updateSheetRow } from "@/lib/google/sheets";
import type { SessionUser, UserRole } from "@/types/auth";

import { upgradePlainPasswordInSheet } from "./credentials-setup";
import { isBcryptHash, verifyPassword } from "./password";

export type AuthenticateResult =
  | { ok: true; user: SessionUser }
  | { ok: false; reason: "invalid_credentials" | "account_inactive" };

function normalizeUserRole(value: string): UserRole | null {
  const role = value.trim().toLowerCase();
  if (role === ROLES.SUPER_ADMIN) return ROLES.SUPER_ADMIN;
  if (role === ROLES.HR_MANAGER) return ROLES.HR_MANAGER;
  if (role === ROLES.EMPLOYEE) return ROLES.EMPLOYEE;
  return null;
}

/**
 * Authenticate against employee rows in Google Sheets.
 * Login identifier may be work email or username (case-insensitive).
 */
export async function authenticateFromSheet(
  login: string,
  password: string,
): Promise<AuthenticateResult> {
  const loginNorm = login.trim().toLowerCase();
  if (!loginNorm || !password) {
    return { ok: false, reason: "invalid_credentials" };
  }

  const raw = await readSheet(EMPLOYEE_SHEET_RANGE);
  const headers = getSheetHeaders(raw);

  let inactiveMatch = false;

  for (let index = 1; index < raw.length; index++) {
    const row = raw[index] ?? [];
    const form = sheetRowToForm(headers, row);

    const email = form.email.trim().toLowerCase();
    const username = form.username.trim().toLowerCase();
    const matchesLogin = (email && email === loginNorm) || (username && username === loginNorm);
    if (!matchesLogin) continue;

    const storedPassword = form.password.trim();
    if (!storedPassword) continue;

    const valid = await verifyPassword(password, storedPassword);
    if (!valid) continue;

    const statusIndex = headers.findIndex((h) => headerToFormKey(h) === "status");
    const rawStatus = statusIndex >= 0 ? String(row[statusIndex] ?? "") : "";
    if (!isEmployeeStatusActive(rawStatus)) {
      inactiveMatch = true;
      continue;
    }

    const sheetRow = index + 1;
    if (!isBcryptHash(storedPassword)) {
      try {
        await upgradePlainPasswordInSheet(
          headers,
          row,
          sheetRow,
          password,
          updateSheetRow,
          sheetRowToRange,
        );
      } catch (error) {
        console.error("Failed to upgrade plain password to bcrypt:", error);
      }
    }

    const role = normalizeUserRole(form.role);
    if (!role) continue;

    const name = form.name.trim() || username || email;
    const id = form.employeeId.trim() || (email ? email : username) || `row-${index + 1}`;

    return {
      ok: true,
      user: {
        id,
        email: form.email.trim() || email || username,
        name,
        role,
        department: form.position.trim() || undefined,
        sheetRow,
      },
    };
  }

  if (inactiveMatch) {
    return { ok: false, reason: "account_inactive" };
  }

  return { ok: false, reason: "invalid_credentials" };
}
