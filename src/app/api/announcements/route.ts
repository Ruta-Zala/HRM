import { NextResponse } from "next/server";

import { ROLES } from "@/app/consts/common";
import {
  createAnnouncement,
  listAnnouncements,
  type AnnouncementCategory,
} from "@/lib/announcements";
import { withActiveSession } from "@/lib/auth/api-guard";
import { canManageEmployees } from "@/lib/auth/roles";
import { listActiveEmployees } from "@/lib/notifications/recipients";
import { createNotifications } from "@/lib/notifications/sheets";
import { NOTIFICATION_TYPES } from "@/lib/notifications/types";

function parseCategory(value: unknown): AnnouncementCategory | null {
  const category = String(value ?? "")
    .trim()
    .toLowerCase();
  if (category === "general" || category === "office_leave" || category === "important") {
    return category;
  }
  return null;
}

export const GET = withActiveSession(async (_req, user) => {
  if (!canManageEmployees(user.role)) {
    return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
  }

  try {
    const announcements = await listAnnouncements();
    return NextResponse.json({ success: true, announcements });
  } catch (error) {
    console.error("GET Announcements Error:", error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Failed to load announcements",
      },
      { status: 500 },
    );
  }
});

export const POST = withActiveSession(async (req, user) => {
  if (!canManageEmployees(user.role)) {
    return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
  }

  try {
    const body = (await req.json()) as Record<string, unknown>;
    const title = String(body.title ?? "").trim();
    const message = String(body.message ?? "").trim();
    const category = parseCategory(body.category);

    if (!title || title.length > 120) {
      return NextResponse.json(
        { success: false, message: "Title is required and must be at most 120 characters" },
        { status: 400 },
      );
    }
    if (!message || message.length > 2000) {
      return NextResponse.json(
        { success: false, message: "Message is required and must be at most 2000 characters" },
        { status: 400 },
      );
    }
    if (!category) {
      return NextResponse.json(
        { success: false, message: "Valid announcement category is required" },
        { status: 400 },
      );
    }

    const employees = (await listActiveEmployees()).filter(
      (employee) => employee.role === ROLES.EMPLOYEE,
    );
    const announcement = await createAnnouncement({
      title,
      message,
      category,
      authorSheetRow: user.sheetRow ?? 0,
      authorName: user.name,
      recipientCount: employees.length,
    });

    const notified = await createNotifications(
      employees.map((employee) => ({
        recipientSheetRow: employee.sheetRow,
        recipientEmployeeId: employee.employeeId,
        type: NOTIFICATION_TYPES.ANNOUNCEMENT,
        title,
        body: message,
        href: "/notifications",
        dedupeKey: `announcement:${announcement.id}:${employee.sheetRow}`,
      })),
    );

    return NextResponse.json(
      {
        success: true,
        announcement: { ...announcement, recipientCount: notified },
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("POST Announcement Error:", error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Failed to publish announcement",
      },
      { status: 500 },
    );
  }
});
