import { NextResponse } from "next/server";

import { isSessionUserActive } from "@/lib/auth/account-status";
import { getSessionFromCookie } from "@/lib/auth/server";
import {
  COOKIE,
  canExtendSession,
  encodeSession,
  sessionCookieOptionsForRole,
  SESSION_COOKIE_CLEAR_OPTIONS,
} from "@/lib/session";

/**
 * HR / Super Admin only: starts a new session window from now
 * (another full role timeout, e.g. 5 minutes in test / 2 hours in production).
 */
export async function POST() {
  try {
    const user = await getSessionFromCookie();
    if (!user) {
      return NextResponse.json({ ok: false, error: "Not signed in" }, { status: 401 });
    }

    if (!canExtendSession(user.role)) {
      return NextResponse.json(
        { ok: false, error: "Session extend is not available for this role" },
        { status: 403 },
      );
    }

    const active = await isSessionUserActive(user);
    if (!active) {
      const res = NextResponse.json({ ok: false, inactive: true }, { status: 401 });
      res.cookies.set(COOKIE, "", SESSION_COOKIE_CLEAR_OPTIONS);
      return res;
    }

    const nextUser = { ...user, loggedInAt: Date.now() };
    const res = NextResponse.json({ ok: true, user: nextUser });
    res.cookies.set(COOKIE, encodeSession(nextUser), sessionCookieOptionsForRole(nextUser.role));
    return res;
  } catch (error) {
    console.error("[auth/extend]", error);
    return NextResponse.json({ ok: false, error: "Could not extend session" }, { status: 500 });
  }
}
