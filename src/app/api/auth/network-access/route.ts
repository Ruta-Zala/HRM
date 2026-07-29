import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { decodeSession, COOKIE } from "@/lib/session";
import { canManageEmployees } from "@/lib/auth/roles";
import { evaluateNetworkAccess } from "@/lib/network-access/gate";
import { getClientIp, isValidIpv4, normalizeIp } from "@/lib/network-access/ip";
import { setNetworkGateCookie } from "@/lib/network-access/network-gate-cookie";

export const dynamic = "force-dynamic";

/**
 * Evaluates office-network access and refreshes the middleware gate cookie.
 * Accepts optional `?publicIp=` from the browser for local dev (ignored on Vercel
 * when a real forwarded public IP is present).
 */
export async function GET(req: NextRequest) {
  try {
    const raw = req.cookies.get(COOKIE)?.value;
    const user = raw ? decodeSession(raw) : null;
    const reported = normalizeIp(req.nextUrl.searchParams.get("publicIp") ?? "");
    const decision = await evaluateNetworkAccess(req, user, {
      reportedPublicIp: isValidIpv4(reported) ? reported : null,
    });

    const res = NextResponse.json({
      allowed: decision.allowed,
      reason: decision.reason,
      clientIp: decision.clientIp,
    });
    setNetworkGateCookie(res, decision.allowed, decision.clientIp);
    return res;
  } catch (error) {
    console.error("[auth/network-access]", error);
    const raw = req.cookies.get(COOKIE)?.value;
    const user = raw ? decodeSession(raw) : null;
    const clientIp = getClientIp(req);

    if (user && canManageEmployees(user.role)) {
      const res = NextResponse.json({
        allowed: true,
        reason: "admin_bypass",
        clientIp,
        error: "network_check_failed",
      });
      setNetworkGateCookie(res, true, clientIp);
      return res;
    }

    const res = NextResponse.json({
      allowed: false,
      reason: "blocked",
      clientIp,
      error: "network_check_failed",
    });
    setNetworkGateCookie(res, false, clientIp);
    return res;
  }
}
