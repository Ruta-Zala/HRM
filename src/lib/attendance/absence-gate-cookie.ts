import type { NextResponse } from "next/server";

export const ABSENCE_GATE_COOKIE = "exhibyte_absence_gate";
export const PUNCH_TODAY_COOKIE = "exhibyte_punch_today";

export function isAbsenceGateCookieActive(value: string | undefined): boolean {
  return value === "1";
}

export function setAbsenceGateCookie(res: NextResponse, required: boolean): void {
  res.cookies.set(ABSENCE_GATE_COOKIE, required ? "1" : "0", {
    path: "/",
    sameSite: "lax",
    httpOnly: true,
  });
}

export function clearAbsenceGateCookie(res: NextResponse): void {
  res.cookies.set(ABSENCE_GATE_COOKIE, "0", {
    path: "/",
    sameSite: "lax",
    httpOnly: true,
    maxAge: 0,
  });
}

export function isMorningPunchGateCookieActive(value: string | undefined): boolean {
  return value === "1";
}

export function setMorningPunchGateCookie(res: NextResponse, required: boolean): void {
  res.cookies.set(PUNCH_TODAY_COOKIE, required ? "1" : "0", {
    path: "/",
    sameSite: "lax",
    httpOnly: true,
  });
}

export function clearMorningPunchGateCookie(res: NextResponse): void {
  res.cookies.set(PUNCH_TODAY_COOKIE, "0", {
    path: "/",
    sameSite: "lax",
    httpOnly: true,
    maxAge: 0,
  });
}

export function isSiteAccessGateActive(
  absenceGateCookie: string | undefined,
  morningPunchGateCookie: string | undefined,
): boolean {
  return (
    isAbsenceGateCookieActive(absenceGateCookie) ||
    isMorningPunchGateCookieActive(morningPunchGateCookie)
  );
}
