import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { canManageEmployees } from "@/lib/auth/roles";
import { evaluateNetworkAccess } from "@/lib/network-access/gate";
import { setNetworkGateCookie } from "@/lib/network-access/network-gate-cookie";
import type { SessionUser } from "@/types/auth";

export const NETWORK_RESTRICTED_MESSAGE = "Access is limited to the office Wi‑Fi network.";

export function networkRestrictedResponse() {
  return NextResponse.json(
    {
      success: false,
      message: NETWORK_RESTRICTED_MESSAGE,
      code: "NETWORK_RESTRICTED",
    },
    { status: 403 },
  );
}

/**
 * Enforce office-network restriction for API handlers (Node runtime).
 * HR / Super Admin always pass.
 */
export async function assertNetworkAccess(
  req: Request | NextRequest,
  user: SessionUser,
): Promise<{ ok: true } | { ok: false; response: NextResponse }> {
  if (canManageEmployees(user.role)) {
    return { ok: true };
  }

  const decision = await evaluateNetworkAccess(req, user);
  if (decision.allowed) {
    return { ok: true };
  }

  const response = networkRestrictedResponse();
  setNetworkGateCookie(response, false, decision.clientIp);
  return { ok: false, response };
}
