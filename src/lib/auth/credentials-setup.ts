import { headerToFormKey } from "@/lib/employee";
import { isStrongPassword, PASSWORD_MIN_LENGTH } from "@/lib/auth/password-rules";

import { hashPassword } from "./password";
import { applyPasswordToRowValues } from "./row-credentials";

export type PreparedCredentialsResult = {
  rowValues: string[];
  /** Shown once to HR when auto-generated on create */
  generatedUsername?: string;
  generatedPassword?: string;
};

/**
 * Default username = email local-part (before @).
 * Example: swati.patel@gmail.com → swati.patel
 */
export function deriveDefaultUsername(name: string, email: string): string {
  const trimmedEmail = email.trim().toLowerCase();
  if (trimmedEmail.includes("@")) {
    const localPart = (trimmedEmail.split("@")[0] ?? "").trim().replace(/\s+/g, "");
    if (localPart) return localPart;
  }

  const parts = name.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]}.${parts[parts.length - 1]}`.replace(/[^a-z0-9._-]/g, "");
  }
  if (parts.length === 1) {
    const single = parts[0]!.replace(/[^a-z0-9._-]/g, "");
    if (single) return single;
  }

  return `user${Date.now().toString(36).slice(-6)}`;
}

function pickRandom(chars: string): string {
  return chars[Math.floor(Math.random() * chars.length)]!;
}

function shuffle(chars: string[]): string[] {
  const copy = [...chars];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy;
}

/** Auto-generated password always meets strength rules. */
export function generateSecurePassword(length = 12): string {
  const size = Math.max(length, PASSWORD_MIN_LENGTH);
  const lower = "abcdefghijkmnopqrstuvwxyz";
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const digits = "23456789";
  const special = "!@#$%";
  const all = lower + upper + digits + special;

  const required = [pickRandom(upper), pickRandom(digits), pickRandom(special), pickRandom(lower)];
  while (required.length < size) {
    required.push(pickRandom(all));
  }

  const password = shuffle(required).join("");
  if (!isStrongPassword(password)) {
    return generateSecurePassword(size);
  }
  return password;
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

  if (passwordIndex >= 0) {
    const incoming = String(copy[passwordIndex] ?? "").trim();
    // Validate only plain-text passwords being set/changed (not existing bcrypt hashes)
    if (incoming && !incoming.startsWith("$2") && !isStrongPassword(incoming)) {
      throw new Error(
        "Password must be at least 8 characters and include one uppercase letter, one number, and one special character (@, !, #, etc.).",
      );
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
