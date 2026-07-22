import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { processEmployeeBirthdayNotifications } from "@/lib/notifications/birthday-reminders";
import { processIncrementReminders } from "@/lib/notifications/increment-reminders";
import { processLeaveUpcomingReminders } from "@/lib/notifications/leave-reminders";

function isAuthorized(req: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET?.trim();
  if (!cronSecret) return false;

  const authHeader = req.headers.get("authorization")?.trim() ?? "";
  if (authHeader === `Bearer ${cronSecret}`) return true;

  const headerSecret = req.headers.get("x-cron-secret")?.trim() ?? "";
  return headerSecret === cronSecret;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  }

  try {
    const [leaveReminders, birthdayNotifications, incrementReminders] = await Promise.all([
      processLeaveUpcomingReminders(),
      processEmployeeBirthdayNotifications(),
      processIncrementReminders(),
    ]);

    return NextResponse.json({
      success: true,
      leaveReminders,
      birthdayNotifications,
      incrementReminders,
    });
  } catch (error) {
    console.error("Notification automations cron error:", error);

    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error ? error.message : "Failed to process notification automations",
      },
      { status: 500 },
    );
  }
}
