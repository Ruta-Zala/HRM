import { NextResponse } from "next/server";

import {
  isAbsenceGateCookieActive,
  ABSENCE_GATE_COOKIE,
} from "@/lib/attendance/absence-gate-cookie";
import { roleRequiresAbsenceExplanationGate } from "@/lib/attendance/absence-gate";
import { getSessionFromCookie } from "@/lib/auth/server";

export const dynamic = "force-dynamic";

/** Fast gate check — reads cookie only, no Google Sheets calls. */
export async function GET() {
  const user = await getSessionFromCookie();
  if (!user || !roleRequiresAbsenceExplanationGate(user.role)) {
    return NextResponse.json({ active: false });
  }

  const cookieValue = (await import("next/headers")).cookies;
  const gateCookie = (await cookieValue()).get(ABSENCE_GATE_COOKIE)?.value;

  return NextResponse.json({
    active: isAbsenceGateCookieActive(gateCookie),
  });
}
