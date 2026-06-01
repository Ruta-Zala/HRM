import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { COOKIE, decodeSession } from "@/lib/session";
import { canAccessPath } from "@/lib/rbac";
import type { UserRole } from "@/types/auth";

const PUBLIC_PATHS = [
  "/login",
  "/account-inactive",
  "/api/auth/login",
  "/api/auth/logout",
  "/api/auth/me",
  "/api/auth/status",
  "/api/integrations/google-drive/callback",
];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

async function fetchAccountStatus(req: NextRequest): Promise<{
  authenticated: boolean;
  active: boolean;
}> {
  const url = new URL("/api/auth/status", req.url);
  const res = await fetch(url, {
    headers: { cookie: req.headers.get("cookie") ?? "" },
  });
  if (!res.ok) {
    return { authenticated: false, active: false };
  }
  return (await res.json()) as { authenticated: boolean; active: boolean };
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

  if (pathname === "/account-inactive") {
    if (!user) {
      return NextResponse.redirect(new URL("/login", req.url));
    }
    const status = await fetchAccountStatus(req);
    if (status.active) {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }
    return NextResponse.next();
  }

  if (pathname === "/login") {
    if (user) {
      const status = await fetchAccountStatus(req);
      if (!status.active) {
        return NextResponse.redirect(new URL("/account-inactive", req.url));
      }
      if (status.active) {
        return NextResponse.redirect(new URL("/dashboard", req.url));
      }
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

  const status = await fetchAccountStatus(req);
  if (!status.active) {
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
