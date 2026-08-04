import { NextResponse } from "next/server";

import { withActiveSession } from "@/lib/auth/api-guard";
import { canManageEmployees } from "@/lib/auth/roles";
import {
  createCompanyHoliday,
  deleteCompanyHoliday,
  listCompanyHolidays,
  updateCompanyHoliday,
} from "@/lib/company-holiday-sheets";
import type { CompanyHoliday, CompanyHolidayType } from "@/lib/company-holidays";
import { toApiErrorMessage } from "@/lib/api/user-facing-error";

function validDate(value: string): boolean {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return false;
  const parsed = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function parseHolidayInput(body: Record<string, unknown>): {
  date: string;
  name: string;
  type: CompanyHolidayType;
} | null {
  const date = String(body.date ?? "").trim();
  const name = String(body.name ?? "").trim();
  const type = String(body.type ?? "")
    .trim()
    .toLowerCase();

  if (!validDate(date) || !name || name.length > 120) return null;
  if (type !== "leave" && type !== "celebration") return null;

  return { date, name, type };
}

export const GET = withActiveSession(async (req) => {
  try {
    const yearValue = new URL(req.url).searchParams.get("year");
    const year = yearValue ? Number(yearValue) : undefined;

    if (yearValue && (!Number.isInteger(year) || Number(year) < 2000 || Number(year) > 2100)) {
      return NextResponse.json(
        { success: false, message: "Invalid holiday year" },
        { status: 400 },
      );
    }

    const holidays = await listCompanyHolidays(year);
    return NextResponse.json({ success: true, holidays });
  } catch (error) {
    console.error("GET Company Holidays Error:", error);
    return NextResponse.json(
      {
        success: false,
        message: toApiErrorMessage(error, "Failed to load company holidays"),
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
    const input = parseHolidayInput(body);
    if (!input) {
      return NextResponse.json(
        { success: false, message: "Valid date, name, and type are required" },
        { status: 400 },
      );
    }

    const holiday = await createCompanyHoliday(input);
    return NextResponse.json({ success: true, holiday }, { status: 201 });
  } catch (error) {
    console.error("POST Company Holiday Error:", error);
    return NextResponse.json(
      {
        success: false,
        message: toApiErrorMessage(error, "Failed to create company holiday"),
      },
      { status: 500 },
    );
  }
});

export const PATCH = withActiveSession(async (req, user) => {
  if (!canManageEmployees(user.role)) {
    return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
  }

  try {
    const body = (await req.json()) as Record<string, unknown>;
    const id = String(body.id ?? "").trim();
    const input = parseHolidayInput(body);
    if (!id || !input) {
      return NextResponse.json(
        { success: false, message: "Holiday id and valid holiday details are required" },
        { status: 400 },
      );
    }

    const holiday = await updateCompanyHoliday({
      id,
      ...input,
    } satisfies CompanyHoliday);

    if (!holiday) {
      return NextResponse.json({ success: false, message: "Holiday not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, holiday });
  } catch (error) {
    console.error("PATCH Company Holiday Error:", error);
    return NextResponse.json(
      {
        success: false,
        message: toApiErrorMessage(error, "Failed to update company holiday"),
      },
      { status: 500 },
    );
  }
});

export const DELETE = withActiveSession(async (req, user) => {
  if (!canManageEmployees(user.role)) {
    return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
  }

  try {
    const body = (await req.json()) as Record<string, unknown>;
    const id = String(body.id ?? "").trim();
    if (!id) {
      return NextResponse.json(
        { success: false, message: "Holiday id is required" },
        { status: 400 },
      );
    }

    const deleted = await deleteCompanyHoliday(id);
    if (!deleted) {
      return NextResponse.json({ success: false, message: "Holiday not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE Company Holiday Error:", error);
    return NextResponse.json(
      {
        success: false,
        message: toApiErrorMessage(error, "Failed to delete company holiday"),
      },
      { status: 500 },
    );
  }
});
