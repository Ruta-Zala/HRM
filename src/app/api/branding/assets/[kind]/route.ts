import { NextResponse } from "next/server";

import { withActiveSession, type ApiRouteContext } from "@/lib/auth/api-guard";
import { canManageCompanyBranding } from "@/lib/auth/roles";
import {
  BRANDING_UPLOAD_LIMITS,
  clearBrandingAsset,
  getBrandingAssetBytes,
  saveBrandingAsset,
  type BrandingAssetKind,
} from "@/lib/branding";
import { toApiErrorMessage } from "@/lib/api/user-facing-error";

export const dynamic = "force-dynamic";

function parseKind(raw: string | undefined): BrandingAssetKind | null {
  if (raw === "logo" || raw === "background") return raw;
  return null;
}

/** Stream logo / letter background for letters and UI. */
export const GET = withActiveSession(async (_req, _user, context: ApiRouteContext) => {
  try {
    const { kind: rawKind } = await context.params;
    const kind = parseKind(rawKind);
    if (!kind) {
      return NextResponse.json({ success: false, message: "Unknown asset" }, { status: 404 });
    }

    const asset = await getBrandingAssetBytes(kind);
    if (!asset) {
      return NextResponse.json({ success: false, message: "Asset not set" }, { status: 404 });
    }

    return new NextResponse(new Uint8Array(asset.buffer), {
      status: 200,
      headers: {
        "Content-Type": asset.mimeType,
        "Cache-Control": "private, max-age=60",
      },
    });
  } catch (error) {
    console.error("GET Branding Asset Error:", error);
    return NextResponse.json(
      {
        success: false,
        message: toApiErrorMessage(error, "Failed to load branding asset"),
      },
      { status: 500 },
    );
  }
});

/** Super Admin — upload logo or background image. */
export const POST = withActiveSession(async (req, user, context: ApiRouteContext) => {
  if (!canManageCompanyBranding(user.role)) {
    return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
  }

  try {
    const { kind: rawKind } = await context.params;
    const kind = parseKind(rawKind);
    if (!kind) {
      return NextResponse.json({ success: false, message: "Unknown asset" }, { status: 404 });
    }

    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ success: false, message: "file is required" }, { status: 400 });
    }

    const mimeType = (file.type || "application/octet-stream").toLowerCase();
    if (
      !BRANDING_UPLOAD_LIMITS.allowedMimeTypes.includes(
        mimeType as (typeof BRANDING_UPLOAD_LIMITS.allowedMimeTypes)[number],
      )
    ) {
      return NextResponse.json(
        { success: false, message: "Only PNG, JPEG, or WebP images are allowed" },
        { status: 400 },
      );
    }

    const maxBytes =
      kind === "logo"
        ? BRANDING_UPLOAD_LIMITS.logoMaxBytes
        : BRANDING_UPLOAD_LIMITS.backgroundMaxBytes;
    const buffer = Buffer.from(await file.arrayBuffer());
    if (buffer.byteLength === 0) {
      return NextResponse.json({ success: false, message: "Empty file" }, { status: 400 });
    }
    if (buffer.byteLength > maxBytes) {
      return NextResponse.json(
        {
          success: false,
          message: `Image too large (max ${Math.round(maxBytes / 1024)} KB)`,
        },
        { status: 400 },
      );
    }

    const branding = await saveBrandingAsset(
      kind,
      buffer,
      mimeType,
      user.email || user.name || user.id || "super_admin",
    );
    return NextResponse.json({ success: true, branding });
  } catch (error) {
    console.error("POST Branding Asset Error:", error);
    return NextResponse.json(
      {
        success: false,
        message: toApiErrorMessage(error, "Failed to upload branding asset"),
      },
      { status: 500 },
    );
  }
});

/** Super Admin — remove logo or background. */
export const DELETE = withActiveSession(async (_req, user, context: ApiRouteContext) => {
  if (!canManageCompanyBranding(user.role)) {
    return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
  }

  try {
    const { kind: rawKind } = await context.params;
    const kind = parseKind(rawKind);
    if (!kind) {
      return NextResponse.json({ success: false, message: "Unknown asset" }, { status: 404 });
    }

    const branding = await clearBrandingAsset(
      kind,
      user.email || user.name || user.id || "super_admin",
    );
    return NextResponse.json({ success: true, branding });
  } catch (error) {
    console.error("DELETE Branding Asset Error:", error);
    return NextResponse.json(
      {
        success: false,
        message: toApiErrorMessage(error, "Failed to remove branding asset"),
      },
      { status: 500 },
    );
  }
});
