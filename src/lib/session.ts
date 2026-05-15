import type { SessionUser, UserRole } from "@/types/auth";

const COOKIE = "exhibyte_session";

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

export function encodeSession(user: SessionUser): string {
  return encodeBase64Url(JSON.stringify(user));
}

export function decodeSession(raw: string): SessionUser | null {
  try {
    const parsed = JSON.parse(decodeBase64Url(raw)) as SessionUser;
    if (!parsed?.id || !parsed?.role) return null;
    return parsed;
  } catch {
    return null;
  }
}

export { COOKIE };

export const demoUsers: Record<
  string,
  { password: string; user: SessionUser }
> = {
  "admin@exhibyte.local": {
    password: "demo",
    user: {
      id: "1",
      email: "admin@exhibyte.local",
      name: "Asha Verma",
      role: "super_admin",
      department: "Leadership",
    },
  },
  "hr@exhibyte.local": {
    password: "demo",
    user: {
      id: "2",
      email: "hr@exhibyte.local",
      name: "Rahul Mehta",
      role: "hr",
      department: "Human Resources",
    },
  },
  "employee@exhibyte.local": {
    password: "demo",
    user: {
      id: "3",
      email: "employee@exhibyte.local",
      name: "Neha Kapoor",
      role: "employee",
      department: "Engineering",
    },
  },
};

export function resolveDemoLogin(
  email: string,
  password: string,
  roleOverride?: UserRole,
): SessionUser | null {
  const entry = demoUsers[email.toLowerCase()];
  if (!entry || entry.password !== password) return null;
  if (roleOverride && entry.user.role !== roleOverride) {
    return { ...entry.user, role: roleOverride };
  }
  return entry.user;
}
