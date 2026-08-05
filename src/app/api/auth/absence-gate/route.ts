import { NextResponse } from "next/server";

import {
  setAbsenceGateCookie,
  setMorningPunchGateCookie,
} from "@/lib/attendance/absence-gate-cookie";
import { roleRequiresAbsenceExplanationGate } from "@/lib/attendance/absence-gate";
import { syncAbsenceGateForUser } from "@/lib/attendance/absence-gate-sync";
import { userRequiresMorningPunchGate } from "@/lib/attendance/morning-punch-gate";
import { getSessionFromCookie } from "@/lib/auth/server";

export const dynamic = "force-dynamic";

/** Sync punch-desk gates and return whether site access is blocked. */
export async function GET() {
  const user = await getSessionFromCookie();
  if (!user || !roleRequiresAbsenceExplanationGate(user.role)) {
    return NextResponse.json({ active: false });
  }

  const [requiresAbsenceExplanation, requiresMorningPunch] = await Promise.all([
    syncAbsenceGateForUser(user),
    userRequiresMorningPunchGate(user),
  ]);
  const active = requiresAbsenceExplanation || requiresMorningPunch;

  const res = NextResponse.json({
    active,
    absenceExplanation: requiresAbsenceExplanation,
    morningPunch: requiresMorningPunch,
  });
  setAbsenceGateCookie(res, requiresAbsenceExplanation);
  setMorningPunchGateCookie(res, requiresMorningPunch);
  return res;
}
