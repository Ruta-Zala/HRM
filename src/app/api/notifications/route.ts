import { NextResponse } from "next/server";

import { withActiveSession } from "@/lib/auth/api-guard";
import { canManageEmployees } from "@/lib/auth/roles";
import { addDaysToDateIso, notificationDateIso } from "@/lib/notifications/automation-date";
import { ensureEmployeeBirthdayNotifications } from "@/lib/notifications/birthday-reminders";
import { ensureIncrementReminders } from "@/lib/notifications/increment-reminders";
import { processLeaveUpcomingRemindersOncePerDay } from "@/lib/notifications/leave-reminders";
import {
  countUnreadNotifications,
  listNotificationsForRecipient,
  markNotificationRead,
} from "@/lib/notifications/sheets";
import { NOTIFICATION_TYPES, type NotificationDto } from "@/lib/notifications/types";

function isBirthdayToday(notification: NotificationDto): boolean {
  return (
    notification.type === NOTIFICATION_TYPES.EMPLOYEE_BIRTHDAY &&
    notification.expiresAt === addDaysToDateIso(notificationDateIso(), 1)
  );
}

function birthdayNotificationForToday(notification: NotificationDto): NotificationDto {
  if (!isBirthdayToday(notification) || notification.body.startsWith("Today is ")) {
    return notification;
  }

  const employeeName = notification.title.replace(/'s birthday this month$/, "");
  const eventDate = addDaysToDateIso(notification.expiresAt, -1);
  const birthdayLabel = new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(new Date(`${eventDate}T00:00:00Z`));

  return {
    ...notification,
    title: `${employeeName}'s birthday today`,
    body: `Today is ${employeeName}'s birthday (${birthdayLabel}). Wish them a happy birthday!`,
  };
}

function visibleNotifications(notifications: NotificationDto[]): NotificationDto[] {
  return notifications
    .filter(
      (notification) =>
        notification.type !== NOTIFICATION_TYPES.EMPLOYEE_BIRTHDAY || isBirthdayToday(notification),
    )
    .map(birthdayNotificationForToday);
}

export const GET = withActiveSession(async (_req, user) => {
  try {
    const recipientSheetRow = user.sheetRow;
    if (!recipientSheetRow) {
      return NextResponse.json(
        { success: false, message: "Employee record not found" },
        { status: 404 },
      );
    }

    if (canManageEmployees(user.role)) {
      try {
        await Promise.all([
          processLeaveUpcomingRemindersOncePerDay(),
          ensureEmployeeBirthdayNotifications(),
          ensureIncrementReminders(),
        ]);
      } catch (reminderError) {
        console.error("On-demand notification automation error:", reminderError);
      }
    }

    const allNotifications = await listNotificationsForRecipient(recipientSheetRow);
    const birthdayReminders = allNotifications.filter(
      (notification) => notification.type === NOTIFICATION_TYPES.EMPLOYEE_BIRTHDAY,
    );
    const notifications = visibleNotifications(allNotifications);
    const unreadCount = notifications.filter((n) => !n.read).length;

    return NextResponse.json({
      success: true,
      notifications,
      birthdayReminders,
      unreadCount,
    });
  } catch (error) {
    console.error("GET Notifications Error:", error);

    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Failed to fetch notifications",
      },
      { status: 500 },
    );
  }
});

export const PATCH = withActiveSession(async (req, user) => {
  try {
    const recipientSheetRow = user.sheetRow;
    if (!recipientSheetRow) {
      return NextResponse.json(
        { success: false, message: "Employee record not found" },
        { status: 404 },
      );
    }

    const body = await req.json();
    const notificationId = String(body.id ?? "").trim();
    const markAll = body.markAll === true;

    if (markAll) {
      const notifications = visibleNotifications(
        await listNotificationsForRecipient(recipientSheetRow),
      );
      let updated = 0;
      for (const notification of notifications) {
        if (notification.read) continue;
        const ok = await markNotificationRead({
          notificationId: notification.id,
          recipientSheetRow,
        });
        if (ok) updated += 1;
      }

      const unreadCount = await countUnreadNotifications(recipientSheetRow);
      return NextResponse.json({
        success: true,
        updated,
        unreadCount,
      });
    }

    if (!notificationId) {
      return NextResponse.json(
        { success: false, message: "Notification id is required" },
        { status: 400 },
      );
    }

    const updated = await markNotificationRead({
      notificationId,
      recipientSheetRow,
    });

    if (!updated) {
      return NextResponse.json(
        { success: false, message: "Notification not found" },
        { status: 404 },
      );
    }

    const unreadCount = await countUnreadNotifications(recipientSheetRow);

    return NextResponse.json({
      success: true,
      unreadCount,
    });
  } catch (error) {
    console.error("PATCH Notifications Error:", error);

    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Failed to update notification",
      },
      { status: 500 },
    );
  }
});
