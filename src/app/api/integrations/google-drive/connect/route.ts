import { NextResponse } from "next/server";

import { withActiveSession } from "@/lib/auth/api-guard";

/** Alias for /auth — some UIs link here. */
export const GET = withActiveSession(async (req) => {
  return NextResponse.redirect(new URL("/api/integrations/google-drive/auth", req.url));
});
