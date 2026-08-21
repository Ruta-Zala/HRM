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

export const BRANDING_UPLOAD_LIMITS = {
  logoMaxBytes: 512 * 1024,
  backgroundMaxBytes: 900 * 1024,
  allowedMimeTypes: ["image/png", "image/jpeg", "image/webp"] as const,
} as const;
