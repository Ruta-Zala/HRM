import { NextResponse } from "next/server";

import { syncAttendanceToSheets } from "@/lib/attendance/sync-attendance-to-sheets";

export const dynamic = "force-dynamic";

function isLocalhostRequest(req: Request): boolean {
  const host = req.headers.get("host") ?? "";
  return host.includes("localhost") || host.includes("127.0.0.1");
}

export async function POST(req: Request) {
  try {
    const url = new URL(req.url);
    const tokenFromHeader = req.headers.get("x-sync-token");
    const tokenFromQuery = url.searchParams.get("token");
    const token = tokenFromHeader ?? tokenFromQuery ?? undefined;

    const expected = process.env.ATTENDANCE_SYNC_TOKEN?.trim();
    const userAgent = req.headers.get("user-agent") ?? "";
    // Vercel Cron calls typically identify themselves in User-Agent.
    const isVercelCron = /vercel.*cron/i.test(userAgent);
    if (expected && token !== expected && !isLocalhostRequest(req)) {
      // Allow Vercel Cron to run without having to pass tokens.
      if (isVercelCron) {
        // continue
      } else {
        return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
      }
    }

    const body = (await req.json().catch(() => ({}))) as { fromIso?: string; toIso?: string };

    const result = await syncAttendanceToSheets({
      fromIso: body.fromIso ?? url.searchParams.get("from") ?? undefined,
      toIso: body.toIso ?? url.searchParams.get("to") ?? undefined,
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("[sync-attendance-to-sheets]", error);
    return NextResponse.json(
      { success: false, message: "Sync failed. Check server logs." },
      { status: 500 },
    );
  }
}

// Vercel Cron typically performs a GET request.
export async function GET(req: Request) {
  return POST(req);
}
