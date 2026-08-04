export const EXPENSE_TYPES = {
  DEFAULT: "default",
  RECURRING: "recurring",
} as const;

export type ExpenseType = (typeof EXPENSE_TYPES)[keyof typeof EXPENSE_TYPES];

export const EXPENSE_STATUS = {
  PENDING: "Pending",
  PAID: "Paid",
  REJECTED: "Rejected",
} as const;

export type ExpenseStatus = (typeof EXPENSE_STATUS)[keyof typeof EXPENSE_STATUS];

export const EXPENSE_PAYMENT_MODES = {
  ONLINE: "Online",
  CASH: "Cash",
} as const;

export type ExpensePaymentMode = (typeof EXPENSE_PAYMENT_MODES)[keyof typeof EXPENSE_PAYMENT_MODES];

export const EXPENSE_PAYMENT_MODE_OPTIONS = [
  EXPENSE_PAYMENT_MODES.ONLINE,
  EXPENSE_PAYMENT_MODES.CASH,
] as const;

/** Fixed / common office costs stored on the DefaultExpenses sheet. */
export const DEFAULT_EXPENSE_CATEGORIES = ["Office Rent", "Electricity Bill", "Other"] as const;

/** Common categories for other / recurring office spend. */
export const RECURRING_EXPENSE_CATEGORIES = [
  "Office Supplies",
  "Maintenance",
  "Internet / Phone",
  "Software / Subscriptions",
  "Miscellaneous",
  "Other",
] as const;

/** Default due day for Electricity Bill (editable on the form). */
export const ELECTRICITY_DEFAULT_DUE_DAY = 5;

export type DefaultExpenseCategory = (typeof DEFAULT_EXPENSE_CATEGORIES)[number];
export type RecurringExpenseCategory = (typeof RECURRING_EXPENSE_CATEGORIES)[number];

export type ExpenseRecord = {
  id: string;
  type: ExpenseType;
  category: string;
  title: string;
  amount: number;
  /** 1–12 */
  month: number;
  year: number;
  /** YYYY-MM-DD — required for default expenses */
  dueDate: string;
  paymentMode: ExpensePaymentMode;
  notes: string;
  status: ExpenseStatus;
  rejectionReason: string;
  paidBy: string;
  paidAt: string;
  rejectedBy: string;
  rejectedAt: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

export type CreateExpenseInput = {
  type: ExpenseType;
  category: string;
  title: string;
  amount: number;
  month: number;
  year: number;
  dueDate?: string;
  paymentMode: string;
  notes?: string;
  createdBy: string;
};

export type UpdateExpenseInput = {
  id: string;
  type: ExpenseType;
  category: string;
  title: string;
  amount: number;
  month: number;
  year: number;
  dueDate?: string;
  paymentMode: string;
  notes?: string;
};

export function isExpenseType(value: string): value is ExpenseType {
  return value === EXPENSE_TYPES.DEFAULT || value === EXPENSE_TYPES.RECURRING;
}

export function isExpenseStatus(value: string): value is ExpenseStatus {
  return (
    value === EXPENSE_STATUS.PENDING ||
    value === EXPENSE_STATUS.PAID ||
    value === EXPENSE_STATUS.REJECTED
  );
}

export function isExpensePaymentMode(value: string): value is ExpensePaymentMode {
  return value === EXPENSE_PAYMENT_MODES.ONLINE || value === EXPENSE_PAYMENT_MODES.CASH;
}

export function validateExpensePaymentMode(value: string): ExpensePaymentMode {
  const trimmed = value.trim();
  if (!isExpensePaymentMode(trimmed)) {
    throw new Error("Payment mode must be Online or Cash");
  }
  return trimmed;
}

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

/** Suggested due date for Electricity Bill: 5th of the expense month. */
export function electricityDefaultDueDate(year: number, month: number): string {
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    return "";
  }
  return `${year}-${pad2(month)}-${pad2(ELECTRICITY_DEFAULT_DUE_DAY)}`;
}

export function suggestedDueDateForCategory(category: string, year: number, month: number): string {
  if (category.trim() === "Electricity Bill") {
    return electricityDefaultDueDate(year, month);
  }
  return "";
}

/**
 * Resolve due date used for pending/overdue checks.
 * Falls back for older rows that predate the dueDate column.
 */
export function effectiveExpenseDueDate(expense: {
  category: string;
  month: number;
  year: number;
  dueDate?: string;
}): string {
  const stored = String(expense.dueDate ?? "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(stored)) return stored;

  if (expense.category === "Electricity Bill") {
    return electricityDefaultDueDate(expense.year, expense.month);
  }

  // Office Rent / unknown without due date → last day of the expense month
  const lastDay = new Date(Date.UTC(expense.year, expense.month, 0)).getUTCDate();
  return `${expense.year}-${pad2(expense.month)}-${pad2(lastDay)}`;
}

export function validateExpenseDueDate(type: ExpenseType, dueDate: string | undefined): string {
  if (type !== EXPENSE_TYPES.DEFAULT) return "";

  const trimmed = String(dueDate ?? "").trim();
  if (!trimmed) throw new Error("Due date is required for default expenses");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    throw new Error("Valid due date is required (YYYY-MM-DD)");
  }
  return trimmed;
}

export function sheetNameForType(type: ExpenseType): string {
  return type === EXPENSE_TYPES.DEFAULT ? "DefaultExpenses" : "RecurringExpenses";
}

export function validateExpenseCategory(type: ExpenseType, category: string): string {
  const trimmed = category.trim();
  if (!trimmed) throw new Error("Category is required");
  if (trimmed === "Other") throw new Error("Enter a custom category name");
  if (trimmed.length > 80) throw new Error("Category must be 80 characters or fewer");

  if (type === EXPENSE_TYPES.DEFAULT) {
    // Presets or free-form custom names (from the Other option) are allowed.
    return trimmed;
  }

  return trimmed;
}
