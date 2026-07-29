import { NextResponse } from "next/server";

import { syncAbsenceGateForUser } from "@/lib/attendance/absence-gate-sync";
import { setAbsenceGateCookie } from "@/lib/attendance/absence-gate-cookie";
import { roleRequiresAbsenceExplanationGate } from "@/lib/attendance/absence-gate";
import { authenticateFromSheet } from "@/lib/auth/login";
import { evaluateNetworkAccess } from "@/lib/network-access/gate";
import { isValidIpv4, normalizeIp } from "@/lib/network-access/ip";
import { setNetworkGateCookie } from "@/lib/network-access/network-gate-cookie";
import { COOKIE, encodeSession, SESSION_COOKIE_OPTIONS } from "@/lib/session";

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

    const result = await authenticateFromSheet(login, password);

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
    if (roleRequiresAbsenceExplanationGate(result.user.role)) {
      requiresAbsenceExplanation = await syncAbsenceGateForUser(result.user, {
        forceRefresh: true,
      });
    }

    const network = await evaluateNetworkAccess(req, result.user, {
      reportedPublicIp: safeReportedIp,
    });

    const token = encodeSession(result.user);
    const res = NextResponse.json({
      ok: true,
      user: result.user,
      requiresAbsenceExplanation,
      networkAllowed: network.allowed,
      networkReason: network.reason,
      clientIp: network.clientIp,
    });
    res.cookies.set(COOKIE, token, SESSION_COOKIE_OPTIONS);
    setAbsenceGateCookie(res, requiresAbsenceExplanation);
    setNetworkGateCookie(res, network.allowed, network.clientIp);
    return res;
  } catch (error) {
    console.error("[auth/login]", error);
    return NextResponse.json(
      {
        error:
          "Sign-in is temporarily unavailable. Verify Google Sheets credentials in server env.",
      },
      { status: 500 },
    );
  }
}
