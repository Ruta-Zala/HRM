"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, Pencil, Plus, RefreshCw, X, XCircle } from "lucide-react";

import { AccessDenied } from "@/components/ui/access-denied";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { DateInput } from "@/components/ui/date-input";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MonthYearPicker } from "@/components/ui/month-year-picker";
import { PageHeader } from "@/components/ui/page-header";
import { Select } from "@/components/ui/select";
import { StatCard } from "@/components/ui/stat-card";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/auth-provider";
import { readResponseJson } from "@/lib/api/read-response-json";
import { toUserFacingActionError, toUserFacingFetchError } from "@/lib/api/user-facing-error";
import { canManageEmployees } from "@/lib/auth/roles";
import {
  ATTENDANCE_HISTORY_START_YEAR,
  buildFullMonthYearPeriodOptions,
} from "@/lib/attendance/period-options";
import {
  DEFAULT_EXPENSE_CATEGORIES,
  EXPENSE_PAYMENT_MODE_OPTIONS,
  EXPENSE_PAYMENT_MODES,
  EXPENSE_STATUS,
  EXPENSE_TYPES,
  RECURRING_EXPENSE_CATEGORIES,
  effectiveExpenseDueDate,
  suggestedDueDateForCategory,
  type ExpensePaymentMode,
  type ExpenseRecord,
  type ExpenseStatus,
  type ExpenseType,
} from "@/lib/expenses/types";
import { cn } from "@/lib/utils";
import type { Column } from "@/types/table";

type ExpenseSummary = {
  count: number;
  pendingCount: number;
  paidCount: number;
  rejectedCount: number;
  totalPaid: number;
  defaultTotal: number;
  recurringTotal: number;
};

type TypeFilter = ExpenseType | "all";

type TableRow = {
  id: string;
  type: string;
  category: string;
  title: string;
  amount: string;
  paymentMode: string;
  dueDate: string;
  period: string;
  status: ExpenseStatus;
  notes: string;
  createdBy: string;
};

const EMPTY_SUMMARY: ExpenseSummary = {
  count: 0,
  pendingCount: 0,
  paidCount: 0,
  rejectedCount: 0,
  totalPaid: 0,
  defaultTotal: 0,
  recurringTotal: 0,
};

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

function formatDueDateDisplay(iso: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return "—";
  const [year, month, day] = iso.split("-");
  return `${day}/${month}/${year}`;
}

function typeLabel(type: ExpenseType): string {
  return type === EXPENSE_TYPES.DEFAULT ? "Default" : "Recurring";
}

function statusVariant(status: ExpenseStatus): "warning" | "success" | "danger" {
  if (status === EXPENSE_STATUS.PAID) return "success";
  if (status === EXPENSE_STATUS.REJECTED) return "danger";
  return "warning";
}

export default function ExpensesPage() {
  const { user, loading: authLoading } = useAuth();
  const canManage = user ? canManageEmployees(user.role) : false;

  const now = useMemo(() => new Date(), []);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [month, setMonth] = useState<number | null>(() => now.getMonth());
  const [year, setYear] = useState(() => now.getFullYear());

  const periods = useMemo(
    () =>
      buildFullMonthYearPeriodOptions(now, ATTENDANCE_HISTORY_START_YEAR, now.getFullYear() + 1),
    [now],
  );

  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [summary, setSummary] = useState<ExpenseSummary>(EMPTY_SUMMARY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [rejectingExpense, setRejectingExpense] = useState<ExpenseRecord | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");

  const [formType, setFormType] = useState<ExpenseType>(EXPENSE_TYPES.DEFAULT);
  const [category, setCategory] = useState<string>(DEFAULT_EXPENSE_CATEGORIES[0]);
  const [customCategory, setCustomCategory] = useState("");
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [formMonth, setFormMonth] = useState(() => String(now.getMonth() + 1));
  const [formYear, setFormYear] = useState(() => String(now.getFullYear()));
  const [dueDate, setDueDate] = useState("");
  const [paymentMode, setPaymentMode] = useState<ExpensePaymentMode>(EXPENSE_PAYMENT_MODES.ONLINE);
  const [notes, setNotes] = useState("");

  const yearOptions = useMemo(() => {
    const current = now.getFullYear();
    const years: string[] = [];
    for (let y = current + 1; y >= current - 10; y -= 1) years.push(String(y));
    return years;
  }, [now]);

  const resetForm = useCallback(() => {
    setEditingId(null);
    setFormType(EXPENSE_TYPES.DEFAULT);
    setCategory(DEFAULT_EXPENSE_CATEGORIES[0]);
    setCustomCategory("");
    setTitle("");
    setAmount("");
    setFormMonth(String(now.getMonth() + 1));
    setFormYear(String(now.getFullYear()));
    setDueDate("");
    setPaymentMode(EXPENSE_PAYMENT_MODES.ONLINE);
    setNotes("");
  }, [now]);

  function applySuggestedDueDate(nextCategory: string, nextYear: string, nextMonth: string) {
    const suggested = suggestedDueDateForCategory(
      nextCategory,
      Number(nextYear),
      Number(nextMonth),
    );
    setDueDate(suggested);
  }

  function handleFilterPeriodChange(nextYear: number | null, nextMonth: number | null) {
    if (nextYear == null) return;
    setYear(nextYear);
    setMonth(nextMonth);
  }

  const loadExpenses = useCallback(async () => {
    if (!canManage) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        type: typeFilter,
        year: String(year),
        month: month == null ? "all" : String(month + 1),
      });
      const res = await fetch(`/api/expenses?${params.toString()}`, {
        credentials: "include",
        cache: "no-store",
      });
      const json = await readResponseJson<{
        success: boolean;
        message?: string;
        expenses?: ExpenseRecord[];
        summary?: ExpenseSummary;
      }>(res, "fetch");
      if (!res.ok || !json.success) {
        throw new Error(json.message ?? "Failed to load expenses");
      }
      setExpenses(json.expenses ?? []);
      setSummary(json.summary ?? EMPTY_SUMMARY);
    } catch (err) {
      setExpenses([]);
      setSummary(EMPTY_SUMMARY);
      setError(toUserFacingFetchError(err));
    } finally {
      setLoading(false);
    }
  }, [canManage, typeFilter, year, month]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch expenses when filters change
    void loadExpenses();
  }, [loadExpenses]);

  function beginEdit(expense: ExpenseRecord) {
    if (expense.status !== EXPENSE_STATUS.PENDING) return;
    setEditingId(expense.id);
    setFormType(expense.type);

    const presets =
      expense.type === EXPENSE_TYPES.DEFAULT
        ? (DEFAULT_EXPENSE_CATEGORIES as readonly string[])
        : (RECURRING_EXPENSE_CATEGORIES as readonly string[]);

    if (presets.includes(expense.category) && expense.category !== "Other") {
      setCategory(expense.category);
      setCustomCategory("");
    } else {
      setCategory("Other");
      setCustomCategory(expense.category);
    }

    setTitle(expense.title);
    setAmount(String(expense.amount));
    setFormMonth(String(expense.month));
    setFormYear(String(expense.year));
    setDueDate(
      expense.dueDate ||
        (expense.type === EXPENSE_TYPES.DEFAULT ? effectiveExpenseDueDate(expense) : ""),
    );
    setPaymentMode(expense.paymentMode);
    setNotes(expense.notes);
    setShowForm(true);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);

    const resolvedCategory =
      category === "Other" && customCategory.trim() ? customCategory.trim() : category;

    const payload = {
      action: "update",
      id: editingId ?? undefined,
      type: formType,
      category: resolvedCategory,
      title: title.trim(),
      amount: Number(amount),
      month: Number(formMonth),
      year: Number(formYear),
      dueDate: formType === EXPENSE_TYPES.DEFAULT ? dueDate : "",
      paymentMode,
      notes: notes.trim(),
    };

    try {
      const res = await fetch("/api/expenses", {
        method: editingId ? "PATCH" : "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await readResponseJson<{ success: boolean; message?: string }>(res, "action");
      if (!res.ok || !json.success) {
        throw new Error(
          json.message ?? (editingId ? "Failed to update expense" : "Failed to create expense"),
        );
      }
      setShowForm(false);
      resetForm();
      await loadExpenses();
    } catch (err) {
      setError(toUserFacingActionError(err instanceof Error ? err : "Failed to save expense"));
    } finally {
      setSaving(false);
    }
  }

  async function handleMarkPaid(expense: ExpenseRecord) {
    if (!window.confirm(`Mark "${expense.title}" (${formatInr(expense.amount)}) as paid?`)) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/expenses", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "mark_paid",
          id: expense.id,
          type: expense.type,
        }),
      });
      const json = await readResponseJson<{ success: boolean; message?: string }>(res, "action");
      if (!res.ok || !json.success) {
        throw new Error(json.message ?? "Failed to mark expense as paid");
      }
      await loadExpenses();
    } catch (err) {
      setError(
        toUserFacingActionError(err instanceof Error ? err : "Failed to mark expense as paid"),
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleRejectSubmit(event: FormEvent) {
    event.preventDefault();
    if (!rejectingExpense) return;
    const reason = rejectionReason.trim();
    if (!reason) {
      setError("Rejection reason is required.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/expenses", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "reject",
          id: rejectingExpense.id,
          type: rejectingExpense.type,
          reason,
        }),
      });
      const json = await readResponseJson<{ success: boolean; message?: string }>(res, "action");
      if (!res.ok || !json.success) {
        throw new Error(json.message ?? "Failed to reject expense");
      }
      if (editingId === rejectingExpense.id) {
        setShowForm(false);
        resetForm();
      }
      setRejectingExpense(null);
      setRejectionReason("");
      await loadExpenses();
    } catch (err) {
      setError(toUserFacingActionError(err instanceof Error ? err : "Failed to reject expense"));
    } finally {
      setSaving(false);
    }
  }

  const tableRows: TableRow[] = useMemo(
    () =>
      expenses.map((expense) => ({
        id: expense.id,
        type: typeLabel(expense.type),
        category: expense.category,
        title: expense.title,
        amount: formatInr(expense.amount),
        paymentMode: expense.paymentMode,
        dueDate:
          expense.type === EXPENSE_TYPES.DEFAULT
            ? formatDueDateDisplay(effectiveExpenseDueDate(expense))
            : "—",
        period: `${MONTHS[expense.month - 1]} ${expense.year}`,
        status: expense.status,
        notes:
          expense.status === EXPENSE_STATUS.REJECTED && expense.rejectionReason
            ? `Rejected: ${expense.rejectionReason}`
            : expense.notes || "—",
        createdBy: expense.createdBy || "—",
      })),
    [expenses],
  );

  const columns: Column<TableRow>[] = useMemo(
    () => [
      {
        key: "type",
        header: "Type",
        render: (row) => (
          <Badge variant={row.type === "Default" ? "success" : "warning"}>{row.type}</Badge>
        ),
      },
      { key: "category", header: "Category", sortable: true },
      { key: "title", header: "Title", sortable: true },
      { key: "amount", header: "Amount" },
      { key: "paymentMode", header: "Payment" },
      { key: "dueDate", header: "Due date" },
      { key: "period", header: "Period", sortable: true },
      {
        key: "status",
        header: "Status",
        render: (row) => <Badge variant={statusVariant(row.status)}>{row.status}</Badge>,
      },
      { key: "notes", header: "Notes" },
      { key: "createdBy", header: "Added by" },
      {
        key: "id",
        header: "Actions",
        render: (row) => {
          const expense = expenses.find((item) => item.id === row.id);
          if (!expense) return <span className="text-ex-muted">—</span>;
          if (expense.status !== EXPENSE_STATUS.PENDING) {
            return <span className="text-ex-muted text-xs">{expense.status}</span>;
          }
          return (
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={saving}
                onClick={() => void handleMarkPaid(expense)}
              >
                <CheckCircle2 className="size-4" />
                Mark paid
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={saving}
                onClick={() => beginEdit(expense)}
              >
                <Pencil className="size-4" />
                Edit
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={saving}
                onClick={() => {
                  setRejectingExpense(expense);
                  setRejectionReason("");
                  setError(null);
                }}
              >
                <XCircle className="size-4" />
                Reject
              </Button>
            </div>
          );
        },
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps -- handlers close over latest state
    [expenses, saving],
  );

  const categoryOptions =
    formType === EXPENSE_TYPES.DEFAULT ? DEFAULT_EXPENSE_CATEGORIES : RECURRING_EXPENSE_CATEGORIES;

  const periodLabel = month == null ? `All months · ${year}` : `${MONTHS[month]} · ${year}`;

  if (authLoading) return null;

  if (!canManage) {
    return (
      <div className="space-y-8">
        <PageHeader
          title="Expenses"
          description="Track default office bills and other recurring expenses."
        />
        <AccessDenied
          description="Only HR and Super Admin can manage expenses."
          action={
            <Link href="/dashboard">
              <Button variant="outline" size="sm">
                <ArrowLeft className="size-4" />
                Back to overview
              </Button>
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Expenses"
        description="Record default bills (office rent, electricity) with due dates, and other recurring expenses. HR gets daily reminders until each default bill is marked paid."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="md"
              onClick={() => void loadExpenses()}
              disabled={loading || saving}
            >
              <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button
              size="md"
              onClick={() => {
                if (showForm) {
                  setShowForm(false);
                  resetForm();
                } else {
                  resetForm();
                  setShowForm(true);
                }
              }}
              disabled={saving}
            >
              {showForm ? <X className="size-4" /> : <Plus className="size-4" />}
              {showForm ? "Close Form" : "Add Expense"}
            </Button>
          </div>
        }
      />

      {error ? (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-700 dark:text-rose-300">
          {error}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        {(
          [
            { value: "all", label: "All" },
            { value: EXPENSE_TYPES.DEFAULT, label: "Default" },
            { value: EXPENSE_TYPES.RECURRING, label: "Recurring" },
          ] as const
        ).map((tab) => (
          <Button
            key={tab.value}
            type="button"
            size="md"
            variant={typeFilter === tab.value ? "primary" : "outline"}
            onClick={() => setTypeFilter(tab.value)}
            disabled={loading || saving}
            className="h-10 w-36"
          >
            {tab.label}
          </Button>
        ))}
        <MonthYearPicker
          year={year}
          month={month}
          periods={periods}
          allowAllMonths
          hideLabel
          label="Period"
          className="w-36"
          onChange={handleFilterPeriodChange}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Period"
          value={periodLabel}
          hint={`${summary.pendingCount} pending · ${summary.paidCount} paid`}
        />
        <StatCard
          label="Total Paid"
          value={formatInr(summary.totalPaid)}
          hint="Settled expenses only"
        />
        <StatCard
          label="Default total"
          value={formatInr(summary.defaultTotal)}
          hint="Pending default expenses"
        />
        <StatCard
          label="Recurring total"
          value={formatInr(summary.recurringTotal)}
          hint="Pending recurring expenses"
        />
      </div>

      {rejectingExpense ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Reject expense — {rejectingExpense.title} ({formatInr(rejectingExpense.amount)})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={(e) => void handleRejectSubmit(e)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="rejection-reason">Rejection reason</Label>
                <Textarea
                  id="rejection-reason"
                  required
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Why is this expense being rejected?"
                  disabled={saving}
                  rows={3}
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="submit" variant="danger" disabled={saving}>
                  {saving ? "Rejecting…" : "Confirm reject"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={saving}
                  onClick={() => {
                    setRejectingExpense(null);
                    setRejectionReason("");
                  }}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}

      {showForm ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {editingId ? "Edit expense" : "Add expense"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={(e) => void handleSubmit(e)} className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="expense-type">Type</Label>
                  <Select
                    id="expense-type"
                    value={formType}
                    disabled={saving || Boolean(editingId)}
                    onChange={(e) => {
                      const next = e.target.value as ExpenseType;
                      setFormType(next);
                      const nextCategory =
                        next === EXPENSE_TYPES.DEFAULT
                          ? DEFAULT_EXPENSE_CATEGORIES[0]
                          : RECURRING_EXPENSE_CATEGORIES[0];
                      setCategory(nextCategory);
                      setCustomCategory("");
                      if (next === EXPENSE_TYPES.DEFAULT) {
                        applySuggestedDueDate(nextCategory, formYear, formMonth);
                      } else {
                        setDueDate("");
                      }
                    }}
                  >
                    <option value={EXPENSE_TYPES.DEFAULT}>Default</option>
                    <option value={EXPENSE_TYPES.RECURRING}>Recurring (other)</option>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="expense-category">Category</Label>
                  <Select
                    id="expense-category"
                    value={category}
                    disabled={saving}
                    onChange={(e) => {
                      const nextCategory = e.target.value;
                      setCategory(nextCategory);
                      if (nextCategory !== "Other") setCustomCategory("");
                      if (formType === EXPENSE_TYPES.DEFAULT) {
                        applySuggestedDueDate(nextCategory, formYear, formMonth);
                      }
                    }}
                  >
                    {categoryOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>

              {category === "Other" ? (
                <div className="space-y-2">
                  <Label htmlFor="expense-custom-category">Custom category</Label>
                  <Input
                    id="expense-custom-category"
                    required
                    value={customCategory}
                    onChange={(e) => setCustomCategory(e.target.value)}
                    placeholder={
                      formType === EXPENSE_TYPES.DEFAULT
                        ? "e.g. Water bill, Internet"
                        : "e.g. Cleaning service"
                    }
                    disabled={saving}
                  />
                </div>
              ) : null}

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="expense-title">Title</Label>
                  <Input
                    id="expense-title"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. electricity bill"
                    disabled={saving}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="expense-amount">Amount (Rs.)</Label>
                  <Input
                    id="expense-amount"
                    type="number"
                    min={1}
                    step="0.01"
                    required
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    disabled={saving}
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="expense-month">Month</Label>
                  <Select
                    id="expense-month"
                    value={formMonth}
                    onChange={(e) => {
                      const nextMonth = e.target.value;
                      setFormMonth(nextMonth);
                      if (formType === EXPENSE_TYPES.DEFAULT && category === "Electricity Bill") {
                        applySuggestedDueDate(category, formYear, nextMonth);
                      }
                    }}
                    disabled={saving}
                  >
                    {MONTHS.map((name, index) => (
                      <option key={name} value={String(index + 1)}>
                        {name}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="expense-year">Year</Label>
                  <Select
                    id="expense-year"
                    value={formYear}
                    onChange={(e) => {
                      const nextYear = e.target.value;
                      setFormYear(nextYear);
                      if (formType === EXPENSE_TYPES.DEFAULT && category === "Electricity Bill") {
                        applySuggestedDueDate(category, nextYear, formMonth);
                      }
                    }}
                    disabled={saving}
                  >
                    {yearOptions.map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>

              {formType === EXPENSE_TYPES.DEFAULT ? (
                <div className="space-y-2">
                  <Label htmlFor="expense-due-date">Due date</Label>
                  <DateInput
                    id="expense-due-date"
                    required
                    value={dueDate}
                    onChange={setDueDate}
                    disabled={saving}
                    minYear={Number(formYear) - 1}
                    maxYear={Number(formYear) + 1}
                  />
                  <p className="text-ex-muted text-xs">
                    {category === "Electricity Bill"
                      ? "Defaults to the 5th of the selected month — you can change it."
                      : "Set the payment due date for this bill."}
                  </p>
                </div>
              ) : null}

              <div className="space-y-2">
                <Label htmlFor="expense-payment-mode">Payment mode</Label>
                <Select
                  id="expense-payment-mode"
                  value={paymentMode}
                  onChange={(e) => setPaymentMode(e.target.value as ExpensePaymentMode)}
                  disabled={saving}
                  required
                >
                  {EXPENSE_PAYMENT_MODE_OPTIONS.map((mode) => (
                    <option key={mode} value={mode}>
                      {mode}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="expense-notes">Notes (optional)</Label>
                <Textarea
                  id="expense-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Vendor, invoice number, payment mode…"
                  disabled={saving}
                  rows={3}
                />
              </div>

              <div className="flex flex-wrap gap-2">
                <Button type="submit" disabled={saving}>
                  {saving ? "Saving…" : editingId ? "Update expense" : "Save expense"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={saving}
                  onClick={() => {
                    setShowForm(false);
                    resetForm();
                  }}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader className="border-0 pb-0">
          <CardTitle className={cn("text-ex-secondary text-base")}>Expense list</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            rows={tableRows}
            loading={loading}
            emptyTitle="No expenses found"
            emptyDescription="No expenses match this type, month, and year filter."
          />
        </CardContent>
      </Card>
    </div>
  );
}
