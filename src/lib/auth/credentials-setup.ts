import { headerToFormKey } from "@/lib/employee";

import { hashPassword } from "./password";
import { applyPasswordToRowValues } from "./row-credentials";

export type PreparedCredentialsResult = {
  rowValues: string[];
  /** Shown once to HR when auto-generated on create */
  generatedUsername?: string;
  generatedPassword?: string;
};

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "")
    .replace(/\.{2,}/g, ".");
}

/** Derive a default username from name or email local-part. */
export function deriveDefaultUsername(name: string, email: string): string {
  const fromEmail = email.includes("@") ? (email.split("@")[0] ?? "") : email;
  const fromEmailSlug = slugify(fromEmail);
  if (fromEmailSlug) return fromEmailSlug;

  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return slugify(`${parts[0]}.${parts[parts.length - 1]}`);
  }
  if (parts.length === 1) {
    return slugify(parts[0]!);
  }

  return `user${Date.now().toString(36).slice(-6)}`;
}

export function generateSecurePassword(length = 12): string {
  const chars = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

function getColumnIndex(
  headers: string[],
  formKey: "username" | "password" | "email" | "name",
): number {
  return headers.findIndex((h) => headerToFormKey(h) === formKey);
}

/**
 * On create: fill missing username/password, then always store password as bcrypt.
 * On edit: hash only when a new plain-text password is provided.
 */
export async function prepareEmployeeCredentialsForSave(
  headers: string[],
  rowValues: string[],
  options: { isCreate: boolean; existingRow?: string[] },
): Promise<PreparedCredentialsResult> {
  const copy = [...rowValues];
  let generatedUsername: string | undefined;
  let generatedPassword: string | undefined;

  const usernameIndex = getColumnIndex(headers, "username");
  const passwordIndex = getColumnIndex(headers, "password");
  const emailIndex = getColumnIndex(headers, "email");
  const nameIndex = getColumnIndex(headers, "name");

  if (options.isCreate) {
    const email = emailIndex >= 0 ? String(copy[emailIndex] ?? "").trim() : "";
    const name = nameIndex >= 0 ? String(copy[nameIndex] ?? "").trim() : "";

    if (usernameIndex >= 0 && !String(copy[usernameIndex] ?? "").trim()) {
      generatedUsername = deriveDefaultUsername(name, email);
      copy[usernameIndex] = generatedUsername;
    }

    if (passwordIndex >= 0 && !String(copy[passwordIndex] ?? "").trim()) {
      generatedPassword = generateSecurePassword();
      copy[passwordIndex] = generatedPassword;
    }
  }

  const rowValuesWithHash = await applyPasswordToRowValues(headers, copy, options.existingRow);

  return {
    rowValues: rowValuesWithHash,
    generatedUsername,
    generatedPassword,
  };
}

/** Replace a plain-text sheet password with a bcrypt hash (same row). */
export async function upgradePlainPasswordInSheet(
  headers: string[],
  row: string[],
  sheetRow: number,
  plainPassword: string,
  updateRow: (range: string, values: string[][]) => Promise<unknown>,
  sheetRowToRangeFn: (sheetRow: number, columnCount: number) => string,
): Promise<void> {
  const passwordIndex = getColumnIndex(headers, "password");
  if (passwordIndex < 0) return;

  const stored = String(row[passwordIndex] ?? "").trim();
  if (!stored || stored.startsWith("$2")) return;

  const hashed = await hashPassword(plainPassword);
  const updated = [...row];
  updated[passwordIndex] = hashed;
  const range = sheetRowToRangeFn(sheetRow, headers.length);
  await updateRow(range, [updated]);
}
