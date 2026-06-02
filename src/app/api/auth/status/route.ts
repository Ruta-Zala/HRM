import { NextResponse } from "next/server";

import { isSessionUserActive } from "@/lib/auth/account-status";
import { getSessionFromCookie } from "@/lib/auth/server";

export async function GET() {
  try {
    const user = await getSessionFromCookie();
    if (!user) {
      return NextResponse.json({
        authenticated: false,
        active: false,
      });
    }

    const active = await isSessionUserActive(user);
    return NextResponse.json({
      authenticated: true,
      active,
    });
  } catch (error) {
    console.error("[auth/status]", error);
    return NextResponse.json({
      authenticated: false,
      active: false,
      error: "status_check_failed",
    });
  }
}
