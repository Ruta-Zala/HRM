import { NextResponse } from "next/server";

import { canManageEmployees } from "@/lib/auth/roles";
import { getSessionFromCookie } from "@/lib/auth/server";
import {
  getDriveOAuthConsentUrl,
  getDriveOAuthRedirectUri,
  isDriveOAuthConfigured,
} from "@/lib/google/drive-auth";
import { getRequestAppOrigin } from "@/lib/google/drive-oauth-request";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const user = await getSessionFromCookie();
  if (!user) {
    return NextResponse.json({ success: false, message: "Not authenticated." }, { status: 401 });
  }
  if (!canManageEmployees(user.role)) {
    return NextResponse.json({ success: false, message: "Forbidden." }, { status: 403 });
  }

  if (!isDriveOAuthConfigured()) {
    return NextResponse.json(
      {
        success: false,
        message: "Add GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET to .env.local.",
      },
      { status: 400 },
    );
  }

  const redirectUri = getDriveOAuthRedirectUri(getRequestAppOrigin(req));
  const url = getDriveOAuthConsentUrl(redirectUri);
  if (!url) {
    return NextResponse.json(
      { success: false, message: "Could not build Google OAuth URL." },
      { status: 500 },
    );
  }

  return NextResponse.redirect(url);
}
