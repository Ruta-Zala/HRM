import { addDaysToDateIso, notificationDateIso } from "@/lib/notifications/automation-date";
import { createNotifications } from "@/lib/notifications/sheets";
import { NOTIFICATION_TYPES } from "@/lib/notifications/types";

const PUNCH_HREF = "/employee/punch";

function formatDateLabel(dateIso: string): string {
  const [year, month, day] = dateIso.split("-").map(Number);
  if (!year || !month || !day) return dateIso;
  const date = new Date(Date.UTC(year, month - 1, day));
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export async function notifyAutoPunchOut(params: {
  employeeSheetRow: number;
  employeeId: string;
  dateIso: string;
}): Promise<number> {
  const dateLabel = formatDateLabel(params.dateIso);
  // Match other reminders: keep for the notification day, auto-delete the next calendar day (~24h).
  const expiresAt = addDaysToDateIso(notificationDateIso(), 1);

  return createNotifications([
    {
      recipientSheetRow: params.employeeSheetRow,
      recipientEmployeeId: params.employeeId,
      type: NOTIFICATION_TYPES.AUTO_PUNCH_OUT,
      title: "Forgot to punch out",
      body: `You forgot to punch out on ${dateLabel}, so your session was automatically punched out at 12:00 AM. Please contact HR or a Super Admin to update your punch-out time.`,
      href: PUNCH_HREF,
      dedupeKey: `auto_punch_out:${params.employeeId || params.employeeSheetRow}:${params.dateIso}`,
      expiresAt,
    },
  ]);
}
