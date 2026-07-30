/** Shared password strength rules (safe for client + server). */

export const PASSWORD_MIN_LENGTH = 8;

export const PASSWORD_RULES_MESSAGE =
  "Password must be at least 8 characters and include one uppercase letter, one number, and one special character (@, !, #, etc.).";

const SPECIAL_CHAR_PATTERN = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/;

export function isStrongPassword(password: string): boolean {
  const value = password.trim();
  if (value.length < PASSWORD_MIN_LENGTH) return false;
  if (!/[A-Z]/.test(value)) return false;
  if (!/[0-9]/.test(value)) return false;
  if (!SPECIAL_CHAR_PATTERN.test(value)) return false;
  return true;
}

export function passwordStrengthError(password: string): string | null {
  const value = password.trim();
  if (!value) return null;
  if (!isStrongPassword(value)) return PASSWORD_RULES_MESSAGE;
  return null;
}
