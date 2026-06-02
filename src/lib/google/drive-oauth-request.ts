import type { NextRequest } from "next/server";

/** Public site origin (HTTPS on Vercel) for OAuth redirect_uri. */
export function getRequestAppOrigin(req: Pick<NextRequest, "headers" | "nextUrl">): string {
  const host = req.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const proto = req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() ?? "https";
  if (host) return `${proto}://${host}`;
  return req.nextUrl.origin;
}
