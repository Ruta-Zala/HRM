import bcrypt from "bcryptjs";

const BCRYPT_ROUNDS = 10;

export function isBcryptHash(value: string): boolean {
  return /^\$2[aby]\$\d{2}\$/.test(value);
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

export async function verifyPassword(plain: string, stored: string): Promise<boolean> {
  const trimmed = stored.trim();
  if (!trimmed) return false;
  if (isBcryptHash(trimmed)) {
    return bcrypt.compare(plain, trimmed);
  }
  return plain === trimmed;
}
