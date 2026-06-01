import { NextResponse } from "next/server";

import { authenticateFromSheet } from "@/lib/auth/login";
import { COOKIE, encodeSession, SESSION_COOKIE_OPTIONS } from "@/lib/session";

export async function POST(req: Request) {
  const body = (await req.json()) as {
    email?: string;
    login?: string;
    password?: string;
  };

  const login = (body.login ?? body.email ?? "").trim();
  const password = body.password ?? "";

  const result = await authenticateFromSheet(login, password);

  if (!result.ok) {
    if (result.reason === "account_inactive") {
      return NextResponse.json(
        {
          error: "Your account is inactive. You cannot sign in. Contact HR or your administrator.",
          code: "ACCOUNT_INACTIVE",
        },
        { status: 403 },
      );
    }

    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const token = encodeSession(result.user);
  const res = NextResponse.json({ ok: true, user: result.user });
  res.cookies.set(COOKIE, token, SESSION_COOKIE_OPTIONS);
  return res;
}
