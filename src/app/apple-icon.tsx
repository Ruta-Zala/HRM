import { renderSchemeFavicon } from "@/lib/branding/tab-favicon";

export const size = { width: 64, height: 64 };
export const contentType = "image/png";

export default async function AppleIcon() {
  return renderSchemeFavicon("light");
}
