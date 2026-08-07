import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { isSessionUserActive } from "@/lib/auth/account-status";
import { getSessionFromCookie } from "@/lib/auth/server";
import { COOKIE, SESSION_COOKIE_CLEAR_OPTIONS } from "@/lib/session";

export async function GET() {
  try {
    const raw = (await cookies()).get(COOKIE)?.value;
    const user = await getSessionFromCookie();
    if (!user) {
      const res = NextResponse.json({ user: null });
      // Drop expired / invalid cookies so the browser does not keep a dead session.
      if (raw) res.cookies.set(COOKIE, "", SESSION_COOKIE_CLEAR_OPTIONS);
      return res;
    }

    const active = await isSessionUserActive(user);
    if (!active) {
      const res = NextResponse.json({ user: null, inactive: true });
      res.cookies.set(COOKIE, "", SESSION_COOKIE_CLEAR_OPTIONS);
      return res;
    }

    return NextResponse.json({ user });
  } catch (error) {
    console.error("[auth/me]", error);
    return NextResponse.json({ user: null, error: "session_check_failed" });
  }
}
