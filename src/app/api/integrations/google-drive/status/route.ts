import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { canManageEmployees } from "@/lib/auth/roles";
import { getSessionFromCookie } from "@/lib/auth/server";
import {
  getDriveOAuthRedirectUri,
  getDriveOAuthSetupRedirectUris,
  getDriveOAuthTokenPersistence,
  isDriveOAuthConfigured,
  isDriveOAuthConnected,
  needsDriveOAuthRefreshTokenInEnv,
} from "@/lib/google/drive-auth";
import { getRequestAppOrigin } from "@/lib/google/drive-oauth-request";
import { isDriveImpersonationEnabled } from "@/lib/google/auth";

export async function GET(req: NextRequest) {
  const user = await getSessionFromCookie();
  if (!user) {
    return NextResponse.json({ success: false, message: "Not authenticated." }, { status: 401 });
  }
  if (!canManageEmployees(user.role)) {
    return NextResponse.json({ success: false, message: "Forbidden." }, { status: 403 });
  }

  try {
    const oauthConnected = await isDriveOAuthConnected();
    const impersonation = isDriveImpersonationEnabled();
    return NextResponse.json({
      success: true,
      oauthConfigured: isDriveOAuthConfigured(),
      oauthConnected,
      oauthRedirectUri: getDriveOAuthRedirectUri(getRequestAppOrigin(req)),
      oauthSetupRedirectUris: getDriveOAuthSetupRedirectUris(),
      tokenPersistence: getDriveOAuthTokenPersistence(),
      needsEnvRefreshToken: needsDriveOAuthRefreshTokenInEnv(),
      impersonation,
      driveReady: oauthConnected || impersonation,
    });
  } catch (error) {
    console.error("[google-drive/status]", error);
    return NextResponse.json(
      {
        success: false,
        message: "Could not read Google Drive connection status.",
        oauthConfigured: isDriveOAuthConfigured(),
      },
      { status: 200 },
    );
  }
}
