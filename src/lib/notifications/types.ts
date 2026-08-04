export const NOTIFICATIONS_SHEET_NAME = "Notifications";

export const NOTIFICATION_TYPES = {
  LEAVE_SUBMITTED: "leave_submitted",
  LEAVE_SUBMITTED_EMPLOYEE: "leave_submitted_employee",
  LEAVE_APPROVED: "leave_approved",
  LEAVE_REJECTED: "leave_rejected",
  LEAVE_UPCOMING: "leave_upcoming",
  EMPLOYEE_BIRTHDAY: "employee_birthday",
  EMPLOYEE_INCREMENT_UPCOMING: "employee_increment_upcoming",
  ANNOUNCEMENT: "announcement",
  COMPLAINT_SUBMITTED: "complaint_submitted",
  COMPLAINT_APPROVED: "complaint_approved",
  COMPLAINT_REJECTED: "complaint_rejected",
  CORRECTION_SUBMITTED: "correction_submitted",
  CORRECTION_SUBMITTED_EMPLOYEE: "correction_submitted_employee",
  CORRECTION_APPROVED: "correction_approved",
  CORRECTION_REJECTED: "correction_rejected",
  EXPENSE_PAYMENT_DUE: "expense_payment_due",
  EXPENSE_PAYMENT_OVERDUE: "expense_payment_overdue",
  AUTO_PUNCH_OUT: "auto_punch_out",
} as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[keyof typeof NOTIFICATION_TYPES];

export type NotificationRecord = {
  id: string;
  recipientSheetRow: number;
  recipientEmployeeId: string;
  type: NotificationType;
  title: string;
  body: string;
  href: string;
  read: boolean;
  createdAt: string;
  dedupeKey: string;
  expiresAt: string;
};

export type NotificationDto = NotificationRecord & {
  sheetRow: number;
};
