import type { CorrectionRequest } from "@/lib/attendance/corrections";
import type { CorrectionField } from "@/lib/attendance/constants";
import { CORRECTION_STATUS } from "@/lib/attendance/constants";
import { findEmployeeByAttendanceSpreadsheetId } from "@/lib/notifications/employee-lookup";
import { listHrAndSuperAdminRecipients } from "@/lib/notifications/recipients";
import { createNotifications } from "@/lib/notifications/repository";
import { NOTIFICATION_TYPES, type NotificationType } from "@/lib/notifications/types";

const PUNCH_HREF = "/employee/punch";
const APPROVALS_HREF = "/leave/approvals#corrections";

function fieldLabel(field: CorrectionField | string): string {
  const labels: Record<string, string> = {
    punchIn: "Punch In",
    punchOut: "Punch Out",
    breakStart: "Break Start",
    breakEnd: "Break End",
  };
  return labels[field] ?? field;
}

export async function notifyCorrectionSubmitted(params: {
  request: CorrectionRequest;
  employeeSheetRow: number;
}): Promise<void> {
  const { request, employeeSheetRow } = params;
  const field = fieldLabel(request.field);
  const inputs = [];

  inputs.push({
    recipientSheetRow: employeeSheetRow,
    recipientEmployeeId: request.employeeId,
    type: NOTIFICATION_TYPES.CORRECTION_SUBMITTED_EMPLOYEE as NotificationType,
    title: "Correction request submitted",
    body: `Your ${field} correction request for ${request.date} (${request.requestedValue}) has been submitted and is pending review.`,
    href: PUNCH_HREF,
    dedupeKey: `correction_submitted_employee:${request.id}`,
  });

  const hrRecipients = await listHrAndSuperAdminRecipients();
  for (const recipient of hrRecipients) {
    inputs.push({
      recipientSheetRow: recipient.sheetRow,
      recipientEmployeeId: recipient.employeeId,
      type: NOTIFICATION_TYPES.CORRECTION_SUBMITTED as NotificationType,
      title: "New correction request",
      body: `${request.employeeName} requested a ${field} correction for ${request.date} to ${request.requestedValue}.`,
      href: APPROVALS_HREF,
      dedupeKey: `correction_submitted_hr:${request.id}:${recipient.sheetRow}`,
    });
  }

  await createNotifications(inputs);
}

export async function notifyCorrectionReviewed(request: CorrectionRequest): Promise<void> {
  const approved = request.status === CORRECTION_STATUS.APPROVED;
  const employee =
    (await findEmployeeByAttendanceSpreadsheetId(request.attendanceSpreadsheetId)) ?? null;

  if (!employee) {
    console.warn(
      `Correction review notification skipped: employee not found for attendance spreadsheet ${request.attendanceSpreadsheetId}`,
    );
    return;
  }

  const field = fieldLabel(request.field);
  let body = approved
    ? `Your ${field} correction request for ${request.date} has been approved.`
    : `Your ${field} correction request for ${request.date} has been rejected.`;

  if (request.remarks.trim()) {
    body += ` Remarks: ${request.remarks.trim()}`;
  }

  await createNotifications([
    {
      recipientSheetRow: employee.sheetRow,
      recipientEmployeeId: employee.employeeId || request.employeeId,
      type: (approved
        ? NOTIFICATION_TYPES.CORRECTION_APPROVED
        : NOTIFICATION_TYPES.CORRECTION_REJECTED) as NotificationType,
      title: approved ? "Correction request approved" : "Correction request rejected",
      body,
      href: PUNCH_HREF,
      dedupeKey: `correction_reviewed:${request.id}:${request.status.toLowerCase()}`,
    },
  ]);
}
