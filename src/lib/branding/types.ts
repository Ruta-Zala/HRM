export type CompanyBranding = {
  companyName: string;
  companyAddress: string;
  signatoryName: string;
  hrTitle: string;
  supportEmail: string;
  websiteUrl: string;
  /** Public URL to stream logo when uploaded; null if unset. */
  logoUrl: string | null;
  /** Public URL to stream letter background when uploaded; null if unset. */
  backgroundUrl: string | null;
  hasLogo: boolean;
  hasBackground: boolean;
  updatedAt: string;
  updatedBy: string;
};

export type CompanyBrandingUpdate = {
  companyName?: string;
  companyAddress?: string;
  signatoryName?: string;
  hrTitle?: string;
  supportEmail?: string;
  websiteUrl?: string;
};

export type BrandingAssetKind = "logo" | "background";

/** Fresh-site defaults — blank until Super Admin configures branding. */
export const EMPTY_COMPANY_BRANDING: CompanyBranding = {
  companyName: "",
  companyAddress: "",
  signatoryName: "Authorised Signatory",
  hrTitle: "HR Manager",
  supportEmail: "",
  websiteUrl: "",
  logoUrl: null,
  backgroundUrl: null,
  hasLogo: false,
  hasBackground: false,
  updatedAt: "",
  updatedBy: "",
};

export const BRANDING_ASSET_URLS = {
  logo: "/api/branding/assets/logo",
  background: "/api/branding/assets/background",
} as const;

/** Logo is also used as favicon — PNG / ICO only. */
export const LOGO_MIME_TYPES = ["image/png", "image/x-icon", "image/vnd.microsoft.icon"] as const;

/** Letter background can stay broader for print quality. */
export const BACKGROUND_MIME_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;

export const BRANDING_UPLOAD_LIMITS = {
  logoMaxBytes: 512 * 1024,
  backgroundMaxBytes: 900 * 1024,
  /** @deprecated Prefer logoMimeTypes / backgroundMimeTypes */
  allowedMimeTypes: BACKGROUND_MIME_TYPES,
  logoMimeTypes: LOGO_MIME_TYPES,
  backgroundMimeTypes: BACKGROUND_MIME_TYPES,
} as const;

export function allowedMimeTypesForKind(kind: BrandingAssetKind): readonly string[] {
  return kind === "logo"
    ? BRANDING_UPLOAD_LIMITS.logoMimeTypes
    : BRANDING_UPLOAD_LIMITS.backgroundMimeTypes;
}

export function isAllowedBrandingMime(
  kind: BrandingAssetKind,
  mimeType: string,
  fileName?: string,
): boolean {
  const mime = mimeType.trim().toLowerCase();
  if (allowedMimeTypesForKind(kind).includes(mime)) return true;

  // Some browsers leave .ico type empty or as octet-stream.
  if (kind === "logo") {
    const name = (fileName || "").toLowerCase();
    if (name.endsWith(".ico") && (mime === "" || mime === "application/octet-stream")) {
      return true;
    }
    if (name.endsWith(".png") && (mime === "" || mime === "application/octet-stream")) {
      return true;
    }
  }
  return false;
}

export function acceptAttrForKind(kind: BrandingAssetKind): string {
  return kind === "logo"
    ? "image/png,image/x-icon,image/vnd.microsoft.icon,.png,.ico"
    : "image/png,image/jpeg,image/webp";
}

export function formatHintForKind(kind: BrandingAssetKind): string {
  return kind === "logo"
    ? "Only PNG or ICO images are allowed."
    : "Only PNG, JPEG, or WebP images are allowed.";
}
