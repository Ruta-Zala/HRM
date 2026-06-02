import { NextResponse } from "next/server";

import { withActiveSession } from "@/lib/auth/api-guard";
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

export const GET = withActiveSession(async (req) => {
  const oauthConnected = await isDriveOAuthConnected();

  return NextResponse.json({
    success: true,
    oauthConfigured: isDriveOAuthConfigured(),
    oauthConnected,
    oauthRedirectUri: getDriveOAuthRedirectUri(getRequestAppOrigin(req)),
    oauthSetupRedirectUris: getDriveOAuthSetupRedirectUris(),
    tokenPersistence: getDriveOAuthTokenPersistence(),
    needsEnvRefreshToken: needsDriveOAuthRefreshTokenInEnv(),
    impersonation: isDriveImpersonationEnabled(),
    driveReady: oauthConnected || isDriveImpersonationEnabled(),
  });
});
