import { NextResponse } from "next/server";

import { listEmployeesOnLeave } from "@/lib/attendance/on-leave";
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
  try {
    const { searchParams } = new URL(req.url);
    const canSelectDate = canManageEmployees(user.role);
    const date = canSelectDate
      ? searchParams.get("date")?.trim() || notificationDateIso()
      : notificationDateIso();

    if (!isValidDateIso(date)) {
      return NextResponse.json(
        { success: false, message: "Date must be a valid YYYY-MM-DD value" },
        { status: 400 },
      );
    }

    const employees = await listEmployeesOnLeave(date);
    const visibleEmployees = canSelectDate
      ? employees
      : employees.map((employee) => ({
          ...employee,
          leaveType: "leave",
          reason: "",
        }));

    return NextResponse.json({
      success: true,
      date,
      count: visibleEmployees.length,
      employees: visibleEmployees,
    });
  } catch (error) {
    console.error("GET Dashboard On Leave Error:", error);

    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Failed to load employees on leave",
      },
      { status: 500 },
    );
  }
});
