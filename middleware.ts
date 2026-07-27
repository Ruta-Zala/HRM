import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { COOKIE, decodeSession } from "@/lib/session";
import { canAccessPath } from "@/lib/rbac";
import {
  ABSENCE_GATE_COOKIE,
  isAbsenceGateCookieActive,
} from "@/lib/attendance/absence-gate-cookie";
import {
  PUNCH_GATE_ROUTE,
  roleRequiresAbsenceExplanationGate,
} from "@/lib/attendance/absence-gate";
import type { UserRole } from "@/types/auth";

const PUBLIC_PATHS = [
  "/login",
  "/account-inactive",
  "/api/auth/login",
  "/api/auth/logout",
  "/api/auth/me",
  "/api/auth/status",
  "/api/auth/absence-gate",
  "/api/integrations/google-drive/callback",
  "/api/cron/leave-reminders",
];

const GATE_ALLOWED_PAGE_PATHS = [PUNCH_GATE_ROUTE];

const GATE_ALLOWED_API_PATHS = [
  "/api/attendance",
  "/api/attendance/absence-explanation",
  "/api/attendance/corrections",
  "/api/auth/logout",
  "/api/auth/me",
  "/api/auth/status",
  "/api/auth/absence-gate",
];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

async function fetchAccountActive(req: NextRequest): Promise<boolean> {
  const url = new URL("/api/auth/status", req.url);
  const res = await fetch(url, {
    headers: { cookie: req.headers.get("cookie") ?? "" },
    cache: "no-store",
  });
  if (!res.ok) return false;
  try {
    const data = (await res.json()) as { active?: boolean };
    return Boolean(data.active);
  } catch {
    return false;
  }
}

function isGateRequired(req: NextRequest, gateRole: boolean): boolean {
  if (!gateRole) return false;
  return isAbsenceGateCookieActive(req.cookies.get(ABSENCE_GATE_COOKIE)?.value);
}

function isGateAllowedPath(pathname: string): boolean {
  if (GATE_ALLOWED_PAGE_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return true;
  }

  if (pathname === "/api/attendance") {
    return true;
  }

  return GATE_ALLOWED_API_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

function redirectToPunch(req: NextRequest) {
  const url = req.nextUrl.clone();
  url.pathname = PUNCH_GATE_ROUTE;
  url.search = "";
  return NextResponse.redirect(url);
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.match(/\.(ico|png|jpg|jpeg|svg|webp)$/)
  ) {
    return NextResponse.next();
  }

  const raw = req.cookies.get(COOKIE)?.value;
  const user = raw ? decodeSession(raw) : null;
  const gateRole = user ? roleRequiresAbsenceExplanationGate(user.role as UserRole) : false;
  const gateRequired = isGateRequired(req, gateRole);

  if (pathname === "/account-inactive") {
    if (!user) {
      return NextResponse.redirect(new URL("/login", req.url));
    }
    const active = await fetchAccountActive(req);
    if (active) {
      if (gateRequired) {
        return redirectToPunch(req);
      }
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }
    return NextResponse.next();
  }

  if (pathname === "/absence-explanation") {
    return redirectToPunch(req);
  }

  if (pathname === "/login") {
    if (user) {
      const active = await fetchAccountActive(req);
      if (!active) {
        return NextResponse.redirect(new URL("/account-inactive", req.url));
      }
      if (gateRequired) {
        return redirectToPunch(req);
      }
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }
    return NextResponse.next();
  }

  if (isPublicPath(pathname) || pathname.startsWith("/api/auth")) {
    return NextResponse.next();
  }

  if (!user) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("from", pathname);
    return NextResponse.redirect(url);
  }

  const active = await fetchAccountActive(req);
  if (!active) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        {
          success: false,
          message: "You cannot access this route. Your account is deactivated.",
          code: "ACCOUNT_INACTIVE",
        },
        { status: 403 },
      );
    }
    const url = req.nextUrl.clone();
    url.pathname = "/account-inactive";
    return NextResponse.redirect(url);
  }

  if (gateRequired && !isGateAllowedPath(pathname)) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        {
          success: false,
          message: "Submit your absence explanation on the punch page before accessing the site.",
          code: "ABSENCE_EXPLANATION_REQUIRED",
        },
        { status: 403 },
      );
    }
    return redirectToPunch(req);
  }

  if (!canAccessPath(user.role as UserRole, pathname)) {
    const url = req.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
