import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { COOKIE, decodeSession } from "@/lib/session";

export async function GET() {
  const raw = (await cookies()).get(COOKIE)?.value;
  if (!raw) return NextResponse.json({ user: null });
  const user = decodeSession(raw);
  return NextResponse.json({ user });
}
