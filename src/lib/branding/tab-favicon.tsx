import { ImageResponse } from "next/og";
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
 *
 * Letter fallbacks use `next/og` (Satori) so text renders on Vercel, where Sharp/SVG
 * has no system fonts (circle-only / empty letter).
 */
export async function renderSchemeFavicon(scheme: FaviconScheme): Promise<Response> {
  const branding = await getCompanyBranding().catch(() => null);
  const asset = branding?.hasLogo ? await getBrandingAssetBytes("logo").catch(() => null) : null;

  if (asset?.buffer?.length) {
    try {
      return await renderLogoFavicon(scheme, asset.buffer);
    } catch (error) {
      console.error("Favicon logo render failed; falling back to letter:", error);
    }
  }

  return renderLetterFavicon(scheme, firstFaviconLetter(branding?.companyName));
}

async function renderLogoFavicon(scheme: FaviconScheme, buffer: Buffer): Promise<Response> {
  let logo = sharp(buffer).resize(LOGO_SIZE, LOGO_SIZE, {
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

function renderLetterFavicon(scheme: FaviconScheme, letter: string): ImageResponse {
  const color = scheme === "dark" ? "#e2e8f0" : "#334155";

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "transparent",
      }}
    >
      <div
        style={{
          width: 52,
          height: 52,
          borderRadius: 9999,
          border: `3px solid ${color}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color,
          fontSize: 28,
          fontWeight: 700,
          lineHeight: 1,
        }}
      >
        {letter}
      </div>
    </div>,
    {
      width: SIZE,
      height: SIZE,
      headers: {
        "Cache-Control": "public, max-age=60",
      },
    },
  );
}

function firstFaviconLetter(companyName: string | undefined): string {
  const trimmed = companyName?.trim() ?? "";
  if (!trimmed) return "H";
  const letter = [...trimmed][0]?.toUpperCase();
  return letter || "H";
}

export function parseFaviconScheme(raw: string | null): FaviconScheme {
  return raw === "dark" ? "dark" : "light";
}
