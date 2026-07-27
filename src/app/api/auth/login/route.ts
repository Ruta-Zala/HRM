import { NextResponse } from "next/server";

import { syncAbsenceGateForUser } from "@/lib/attendance/absence-gate-sync";
import { setAbsenceGateCookie } from "@/lib/attendance/absence-gate-cookie";
import { roleRequiresAbsenceExplanationGate } from "@/lib/attendance/absence-gate";
import { authenticateFromSheet } from "@/lib/auth/login";
import { COOKIE, encodeSession, SESSION_COOKIE_OPTIONS } from "@/lib/session";

export async function POST(req: Request) {
  try {
    let body: { email?: string; login?: string; password?: string };
    try {
      body = (await req.json()) as typeof body;
    } catch {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const login = (body.login ?? body.email ?? "").trim();
    const password = body.password ?? "";

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

    const token = encodeSession(result.user);
    const res = NextResponse.json({
      ok: true,
      user: result.user,
      requiresAbsenceExplanation,
    });
    res.cookies.set(COOKIE, token, SESSION_COOKIE_OPTIONS);
    setAbsenceGateCookie(res, requiresAbsenceExplanation);
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
