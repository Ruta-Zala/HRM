"use client";

import { useEffect } from "react";

import { useCompanyBranding } from "@/contexts/company-branding-provider";

const MANAGED_ATTR = "data-brand-favicon";

function brandTitle(companyName: string): string {
  const company = companyName.trim();
  return company ? `${company} — HRM Admin` : "HRM Admin";
}

function faviconHref(scheme: "light" | "dark", updatedAt: string): string {
  return `/api/branding/public/favicon?scheme=${scheme}&v=${encodeURIComponent(updatedAt || "1")}`;
}

function upsertSchemeIcon(scheme: "light" | "dark", href: string) {
  let link = document.head.querySelector<HTMLLinkElement>(`link[${MANAGED_ATTR}="${scheme}"]`);
  if (!link) {
    link = document.createElement("link");
    link.setAttribute(MANAGED_ATTR, scheme);
    link.rel = "icon";
    document.head.appendChild(link);
  }
  link.type = "image/png";
  link.setAttribute("sizes", "64x64");
  link.media = `(prefers-color-scheme: ${scheme})`;
  link.href = href;
}

function removeManagedIcons() {
  document
    .querySelectorAll<HTMLLinkElement>(`link[${MANAGED_ATTR}]`)
    .forEach((link) => link.remove());
}

/**
 * Tab title always syncs from branding.
 * Favicon links only when a company logo is uploaded (same as /login).
 */
export function DocumentBrandHead() {
  const { branding } = useCompanyBranding();

  useEffect(() => {
    const title = brandTitle(branding.companyName);
    document.title = title;
    const titleNode = document.querySelector("title");
    if (titleNode) titleNode.textContent = title;

    if (!branding.hasLogo) {
      removeManagedIcons();
      // Neutralize Next/metadata icon hrefs so a stale letter mark cannot linger.
      document.querySelectorAll<HTMLLinkElement>('link[rel="icon"]').forEach((link) => {
        link.href =
          "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO5X2ZkAAAAASUVORK5CYII=";
        link.type = "image/png";
      });
      return;
    }

    const light = faviconHref("light", branding.updatedAt);
    const dark = faviconHref("dark", branding.updatedAt);

    document.querySelectorAll<HTMLLinkElement>('link[rel="icon"]').forEach((link) => {
      const media = (link.media || "").toLowerCase();
      if (media.includes("dark")) {
        link.href = dark;
        link.type = "image/png";
      } else if (media.includes("light")) {
        link.href = light;
        link.type = "image/png";
      }
    });

    upsertSchemeIcon("light", light);
    upsertSchemeIcon("dark", dark);
  }, [branding.companyName, branding.hasLogo, branding.updatedAt]);

  return null;
}
