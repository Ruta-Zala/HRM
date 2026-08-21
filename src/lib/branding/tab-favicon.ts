import sharp from "sharp";

import { getBrandingAssetBytes, getCompanyBranding } from "@/lib/branding";

export type FaviconScheme = "light" | "dark";

const SIZE = 64;
/** Logo drawn smaller than the canvas so the tab mark has breathing room. */
const LOGO_SIZE = 60;

/**
 * Tab favicons for prefers-color-scheme:
 * - light: original logo (dark mark on transparent)
 * - dark: inverted logo (light mark on transparent) so it stays visible on dark tabs
 */
export async function renderSchemeFavicon(scheme: FaviconScheme): Promise<Response> {
  const branding = await getCompanyBranding().catch(() => null);
  const asset = branding?.hasLogo ? await getBrandingAssetBytes("logo").catch(() => null) : null;

  if (asset?.buffer?.length) {
    let logo = sharp(asset.buffer).resize(LOGO_SIZE, LOGO_SIZE, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    });

    if (scheme === "dark") {
      // Flip luminance so dark logos become light on dark browser chrome.
      logo = logo.negate({ alpha: false });
    }

    const logoPng = await logo.png().toBuffer();
    const offset = Math.round((SIZE - LOGO_SIZE) / 2);
    const png = await sharp({
      create: {
        width: SIZE,
        height: SIZE,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    })
      .composite([{ input: logoPng, left: offset, top: offset }])
      .png()
      .toBuffer();

    return new Response(new Uint8Array(png), {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=60",
      },
    });
  }

  // No logo: company initial, or "H" for HRM when name is empty.
  const initial = firstFaviconLetter(branding?.companyName);
  const color = scheme === "dark" ? "#e2e8f0" : "#334155";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">
  <circle cx="32" cy="32" r="26" fill="none" stroke="${color}" stroke-width="3"/>
  <text x="32" y="44" text-anchor="middle" font-family="Arial,sans-serif" font-size="32" font-weight="700" fill="${color}">${escapeXml(initial)}</text>
</svg>`;

  const png = await sharp(Buffer.from(svg)).png().toBuffer();
  return new Response(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=60",
    },
  });
}

function firstFaviconLetter(companyName: string | undefined): string {
  const trimmed = companyName?.trim() ?? "";
  if (!trimmed) return "H";
  const letter = [...trimmed][0]?.toUpperCase();
  return letter || "H";
}

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

export function parseFaviconScheme(raw: string | null): FaviconScheme {
  return raw === "dark" ? "dark" : "light";
}
