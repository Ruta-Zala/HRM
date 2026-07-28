import type { NextResponse } from "next/server";

import { getClientIp, normalizeIp } from "@/lib/network-access/ip";

export const NETWORK_GATE_COOKIE = "exhibyte_network_gate";

/** How long a gate decision is trusted in middleware (no Sheets round-trip). */
export const NETWORK_GATE_TTL_MS = 2 * 60 * 1000;

export type NetworkGateCookiePayload = {
  allowed: boolean;
  ip: string;
  exp: number;
};

function encodeBase64Url(json: string): string {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(json, "utf8").toString("base64url");
  }
  const b64 = btoa(unescape(encodeURIComponent(json)));
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function decodeBase64Url(raw: string): string {
  const pad = raw.length % 4 === 0 ? "" : "=".repeat(4 - (raw.length % 4));
  const b64 = raw.replace(/-/g, "+").replace(/_/g, "/") + pad;
  if (typeof Buffer !== "undefined") {
    return Buffer.from(b64, "base64").toString("utf8");
  }
  return decodeURIComponent(escape(atob(b64)));
}

export function encodeNetworkGateCookie(payload: NetworkGateCookiePayload): string {
  return encodeBase64Url(JSON.stringify(payload));
}

export function decodeNetworkGateCookie(raw: string | undefined): NetworkGateCookiePayload | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(decodeBase64Url(raw)) as NetworkGateCookiePayload;
    if (typeof parsed.allowed !== "boolean" || typeof parsed.exp !== "number") return null;
    return {
      allowed: parsed.allowed,
      ip: normalizeIp(String(parsed.ip ?? "")),
      exp: parsed.exp,
    };
  } catch {
    return null;
  }
}

export function buildNetworkGateCookiePayload(
  allowed: boolean,
  clientIp: string,
  now = Date.now(),
): NetworkGateCookiePayload {
  return {
    allowed,
    ip: normalizeIp(clientIp),
    exp: now + NETWORK_GATE_TTL_MS,
  };
}

export function setNetworkGateCookie(res: NextResponse, allowed: boolean, clientIp: string): void {
  const payload = buildNetworkGateCookiePayload(allowed, clientIp);
  res.cookies.set(NETWORK_GATE_COOKIE, encodeNetworkGateCookie(payload), {
    path: "/",
    sameSite: "lax",
    httpOnly: true,
    maxAge: Math.ceil(NETWORK_GATE_TTL_MS / 1000),
  });
}

export function clearNetworkGateCookie(res: NextResponse): void {
  res.cookies.set(NETWORK_GATE_COOKIE, "", {
    path: "/",
    sameSite: "lax",
    httpOnly: true,
    maxAge: 0,
  });
}

/**
 * Read gate cookie for middleware.
 * - `allow` / `block`: trust cookie
 * - `revalidate`: missing, expired, or client IP changed — send user through /network-blocked to refresh
 */
export function readNetworkGateDecision(
  cookieValue: string | undefined,
  req: Request,
): "allow" | "block" | "revalidate" {
  const payload = decodeNetworkGateCookie(cookieValue);
  if (!payload) return "revalidate";
  if (payload.exp < Date.now()) return "revalidate";

  const currentIp = getClientIp(req);
  if (payload.ip && currentIp && payload.ip !== currentIp) return "revalidate";

  return payload.allowed ? "allow" : "block";
}
