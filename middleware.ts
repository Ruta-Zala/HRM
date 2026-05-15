import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { COOKIE, decodeSession } from "@/lib/session";
import { canAccessPath } from "@/lib/rbac";
import type { UserRole } from "@/types/auth";

const PUBLIC = ["/login", "/api/auth/login", "/api/auth/me"];

export function middleware(req: NextRequest) {
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
  console.log("user", user);

  if (pathname === "/login" && user) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  if (PUBLIC.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return NextResponse.next();
  }
  if (pathname.startsWith("/api/auth")) {
    return NextResponse.next();
  }

  if (!user) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("from", pathname);
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
