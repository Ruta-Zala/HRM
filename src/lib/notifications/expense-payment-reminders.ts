import { listExpenses } from "@/lib/expenses/sheets";
import {
  EXPENSE_STATUS,
  EXPENSE_TYPES,
  effectiveExpenseDueDate,
  type ExpenseRecord,
} from "@/lib/expenses/types";
import { addDaysToDateIso, notificationDateIso } from "@/lib/notifications/automation-date";
import { listHrAndSuperAdminRecipients } from "@/lib/notifications/recipients";
import { createNotifications } from "@/lib/notifications/repository";
import { NOTIFICATION_TYPES } from "@/lib/notifications/types";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

function formatInr(amount: number): string {
  return `Rs. ${amount.toLocaleString("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

function formatDueDateLabel(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  if (!year || !month || !day) return iso;
  const monthName = MONTHS[month - 1] ?? String(month);
  return `${day} ${monthName} ${year}`;
}

function periodLabel(expense: ExpenseRecord): string {
  return `${MONTHS[expense.month - 1] ?? expense.month} ${expense.year}`;
}

function isExpenseOverdue(expense: ExpenseRecord, todayIso: string): boolean {
  return todayIso > effectiveExpenseDueDate(expense);
}

function expenseReminderBody(expense: ExpenseRecord, todayIso: string): string {
  const dueDate = effectiveExpenseDueDate(expense);
  const overdue = todayIso > dueDate;
  if (overdue) {
    return `${expense.category} — ${expense.title} (${periodLabel(expense)}, ${formatInr(expense.amount)}) is overdue. Due date was ${formatDueDateLabel(dueDate)}. Mark it as paid in Expenses.`;
  }
  return `${expense.category} — ${expense.title} (${periodLabel(expense)}, ${formatInr(expense.amount)}) payment is pending. Due on ${formatDueDateLabel(dueDate)}. Mark it as paid in Expenses.`;
}

/**
 * Notify HR + Super Admin once per day for each unpaid default expense.
 * - Before / on due date → "pending"
 * - After due date → "overdue"
 * Continues daily until the expense is Paid or Rejected.
 */
export async function processExpensePaymentReminders(): Promise<{
  pending: number;
  notified: number;
}> {
  const todayIso = notificationDateIso();
  const [recipients, expenses] = await Promise.all([
    listHrAndSuperAdminRecipients(),
    listExpenses({ type: EXPENSE_TYPES.DEFAULT }),
  ]);

  const pendingExpenses = expenses.filter((expense) => expense.status === EXPENSE_STATUS.PENDING);

  if (!recipients.length || !pendingExpenses.length) {
    return { pending: pendingExpenses.length, notified: 0 };
  }

  const expiresAt = addDaysToDateIso(todayIso, 1);
  const inputs = pendingExpenses.flatMap((expense) => {
    const overdue = isExpenseOverdue(expense, todayIso);
    return recipients.map((recipient) => ({
      recipientSheetRow: recipient.sheetRow,
      recipientEmployeeId: recipient.employeeId,
      type: overdue
        ? NOTIFICATION_TYPES.EXPENSE_PAYMENT_OVERDUE
        : NOTIFICATION_TYPES.EXPENSE_PAYMENT_DUE,
      title: overdue ? "Expense payment overdue" : "Expense payment pending",
      body: expenseReminderBody(expense, todayIso),
      href: "/employee/expenses",
      dedupeKey: `expense_payment_due:${expense.id}:${todayIso}:${recipient.sheetRow}`,
      expiresAt,
    }));
  });

  const notified = await createNotifications(inputs);
  return { pending: pendingExpenses.length, notified };
}

let processedDateIso = "";
let reminderRun: Promise<{ pending: number; notified: number }> | null = null;

/**
 * Run at most once per app day in this server process. Per-expense daily
 * dedupe keys keep this safe across multiple server instances.
 */
export async function processExpensePaymentRemindersOncePerDay(): Promise<{
  pending: number;
  notified: number;
}> {
  const todayIso = notificationDateIso();
  if (processedDateIso === todayIso) {
    return { pending: 0, notified: 0 };
  }

  if (reminderRun) return reminderRun;

  reminderRun = processExpensePaymentReminders()
    .then((result) => {
      processedDateIso = todayIso;
      return result;
    })
    .finally(() => {
      reminderRun = null;
    });

  return reminderRun;
}
