import { renderSchemeFavicon } from "@/lib/branding/tab-favicon";

export const size = { width: 64, height: 64 };
export const contentType = "image/png";

/** Default Next icon (light chrome). Dark chrome uses metadata media query. */
export default async function Icon() {
  return renderSchemeFavicon("light");
}
