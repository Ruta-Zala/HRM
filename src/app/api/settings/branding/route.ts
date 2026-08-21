import { NextResponse } from "next/server";

import { withActiveSession } from "@/lib/auth/api-guard";
import { canManageCompanyBranding } from "@/lib/auth/roles";
import { getCompanyBranding, updateCompanyBranding } from "@/lib/branding";
import { toApiErrorMessage } from "@/lib/api/user-facing-error";

export const dynamic = "force-dynamic";

/** Any authenticated user can read branding (letters, sidebar, slips). */
export const GET = withActiveSession(async () => {
  try {
    const branding = await getCompanyBranding();
    return NextResponse.json({ success: true, branding });
  } catch (error) {
    console.error("GET Company Branding Error:", error);
    return NextResponse.json(
      {
        success: false,
        message: toApiErrorMessage(error, "Failed to load company branding"),
      },
      { status: 500 },
    );
  }
});

/** Super Admin only — update text fields. */
export const PATCH = withActiveSession(async (req, user) => {
  if (!canManageCompanyBranding(user.role)) {
    return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
  }

  try {
    const body = (await req.json()) as Record<string, unknown>;
    const branding = await updateCompanyBranding(
      {
        companyName: typeof body.companyName === "string" ? body.companyName : undefined,
        companyAddress: typeof body.companyAddress === "string" ? body.companyAddress : undefined,
        signatoryName: typeof body.signatoryName === "string" ? body.signatoryName : undefined,
        hrTitle: typeof body.hrTitle === "string" ? body.hrTitle : undefined,
        supportEmail: typeof body.supportEmail === "string" ? body.supportEmail : undefined,
        websiteUrl: typeof body.websiteUrl === "string" ? body.websiteUrl : undefined,
      },
      user.email || user.name || user.id || "super_admin",
    );
    return NextResponse.json({ success: true, branding });
  } catch (error) {
    console.error("PATCH Company Branding Error:", error);
    return NextResponse.json(
      {
        success: false,
        message: toApiErrorMessage(error, "Failed to update company branding"),
      },
      { status: 500 },
    );
  }
});
