import { NextResponse } from "next/server";

import { withActiveSession } from "@/lib/auth/api-guard";
import {
  getDriveOAuthConsentUrl,
  getDriveOAuthRedirectUri,
  isDriveOAuthConfigured,
} from "@/lib/google/drive-auth";
import { getRequestAppOrigin } from "@/lib/google/drive-oauth-request";

export const runtime = "nodejs";

export const GET = withActiveSession(async (req) => {
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
});
