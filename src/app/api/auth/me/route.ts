import { NextResponse } from "next/server";

import { isSessionUserActive } from "@/lib/auth/account-status";
import { getSessionFromCookie } from "@/lib/auth/server";
import { COOKIE } from "@/lib/session";

export async function GET() {
  try {
    const user = await getSessionFromCookie();
    if (!user) {
      return NextResponse.json({ user: null });
    }

    const active = await isSessionUserActive(user);
    if (!active) {
      const res = NextResponse.json({ user: null, inactive: true });
      res.cookies.set(COOKIE, "", { path: "/", maxAge: 0 });
      return res;
    }

    return NextResponse.json({ user });
  } catch (error) {
    console.error("[auth/me]", error);
    return NextResponse.json({ user: null, error: "session_check_failed" });
  }
}
