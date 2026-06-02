import { NextRequest, NextResponse } from "next/server";

import {
  createDriveOAuth2Client,
  getDriveOAuthRedirectUri,
  saveDriveOAuthTokens,
} from "@/lib/google/drive-auth";
import { getRequestAppOrigin } from "@/lib/google/drive-oauth-request";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const oauthError = req.nextUrl.searchParams.get("error");
  const appOrigin = getRequestAppOrigin(req);
  const redirectBase = new URL("/integrations/google-drive", appOrigin);

  if (oauthError) {
    redirectBase.searchParams.set("error", oauthError);
    return NextResponse.redirect(redirectBase);
  }

  if (!code) {
    redirectBase.searchParams.set("error", "missing_code_complete_oauth_in_browser");
    return NextResponse.redirect(redirectBase);
  }

  const redirectUri = getDriveOAuthRedirectUri(appOrigin);
  const client = createDriveOAuth2Client(redirectUri);
  if (!client) {
    redirectBase.searchParams.set("error", "oauth_not_configured");
    return NextResponse.redirect(redirectBase);
  }

  try {
    const { tokens } = await client.getToken(code);
    await saveDriveOAuthTokens(tokens);

    redirectBase.searchParams.set("connected", "1");
    return NextResponse.redirect(redirectBase);
  } catch (error) {
    console.error("CALLBACK ERROR:", error);

    const message = error instanceof Error ? error.message : "token_exchange_failed";

    redirectBase.searchParams.set("error", message);

    return NextResponse.redirect(redirectBase);
  }
}
