import { NextResponse } from "next/server";

import { withActiveSession } from "@/lib/auth/api-guard";
import { canManageEmployees } from "@/lib/auth/roles";
import { toApiErrorMessage } from "@/lib/api/user-facing-error";
import { formatGoogleApiClientMessage } from "@/lib/google/drive-auth";
import {
  createExpense,
  listExpenses,
  markExpensePaid,
  rejectExpense,
  summarizeExpenses,
  updateExpense,
} from "@/lib/expenses/sheets";
import { isExpenseType, type ExpenseType } from "@/lib/expenses/types";

function parseOptionalMonth(raw: string | null): number | undefined {
  if (raw == null || raw === "" || raw === "all") return undefined;
  const month = Number(raw);
  if (!Number.isInteger(month) || month < 1 || month > 12) return undefined;
  return month;
}

function parseYear(raw: string | null): number | undefined {
  if (raw == null || raw === "" || raw === "all") return undefined;
  const year = Number(raw);
  if (!Number.isInteger(year) || year < 2000 || year > 2100) return undefined;
  return year;
}

function parseType(raw: string | null): ExpenseType | undefined {
  if (!raw || raw === "all") return undefined;
  return isExpenseType(raw) ? raw : undefined;
}

function actorName(user: { name?: string; email?: string; id: string }): string {
  return user.name || user.email || user.id;
}

export const GET = withActiveSession(async (req, user) => {
  if (!canManageEmployees(user.role)) {
    return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const typeParam = String(searchParams.get("type") ?? "")
      .trim()
      .toLowerCase();
    const yearParam = searchParams.get("year");
    const monthParam = searchParams.get("month");

    if (typeParam && typeParam !== "all" && !isExpenseType(typeParam)) {
      return NextResponse.json(
        { success: false, message: "type must be default, recurring, or all" },
        { status: 400 },
      );
    }

    const year = parseYear(yearParam);
    const month = parseOptionalMonth(monthParam);

    if (yearParam && yearParam !== "all" && year == null) {
      return NextResponse.json(
        { success: false, message: "Valid year is required" },
        { status: 400 },
      );
    }
    if (monthParam && monthParam !== "all" && month == null) {
      return NextResponse.json(
        { success: false, message: "Valid month is required" },
        { status: 400 },
      );
    }

    const expenses = await listExpenses({
      type: parseType(typeParam),
      year,
      month,
    });

    return NextResponse.json({
      success: true,
      expenses,
      summary: summarizeExpenses(expenses),
    });
  } catch (error) {
    console.error("GET expenses error:", error);
    return NextResponse.json(
      {
        success: false,
        message: formatGoogleApiClientMessage(error) || "Failed to load expenses",
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
    const type = String(body.type ?? "")
      .trim()
      .toLowerCase();
    if (!isExpenseType(type)) {
      return NextResponse.json(
        { success: false, message: "type must be default or recurring" },
        { status: 400 },
      );
    }

    const expense = await createExpense({
      type,
      category: String(body.category ?? ""),
      title: String(body.title ?? ""),
      amount: Number(body.amount),
      month: Number(body.month),
      year: Number(body.year),
      dueDate: String(body.dueDate ?? ""),
      paymentMode: String(body.paymentMode ?? ""),
      notes: String(body.notes ?? ""),
      createdBy: actorName(user),
    });

    return NextResponse.json({ success: true, expense }, { status: 201 });
  } catch (error) {
    const message = toApiErrorMessage(error, "Failed to create expense");
    const status = /must|required|category|amount|month|year|title|payment|due date/i.test(message)
      ? 400
      : 500;
    return NextResponse.json({ success: false, message }, { status });
  }
});

export const PATCH = withActiveSession(async (req, user) => {
  if (!canManageEmployees(user.role)) {
    return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
  }

  try {
    const body = (await req.json()) as Record<string, unknown>;
    const id = String(body.id ?? "").trim();
    const type = String(body.type ?? "")
      .trim()
      .toLowerCase();
    const action = String(body.action ?? "update")
      .trim()
      .toLowerCase();

    if (!id || !isExpenseType(type)) {
      return NextResponse.json(
        { success: false, message: "id and type (default|recurring) are required" },
        { status: 400 },
      );
    }

    if (action === "mark_paid" || action === "paid") {
      const expense = await markExpensePaid({
        id,
        type,
        paidBy: actorName(user),
      });
      return NextResponse.json({ success: true, expense });
    }

    if (action === "reject") {
      const expense = await rejectExpense({
        id,
        type,
        reason: String(body.reason ?? body.rejectionReason ?? ""),
        rejectedBy: actorName(user),
      });
      return NextResponse.json({ success: true, expense });
    }

    if (action !== "update") {
      return NextResponse.json(
        { success: false, message: "action must be update, mark_paid, or reject" },
        { status: 400 },
      );
    }

    const expense = await updateExpense({
      id,
      type,
      category: String(body.category ?? ""),
      title: String(body.title ?? ""),
      amount: Number(body.amount),
      month: Number(body.month),
      year: Number(body.year),
      dueDate: String(body.dueDate ?? ""),
      paymentMode: String(body.paymentMode ?? ""),
      notes: String(body.notes ?? ""),
    });

    return NextResponse.json({ success: true, expense });
  } catch (error) {
    const message = toApiErrorMessage(error, "Failed to update expense");
    const status = /not found/i.test(message)
      ? 404
      : /must|required|category|amount|month|year|title|pending|paid|rejected|reason|payment|due date/i.test(
            message,
          )
        ? 400
        : 500;
    return NextResponse.json({ success: false, message }, { status });
  }
});
