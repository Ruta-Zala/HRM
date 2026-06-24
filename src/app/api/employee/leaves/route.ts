import { NextResponse } from "next/server";

import { withActiveSession } from "@/lib/auth/api-guard";
import { resolveAttendanceEmployee } from "@/lib/attendance/employee";
import {
  formatBirthdayLeaveDate,
  formatBirthdayLeaveDateIso,
} from "@/lib/attendance/leave-bucket-layout";
import { listLeaveApplications } from "@/lib/attendance/leave-approvals";
import {
  groupLeaveApplicationsForDisplay,
  groupLeaveBucketEntriesForDisplay,
} from "@/lib/attendance/leave-range-display";
import {
  LEAVE_ALLOCATIONS,
  allocateLeaveDates,
  countLeaveBucketUsage,
  groupAssignmentsByBucket,
  listLeaveBucketEntries,
  type LeaveBucketType,
} from "@/lib/attendance/leave-policy";
import {
  addGroupedLeaveDatesToBucket,
  importLeaveBucketCsv,
  readLeaveBucketRows,
} from "@/lib/google/attendance-sheets";
import { formatIsoDate } from "@/lib/attendance/time";

function parseIsoDate(value: string): Date | null {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseBirthdayLeaveDate(birthdayDate: string): Date | null {
  const formatted = formatBirthdayLeaveDate(birthdayDate);
  const slashMatch = formatted.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!slashMatch) return null;

  const day = Number(slashMatch[1]);
  const month = Number(slashMatch[2]);
  const year = Number(slashMatch[3]);
  const date = new Date(year, month - 1, day);
  return Number.isNaN(date.getTime()) ? null : date;
}

function getLeaveDatesBetween(start: Date, end: Date): Date[] {
  const dates: Date[] = [];
  const current = new Date(start);

  while (current <= end) {
    dates.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }

  return dates;
}

function normalizeLeaveType(value: unknown): LeaveBucketType {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase();

  if (normalized === "paid" || normalized === "paid leave") {
    return "paid";
  }

  if (normalized === "casual" || normalized === "casual leave") {
    return "casual";
  }

  if (normalized === "sick" || normalized === "sick leave" || normalized === "sl") {
    return "sick";
  }

  if (normalized === "birthday" || normalized === "birthday leave") {
    return "birthday";
  }

  if (normalized === "unpaid" || normalized === "unpaid leave") {
    return "unpaid";
  }

  return "paid";
}

function normalizeLeaveDuration(value: unknown): "full" | "half_am" | "half_pm" {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase();

  if (normalized === "half_am") {
    return "half_am";
  }

  if (normalized === "half_pm") {
    return "half_pm";
  }

  return "full";
}

export const POST = withActiveSession(async (req, user) => {
  try {
    const body = await req.json();

    if (typeof body.csv === "string" && body.csv.trim()) {
      const employee = await resolveAttendanceEmployee(user);

      if (!employee?.attendanceSpreadsheetId) {
        return NextResponse.json(
          {
            success: false,
            message: "Leave bucket spreadsheet not found for employee",
          },
          { status: 404 },
        );
      }

      await importLeaveBucketCsv(employee.attendanceSpreadsheetId, body.csv);

      return NextResponse.json(
        {
          success: true,
          message: "Leave bucket CSV imported successfully",
        },
        { status: 201 },
      );
    }

    const employee = await resolveAttendanceEmployee(user);

    if (!employee?.attendanceSpreadsheetId) {
      return NextResponse.json(
        {
          success: false,
          message: "Employee attendance spreadsheet not found",
        },
        { status: 404 },
      );
    }

    const leaveType = normalizeLeaveType(body.leaveType);
    const duration = normalizeLeaveDuration(body.duration);
    const reason = String(body.reason ?? "").trim();

    if (leaveType === "birthday") {
      const requestedDate = String(body.fromDate ?? "").trim();
      let birthdayDate: Date | null = null;

      if (requestedDate) {
        birthdayDate = parseIsoDate(requestedDate);
        if (!birthdayDate) {
          return NextResponse.json(
            {
              success: false,
              message: "Invalid birthday leave date",
            },
            { status: 400 },
          );
        }
      } else if (employee.birthdayDate) {
        birthdayDate = parseBirthdayLeaveDate(employee.birthdayDate);
      }

      if (!birthdayDate) {
        return NextResponse.json(
          {
            success: false,
            message: "Birthday leave date is required",
          },
          { status: 400 },
        );
      }

      const leaveDateIso =
        requestedDate ||
        `${birthdayDate.getFullYear()}-${String(birthdayDate.getMonth() + 1).padStart(2, "0")}-${String(birthdayDate.getDate()).padStart(2, "0")}`;
      const today = formatIsoDate();
      if (leaveDateIso < today) {
        return NextResponse.json(
          {
            success: false,
            message: "Cannot apply leave for past dates",
          },
          { status: 400 },
        );
      }

      const rows = await readLeaveBucketRows(employee.attendanceSpreadsheetId);
      const usage = countLeaveBucketUsage(rows);

      const { assignments, error } = allocateLeaveDates({
        leaveType: "birthday",
        dates: [birthdayDate],
        duration: "full",
        usage,
      });

      if (error) {
        return NextResponse.json({ success: false, message: error }, { status: 400 });
      }

      const grouped = groupAssignmentsByBucket(assignments);
      const groups = Array.from(grouped.entries()).map(([bucket, dates]) => ({
        leaveType: bucket,
        dates,
      }));

      await addGroupedLeaveDatesToBucket(employee.attendanceSpreadsheetId, groups, "full", "");

      return NextResponse.json(
        {
          success: true,
          requestId: `LR-${Date.now()}`,
          message: "Birthday leave request submitted",
        },
        { status: 201 },
      );
    }

    const fromDate = String(body.fromDate ?? "").trim();
    const toDate = String(body.toDate ?? "").trim();

    if (!fromDate) {
      return NextResponse.json(
        {
          success: false,
          message: "From date is required",
        },
        { status: 400 },
      );
    }

    if (!toDate) {
      return NextResponse.json(
        {
          success: false,
          message: "To date is required",
        },
        { status: 400 },
      );
    }

    if (!reason) {
      return NextResponse.json(
        {
          success: false,
          message: "Reason is required",
        },
        { status: 400 },
      );
    }

    const startDate = parseIsoDate(fromDate);
    const endDate = parseIsoDate(toDate);

    if (!startDate || !endDate) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid date values",
        },
        { status: 400 },
      );
    }

    if (startDate > endDate) {
      return NextResponse.json(
        {
          success: false,
          message: "From date cannot be after To date",
        },
        { status: 400 },
      );
    }

    const today = formatIsoDate();
    if (fromDate < today || toDate < today) {
      return NextResponse.json(
        {
          success: false,
          message: "Cannot apply leave for past dates",
        },
        { status: 400 },
      );
    }

    const leaveDates = getLeaveDatesBetween(startDate, endDate);
    const rows = await readLeaveBucketRows(employee.attendanceSpreadsheetId);
    const usage = countLeaveBucketUsage(rows);

    const { assignments, error } = allocateLeaveDates({
      leaveType,
      dates: leaveDates,
      duration,
      usage,
    });

    if (error) {
      return NextResponse.json(
        {
          success: false,
          message: error,
        },
        { status: 400 },
      );
    }

    const grouped = groupAssignmentsByBucket(assignments);
    const groups = Array.from(grouped.entries()).map(([bucket, dates]) => ({
      leaveType: bucket,
      dates,
    }));

    await addGroupedLeaveDatesToBucket(employee.attendanceSpreadsheetId, groups, duration, reason);

    const requestId = `LR-${Date.now()}`;

    return NextResponse.json(
      {
        success: true,
        requestId,
        message: "Leave request submitted",
      },
      { status: 201 },
    );
  } catch (error: unknown) {
    console.error("POST Leave Request Error:", error);

    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Failed to submit leave request",
      },
      { status: 500 },
    );
  }
});

export const GET = withActiveSession(async (_req, user) => {
  try {
    const employee = await resolveAttendanceEmployee(user);

    if (!employee?.attendanceSpreadsheetId) {
      return NextResponse.json(
        {
          success: false,
          message: "Employee attendance spreadsheet not found",
        },
        { status: 404 },
      );
    }

    const rows = await readLeaveBucketRows(employee.attendanceSpreadsheetId);
    const usage = countLeaveBucketUsage(rows);
    const unpaidLeaves = groupLeaveBucketEntriesForDisplay(listLeaveBucketEntries(rows, "unpaid"));
    const applications = groupLeaveApplicationsForDisplay(
      (
        await listLeaveApplications({
          employeeId: employee.employeeId,
          employeeName: employee.employeeName,
          attendanceSpreadsheetId: employee.attendanceSpreadsheetId,
        })
      ).filter((application) => application.leaveType !== "unpaid"),
    );

    return NextResponse.json({
      success: true,
      birthdayDate: formatBirthdayLeaveDate(employee.birthdayDate),
      birthdayDateIso: formatBirthdayLeaveDateIso(employee.birthdayDate),

      paid: {
        allocated: LEAVE_ALLOCATIONS.paid,
        used: usage.paid,
        remaining: Math.max(0, LEAVE_ALLOCATIONS.paid - usage.paid),
      },

      casual: {
        allocated: LEAVE_ALLOCATIONS.casual,
        used: usage.casual,
        remaining: Math.max(0, LEAVE_ALLOCATIONS.casual - usage.casual),
      },

      sick: {
        allocated: LEAVE_ALLOCATIONS.sick,
        used: usage.sick,
        remaining: Math.max(0, LEAVE_ALLOCATIONS.sick - usage.sick),
      },

      unpaid: {
        used: usage.unpaid,
        leaves: unpaidLeaves,
      },

      birthday: {
        allocated: LEAVE_ALLOCATIONS.birthday,
        used: usage.birthday,
        remaining: Math.max(0, LEAVE_ALLOCATIONS.birthday - usage.birthday),
      },

      applications,
    });
  } catch (error) {
    console.error("GET Leave Balance Error:", error);

    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Failed to fetch leave balances",
      },
      { status: 500 },
    );
  }
});
