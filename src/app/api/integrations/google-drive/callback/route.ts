import { NextRequest, NextResponse } from "next/server";

import { createDriveOAuth2Client, saveDriveOAuthTokens } from "@/lib/google/drive-auth";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const oauthError = req.nextUrl.searchParams.get("error");
  const redirectBase = new URL("/integrations/google-drive", req.nextUrl.origin);

  if (oauthError) {
    redirectBase.searchParams.set("error", oauthError);
    return NextResponse.redirect(redirectBase);
  }

  if (!code) {
    redirectBase.searchParams.set("error", "missing_code_complete_oauth_in_browser");
    return NextResponse.redirect(redirectBase);
  }

  const client = createDriveOAuth2Client();
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
