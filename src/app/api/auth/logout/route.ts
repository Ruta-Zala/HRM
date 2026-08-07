import { NextResponse } from "next/server";

import {
  clearAbsenceGateCookie,
  clearMorningPunchGateCookie,
} from "@/lib/attendance/absence-gate-cookie";
import { COOKIE, SESSION_COOKIE_CLEAR_OPTIONS } from "@/lib/session";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE, "", SESSION_COOKIE_CLEAR_OPTIONS);
  clearAbsenceGateCookie(res);
  clearMorningPunchGateCookie(res);
  return res;
}
