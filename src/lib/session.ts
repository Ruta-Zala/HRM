import { ROLES } from "@/app/consts/common";
import type { SessionUser, UserRole } from "@/types/auth";

const COOKIE = "exhibyte_session";

/** Employee (and default) absolute session lifetime from login. */
export const SESSION_MAX_AGE_EMPLOYEE_MS = 30 * 60 * 1000;
/** HR Manager + Super Admin absolute session lifetime from login (or last Continue). */
export const SESSION_MAX_AGE_ADMIN_MS = 2 * 60 * 60 * 1000;
/**
 * HR / Super Admin idle limit: no interaction for this long ends the session
 * even if the 2-hour absolute window has not ended.
 */
export const SESSION_IDLE_MAX_AGE_ADMIN_MS = 30 * 60 * 1000;

function encodeBase64Url(json: string): string {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(json, "utf8").toString("base64url");
  }
  const b64 = btoa(unescape(encodeURIComponent(json)));
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function decodeBase64Url(raw: string): string {
  const pad = raw.length % 4 === 0 ? "" : "=".repeat(4 - (raw.length % 4));
  const b64 = raw.replace(/-/g, "+").replace(/_/g, "/") + pad;
  if (typeof Buffer !== "undefined") {
    return Buffer.from(b64, "base64").toString("utf8");
  }
  return decodeURIComponent(escape(atob(b64)));
}

/** Role-based absolute session length from login (or last Continue for admins). */
export function sessionMaxAgeMsForRole(role: UserRole | string | undefined): number {
  if (role === ROLES.SUPER_ADMIN || role === ROLES.HR_MANAGER) {
    return SESSION_MAX_AGE_ADMIN_MS;
  }
  return SESSION_MAX_AGE_EMPLOYEE_MS;
}

/** HR / Super Admin may click Continue to start another full session window. */
export function canExtendSession(role: UserRole | string | undefined): boolean {
  return role === ROLES.SUPER_ADMIN || role === ROLES.HR_MANAGER;
}

/** HR / Super Admin also have a 30-minute idle logout while the absolute window is 2 hours. */
export function hasAdminIdleTimeout(role: UserRole | string | undefined): boolean {
  return canExtendSession(role);
}

/** Warn this long before the session ends (scales with role window). */
export function sessionWarningMsForRole(role: UserRole | string | undefined): number {
  const maxAge = sessionMaxAgeMsForRole(role);
  const isAdmin = canExtendSession(role);
  // Employees: last 2 minutes; admins (absolute): last 5 minutes.
  const fraction = isAdmin ? maxAge / 24 : maxAge / 15;
  const cap = isAdmin ? 5 * 60 * 1000 : 2 * 60 * 1000;
  const floor = isAdmin ? 60 * 1000 : 30 * 1000;
  return Math.min(cap, Math.max(floor, Math.floor(fraction)));
}

/** Warn this long before an admin idle logout. */
export function sessionIdleWarningMs(): number {
  return 2 * 60 * 1000;
}

export function formatSessionDuration(ms: number): string {
  const totalMinutes = Math.round(ms / 60_000);
  if (totalMinutes >= 60 && totalMinutes % 60 === 0) {
    const hours = totalMinutes / 60;
    return hours === 1 ? "1 hour" : `${hours} hours`;
  }
  return totalMinutes === 1 ? "1 minute" : `${totalMinutes} minutes`;
}

export function encodeSession(user: SessionUser): string {
  return encodeBase64Url(JSON.stringify(user));
}

export function isSessionExpired(
  user: Pick<SessionUser, "loggedInAt" | "role">,
  now = Date.now(),
): boolean {
  const startedAt = user.loggedInAt;
  if (typeof startedAt !== "number" || !Number.isFinite(startedAt) || startedAt <= 0) {
    return true;
  }
  return now - startedAt >= sessionMaxAgeMsForRole(user.role);
}

export function sessionExpiresAt(user: Pick<SessionUser, "loggedInAt" | "role">): number | null {
  if (typeof user.loggedInAt !== "number" || !Number.isFinite(user.loggedInAt)) return null;
  return user.loggedInAt + sessionMaxAgeMsForRole(user.role);
}

export function decodeSession(raw: string): SessionUser | null {
  try {
    const parsed = JSON.parse(decodeBase64Url(raw)) as SessionUser;
    if (!parsed?.id || !parsed?.role) return null;
    if (isSessionExpired(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

/** Cookie options for a login — maxAge matches the role's session window. */
export function sessionCookieOptionsForRole(role: UserRole | string | undefined) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    maxAge: Math.ceil(sessionMaxAgeMsForRole(role) / 1000),
  };
}

export const SESSION_COOKIE_CLEAR_OPTIONS = {
  path: "/",
  maxAge: 0,
};

export { COOKIE };
