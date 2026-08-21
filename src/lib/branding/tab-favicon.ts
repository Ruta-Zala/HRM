import sharp from "sharp";

import { getBrandingAssetBytes, getCompanyBranding } from "@/lib/branding";

export type FaviconScheme = "light" | "dark";

const SIZE = 64;
/** Logo drawn smaller than the canvas so the tab mark has breathing room. */
const LOGO_SIZE = 60;

/**
 * Tab favicon: company logo only (same rule as /login).
 * No letter / "H" fallback — empty transparent mark when logo is unset.
 * Light chrome → original logo; dark chrome → inverted logo.
 */
export async function renderSchemeFavicon(scheme: FaviconScheme): Promise<Response> {
  const branding = await getCompanyBranding().catch(() => null);
  const asset = branding?.hasLogo ? await getBrandingAssetBytes("logo").catch(() => null) : null;

  if (asset?.buffer?.length) {
    try {
      return await renderLogoFavicon(scheme, asset.buffer);
    } catch (error) {
      console.error("Favicon logo render failed:", error);
      // Serve original bytes if resize/negate fails (better than empty tab on Vercel).
      return new Response(new Uint8Array(asset.buffer), {
        headers: {
          "Content-Type": asset.mimeType || "image/png",
          "Cache-Control": "public, max-age=60",
        },
      });
    }
  }

  return renderEmptyFavicon();
}

async function renderLogoFavicon(scheme: FaviconScheme, buffer: Buffer): Promise<Response> {
  let logo = sharp(buffer).resize(LOGO_SIZE, LOGO_SIZE, {
    fit: "contain",
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  });

  if (scheme === "dark") {
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

/** Fully transparent PNG so tabs stay blank when no company logo is set. */
async function renderEmptyFavicon(): Promise<Response> {
  const png = await sharp({
    create: {
      width: SIZE,
      height: SIZE,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .png()
    .toBuffer();

  return new Response(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=60",
    },
  });
}

export function parseFaviconScheme(raw: string | null): FaviconScheme {
  return raw === "dark" ? "dark" : "light";
}
