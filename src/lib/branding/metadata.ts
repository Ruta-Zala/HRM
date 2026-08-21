import type { Metadata } from "next";

import { getCompanyBranding } from "@/lib/branding";

/** Server metadata so the browser tab title/favicon are correct on first paint. */
export async function buildBrandingMetadata(): Promise<Metadata> {
  try {
    const branding = await getCompanyBranding();
    const company = branding.companyName.trim();
    const title = company ? `${company} — HRM Admin` : "HRM Admin";
    const bust = encodeURIComponent(branding.updatedAt || "1");
    const light = `/api/branding/public/favicon?scheme=light&v=${bust}`;
    const dark = `/api/branding/public/favicon?scheme=dark&v=${bust}`;

    return {
      title: {
        default: title,
        template: company ? `%s · ${company}` : "%s · HRM Admin",
      },
      description: "Internal HRM admin — people, leave, attendance, and notifications.",
      icons: {
        icon: [
          {
            url: light,
            type: "image/png",
            sizes: "64x64",
            media: "(prefers-color-scheme: light)",
          },
          {
            url: dark,
            type: "image/png",
            sizes: "64x64",
            media: "(prefers-color-scheme: dark)",
          },
        ],
      },
    };
  } catch {
    return {
      title: {
        default: "HRM Admin",
        template: "%s · HRM Admin",
      },
      description: "Internal HRM admin — people, leave, attendance, and notifications.",
      icons: {
        icon: [
          {
            url: "/api/branding/public/favicon?scheme=light",
            type: "image/png",
            media: "(prefers-color-scheme: light)",
          },
          {
            url: "/api/branding/public/favicon?scheme=dark",
            type: "image/png",
            media: "(prefers-color-scheme: dark)",
          },
        ],
      },
    };
  }
}
