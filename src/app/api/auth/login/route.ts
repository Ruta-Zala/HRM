import { NextResponse } from "next/server";

import { syncAbsenceGateForUser } from "@/lib/attendance/absence-gate-sync";
import {
  setAbsenceGateCookie,
  setMorningPunchGateCookie,
} from "@/lib/attendance/absence-gate-cookie";
import { roleRequiresAbsenceExplanationGate } from "@/lib/attendance/absence-gate";
import { userRequiresMorningPunchGate } from "@/lib/attendance/morning-punch-gate";
import { ensureForgottenPunchOutForUser } from "@/lib/attendance/auto-punch-out";
import { authenticateFromSheet } from "@/lib/auth/login";
import { evaluateNetworkAccess } from "@/lib/network-access/gate";
import { isValidIpv4, normalizeIp } from "@/lib/network-access/ip";
import { setNetworkGateCookie } from "@/lib/network-access/network-gate-cookie";
import { COOKIE, encodeSession, sessionCookieOptionsForRole } from "@/lib/session";

const LOGIN_RETRY_DELAYS_MS = [150, 350];

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function authenticateWithRetry(login: string, password: string) {
  let lastError: unknown;
  for (let attempt = 0; attempt <= LOGIN_RETRY_DELAYS_MS.length; attempt++) {
    try {
      return await authenticateFromSheet(login, password);
    } catch (error) {
      lastError = error;
      if (attempt < LOGIN_RETRY_DELAYS_MS.length) {
        await sleep(LOGIN_RETRY_DELAYS_MS[attempt]);
        continue;
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Authentication failed");
}

export async function POST(req: Request) {
  try {
    let body: {
      email?: string;
      login?: string;
      password?: string;
      /** Browser-detected public IP — used only when the server sees localhost (local dev). */
      publicIp?: string;
    };
    try {
      body = (await req.json()) as typeof body;
    } catch {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const login = (body.login ?? body.email ?? "").trim();
    const password = body.password ?? "";
    const reportedPublicIp = normalizeIp(body.publicIp ?? "");
    const safeReportedIp = isValidIpv4(reportedPublicIp) ? reportedPublicIp : null;

    const result = await authenticateWithRetry(login, password);

    if (!result.ok) {
      if (result.reason === "account_inactive") {
        return NextResponse.json(
          {
            error:
              "Your account is inactive. You cannot sign in. Contact HR or your administrator.",
            code: "ACCOUNT_INACTIVE",
          },
          { status: 403 },
        );
      }

      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    let requiresAbsenceExplanation = false;
    let requiresMorningPunch = false;
    if (roleRequiresAbsenceExplanationGate(result.user.role)) {
      try {
        requiresAbsenceExplanation = await syncAbsenceGateForUser(result.user, {
          forceRefresh: true,
        });
      } catch (error) {
        // Absence gate sync is non-critical for successful authentication.
        console.warn("[auth/login] absence gate sync failed:", error);
      }

      try {
        requiresMorningPunch = await userRequiresMorningPunchGate(result.user);
      } catch (error) {
        console.warn("[auth/login] morning punch gate sync failed:", error);
      }

      try {
        // Catch up forgotten punch-outs from prior days and create the employee notification.
        await ensureForgottenPunchOutForUser(result.user);
      } catch (error) {
        console.warn("[auth/login] auto punch-out catch-up failed:", error);
      }
    }

    let network = {
      allowed: true,
      reason: "restriction_disabled",
      clientIp: safeReportedIp ?? "",
    };
    try {
      network = await evaluateNetworkAccess(req, result.user, {
        reportedPublicIp: safeReportedIp,
      });
    } catch (error) {
      // Network evaluation should not fail sign-in on transient dependency issues.
      console.warn("[auth/login] network check failed, allowing temporary access:", error);
    }

    const token = encodeSession({ ...result.user, loggedInAt: Date.now() });
    const requiresSiteGate = requiresAbsenceExplanation || requiresMorningPunch;
    const res = NextResponse.json({
      ok: true,
      user: result.user,
      requiresAbsenceExplanation,
      requiresMorningPunch,
      requiresSiteGate,
      networkAllowed: network.allowed,
      networkReason: network.reason,
      clientIp: network.clientIp,
    });
    res.cookies.set(COOKIE, token, sessionCookieOptionsForRole(result.user.role));
    setAbsenceGateCookie(res, requiresAbsenceExplanation);
    setMorningPunchGateCookie(res, requiresMorningPunch);
    setNetworkGateCookie(res, network.allowed, network.clientIp);
    return res;
  } catch (error) {
    console.error("[auth/login]", error);
    return NextResponse.json(
      {
        error: "Sign-in is temporarily unavailable. Please try again.",
      },
      { status: 500 },
    );
  }
}
