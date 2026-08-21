import { NextRequest } from "next/server";

import { parseFaviconScheme, renderSchemeFavicon } from "@/lib/branding/tab-favicon";

export const dynamic = "force-dynamic";

/**
 * Dual-theme tab favicon.
 *   /api/branding/public/favicon?scheme=light  → original logo
 *   /api/branding/public/favicon?scheme=dark   → inverted (light) logo
 */
export async function GET(req: NextRequest) {
  const scheme = parseFaviconScheme(req.nextUrl.searchParams.get("scheme"));
  return renderSchemeFavicon(scheme);
}
