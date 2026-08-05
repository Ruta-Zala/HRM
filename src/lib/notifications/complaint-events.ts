import type { ComplaintRecord } from "@/lib/complaints";
import { listHrAndSuperAdminRecipients } from "@/lib/notifications/recipients";
import { createNotifications } from "@/lib/notifications/repository";
import { NOTIFICATION_TYPES } from "@/lib/notifications/types";

function categoryLabel(value: string): string {
  const labels: Record<string, string> = {
    workplace: "Workplace",
    it: "IT",
    people: "People & culture",
    facilities: "Facilities",
    other: "Other",
  };
  return labels[value] ?? value;
}

export async function notifyComplaintSubmitted(complaint: ComplaintRecord): Promise<void> {
  const recipients = await listHrAndSuperAdminRecipients();
  await createNotifications(
    recipients.map((recipient) => ({
      recipientSheetRow: recipient.sheetRow,
      recipientEmployeeId: recipient.employeeId,
      type: NOTIFICATION_TYPES.COMPLAINT_SUBMITTED,
      title: `New complaint from ${complaint.submitterName}`,
      body: `${complaint.submitterName} submitted a ${complaint.severity} priority complaint regarding "${complaint.subject}" (${categoryLabel(complaint.category)}).`,
      href: "/complaints",
      dedupeKey: `complaint_submitted:${complaint.id}:${recipient.sheetRow}`,
    })),
  );
}

export async function notifyComplaintReviewed(complaint: ComplaintRecord): Promise<void> {
  const approved = complaint.status === "Approved";
  let body = `Your complaint "${complaint.subject}" has been ${approved ? "approved" : "rejected"}.`;
  if (complaint.reviewNote) body += ` Note: ${complaint.reviewNote}`;

  await createNotifications([
    {
      recipientSheetRow: complaint.submitterSheetRow,
      recipientEmployeeId: complaint.submitterEmployeeId,
      type: approved
        ? NOTIFICATION_TYPES.COMPLAINT_APPROVED
        : NOTIFICATION_TYPES.COMPLAINT_REJECTED,
      title: approved ? "Complaint approved" : "Complaint rejected",
      body,
      href: "/complaints",
      dedupeKey: `complaint_reviewed:${complaint.id}:${complaint.status.toLowerCase()}`,
    },
  ]);
}
