import { NextResponse } from "next/server";
import { COOKIE, encodeSession, resolveDemoLogin } from "@/lib/session";
import type { UserRole } from "@/types/auth";

export async function POST(req: Request) {
  const body = (await req.json()) as {
    email?: string;
    password?: string;
    role?: UserRole;
  };
  const email = body.email?.trim() ?? "";
  const password = body.password ?? "";
  const user = resolveDemoLogin(email, password, body.role);
  if (!user) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }
  const token = encodeSession(user);
  const res = NextResponse.json({ ok: true, user });
  res.cookies.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  return res;
}
