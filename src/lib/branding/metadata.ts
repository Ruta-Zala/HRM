import type { Metadata } from "next";

import { getCompanyBranding } from "@/lib/branding";

/** Server metadata so the browser tab title/favicon are correct on first paint. */
export async function buildBrandingMetadata(): Promise<Metadata> {
  try {
    const branding = await getCompanyBranding();
    const company = branding.companyName.trim();
    const title = company ? `${company} — HRM Admin` : "HRM Admin";
    const bust = encodeURIComponent(branding.updatedAt || "1");

    const metadata: Metadata = {
      title: {
        default: title,
        template: company ? `%s · ${company}` : "%s · HRM Admin",
      },
      description: "Internal HRM admin — people, leave, attendance, and notifications.",
    };

    // Same as /login: only attach favicons when a company logo exists.
    if (branding.hasLogo) {
      const light = `/api/branding/public/favicon?scheme=light&v=${bust}`;
      const dark = `/api/branding/public/favicon?scheme=dark&v=${bust}`;
      metadata.icons = {
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
      };
    } else {
      // Prevent stale / default Next icons from showing a letter mark.
      metadata.icons = { icon: [] };
    }

    return metadata;
  } catch {
    return {
      title: {
        default: "HRM Admin",
        template: "%s · HRM Admin",
      },
      description: "Internal HRM admin — people, leave, attendance, and notifications.",
      icons: { icon: [] },
    };
  }
}
