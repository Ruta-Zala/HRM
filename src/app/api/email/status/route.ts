import { NextResponse } from "next/server";

import { withActiveSession } from "@/lib/auth/api-guard";
import { canManageEmployees } from "@/lib/auth/roles";
import { getEmailConfigIssue, isEmailConfigured } from "@/lib/email/config";

export const GET = withActiveSession(async (_req, user) => {
  if (!canManageEmployees(user.role)) {
    return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
  }

  const issue = getEmailConfigIssue();

  return NextResponse.json({
    success: true,
    configured: isEmailConfigured(),
    issue,
  });
});
