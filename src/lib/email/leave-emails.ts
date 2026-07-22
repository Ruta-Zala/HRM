import { sendEmail } from "@/lib/email/send";
import type { EmailDeliveryResult } from "@/lib/email/types";

function formatLeaveTypeLabel(leaveType: string): string {
  const labels: Record<string, string> = {
    paid: "Paid",
    casual: "Casual",
    sick: "Sick",
    birthday: "Birthday",
    unpaid: "Unpaid",
  };
  return labels[leaveType] ?? leaveType;
}

export async function sendLeaveReviewedEmail(params: {
  to: string;
  employeeName: string;
  leaveType: string;
  dateRange: string;
  status: "Accepted" | "Rejected";
  rejectReason?: string;
}): Promise<EmailDeliveryResult> {
  const isApproved = params.status === "Accepted";
  const leaveLabel = formatLeaveTypeLabel(params.leaveType);
  const subject = isApproved ? "Your leave is approved" : "Your leave is rejected";

  let body = isApproved
    ? `Hi ${params.employeeName},\n\nYour ${leaveLabel} leave request for ${params.dateRange} has been approved.`
    : `Hi ${params.employeeName},\n\nYour ${leaveLabel} leave request for ${params.dateRange} has been rejected.`;

  if (!isApproved && params.rejectReason?.trim()) {
    body += `\n\nReason: ${params.rejectReason.trim()}`;
  }

  body += "\n\n— From Exhibyte HRM";

  return sendEmail({
    to: params.to,
    subject,
    text: body,
  });
}
