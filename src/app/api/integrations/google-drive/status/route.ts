import { NextResponse } from "next/server";

import { withActiveSession } from "@/lib/auth/api-guard";
import {
  getDriveOAuthRedirectUri,
  getDriveOAuthSetupRedirectUris,
  isDriveOAuthConfigured,
  isDriveOAuthConnected,
} from "@/lib/google/drive-auth";
import { isDriveImpersonationEnabled } from "@/lib/google/auth";

export const GET = withActiveSession(async () => {
  const oauthConnected = await isDriveOAuthConnected();

  return NextResponse.json({
    success: true,
    oauthConfigured: isDriveOAuthConfigured(),
    oauthConnected,
    oauthRedirectUri: getDriveOAuthRedirectUri(),
    oauthSetupRedirectUris: getDriveOAuthSetupRedirectUris(),
    impersonation: isDriveImpersonationEnabled(),
    driveReady: oauthConnected || isDriveImpersonationEnabled(),
  });
});
