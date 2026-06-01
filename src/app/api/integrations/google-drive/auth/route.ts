import { NextResponse } from "next/server";

import { withActiveSession } from "@/lib/auth/api-guard";
import { getDriveOAuthConsentUrl, isDriveOAuthConfigured } from "@/lib/google/drive-auth";

export const runtime = "nodejs";

export const GET = withActiveSession(async () => {
  if (!isDriveOAuthConfigured()) {
    return NextResponse.json(
      {
        success: false,
        message: "Add GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET to .env.local.",
      },
      { status: 400 },
    );
  }

  const url = getDriveOAuthConsentUrl();
  if (!url) {
    return NextResponse.json(
      { success: false, message: "Could not build Google OAuth URL." },
      { status: 500 },
    );
  }

  return NextResponse.redirect(url);
});
