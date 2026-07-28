import type { NextRequest } from "next/server";

/** IPv4 dotted-quad only (office routers typically publish a public IPv4). */
const IPV4_RE = /^(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)$/;

export function normalizeIp(value: string): string {
  return value.trim().replace(/^::ffff:/i, "");
}

export function isValidIpv4(value: string): boolean {
  return IPV4_RE.test(normalizeIp(value));
}

function firstHop(headerValue: string | null | undefined): string {
  if (!headerValue) return "";
  return normalizeIp(headerValue.split(",")[0]?.trim() ?? "");
}

export function isLoopbackIp(ip: string): boolean {
  const value = normalizeIp(ip);
  return value === "127.0.0.1" || value === "::1" || value === "0:0:0:0:0:0:0:1";
}

/**
 * IP from proxy / platform headers only (Vercel, etc.).
 * On localhost this is usually empty or loopback — not your office public IP.
 */
export function getRequestHeaderIp(req: Request | NextRequest): string {
  const headerCandidates = [
    firstHop(req.headers.get("x-forwarded-for")),
    firstHop(req.headers.get("x-vercel-forwarded-for")),
    normalizeIp(req.headers.get("x-real-ip") ?? ""),
    normalizeIp(req.headers.get("cf-connecting-ip") ?? ""),
    normalizeIp(req.headers.get("true-client-ip") ?? ""),
  ].filter(Boolean);

  for (const candidate of headerCandidates) {
    if (candidate && !isLoopbackIp(candidate)) return candidate;
  }

  const maybeIp = (req as NextRequest & { ip?: string }).ip;
  const nextIp = typeof maybeIp === "string" ? normalizeIp(maybeIp) : "";
  if (nextIp && !isLoopbackIp(nextIp)) return nextIp;

  return nextIp || headerCandidates[0] || "";
}

/**
 * Resolve the IP used for allowlist checks.
 *
 * 1. Trust proxy headers when they carry a real public IP (Vercel / production).
 * 2. Optional `NETWORK_ACCESS_DEV_CLIENT_IP` forces a fake IP for local block tests only.
 * 3. Browser-reported public IP (login / network-blocked) when the server only sees localhost.
 * 4. IP stored on the gate cookie from a prior successful check (keeps local API calls working).
 *
 * The Office Wi‑Fi allowlist in the UI is the only list of permitted IPs — never sync env to it.
 */
export function resolveClientIp(
  req: Request | NextRequest,
  reportedPublicIp?: string | null,
  gateCookieIp?: string | null,
): string {
  const headerIp = getRequestHeaderIp(req);
  if (headerIp && !isLoopbackIp(headerIp)) {
    return headerIp;
  }

  // Optional local-only override to simulate "I'm on a different network".
  const forcedDevIp = normalizeIp(process.env.NETWORK_ACCESS_DEV_CLIENT_IP ?? "");
  if (forcedDevIp && isValidIpv4(forcedDevIp)) {
    return forcedDevIp;
  }

  const reported = normalizeIp(reportedPublicIp ?? "");
  if (isValidIpv4(reported) && !isLoopbackIp(reported)) {
    return reported;
  }

  const fromCookie = normalizeIp(gateCookieIp ?? "");
  if (isValidIpv4(fromCookie) && !isLoopbackIp(fromCookie)) {
    return fromCookie;
  }

  return headerIp;
}

/** @deprecated Prefer resolveClientIp — kept for call sites that only have the request. */
export function getClientIp(req: Request | NextRequest): string {
  return resolveClientIp(req);
}

export function ipsMatch(clientIp: string, allowedIp: string): boolean {
  const a = normalizeIp(clientIp);
  const b = normalizeIp(allowedIp);
  if (!a || !b) return false;
  return a === b;
}

/** Browser-side lookup of the machine's public IPv4 (works on localhost). */
export async function fetchPublicIpv4FromBrowser(): Promise<string> {
  const res = await fetch("https://api.ipify.org?format=json", { cache: "no-store" });
  if (!res.ok) {
    throw new Error("Could not look up your public IP");
  }
  const data = (await res.json()) as { ip?: string };
  const ip = normalizeIp(data.ip ?? "");
  if (!isValidIpv4(ip)) {
    throw new Error("Could not look up a valid public IPv4");
  }
  return ip;
}
