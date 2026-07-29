import { NextResponse } from "next/server";

import { listUnapprovedAbsenceEmployees } from "@/lib/attendance/unapproved-absence";
import { withActiveSession } from "@/lib/auth/api-guard";
import { canManageEmployees } from "@/lib/auth/roles";
import { notificationDateIso } from "@/lib/notifications/automation-date";

function isValidDateIso(value: string): boolean {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return false;

  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export const GET = withActiveSession(async (req, user) => {
  if (!canManageEmployees(user.role)) {
    return NextResponse.json(
      { success: false, message: "You do not have permission to view unapproved absences" },
      { status: 403 },
    );
  }

  try {
    const { searchParams } = new URL(req.url);
    const date = searchParams.get("date")?.trim() || notificationDateIso();

    if (!isValidDateIso(date)) {
      return NextResponse.json(
        { success: false, message: "Date must be a valid YYYY-MM-DD value" },
        { status: 400 },
      );
    }

    const employees = await listUnapprovedAbsenceEmployees(date);

    return NextResponse.json({
      success: true,
      date,
      count: employees.length,
      employees,
    });
  } catch (error) {
    console.error("GET Dashboard Unapproved Absence Error:", error);

    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error ? error.message : "Failed to load unapproved absence employees",
      },
      { status: 500 },
    );
  }
});
