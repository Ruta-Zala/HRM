import { NextResponse } from "next/server";
import { z } from "zod";

import { submitAbsenceExplanations } from "@/lib/attendance/absence-explanation";
import { roleRequiresAbsenceExplanationGate } from "@/lib/attendance/absence-gate";
import {
  applyAbsenceGateCookie,
  getPendingAbsenceGroupsForUser,
  invalidateAbsenceExplanationCache,
} from "@/lib/attendance/absence-gate-sync";
import {
  ABSENCE_GATE_COOKIE,
  isAbsenceGateCookieActive,
  setAbsenceGateCookie,
} from "@/lib/attendance/absence-gate-cookie";
import { resolveAttendanceEmployee } from "@/lib/attendance/employee";
import {
  getCachedAbsenceGroups,
  setCachedAbsenceGroups,
} from "@/lib/attendance/absence-explanation-cache";
import { withActiveSession } from "@/lib/auth/api-guard";
import { toApiErrorMessage } from "@/lib/api/user-facing-error";

const submitSchema = z.object({
  submissions: z
    .array(
      z.object({
        groupId: z.string().min(1),
        explanation: z.string().min(1),
        leaveType: z.enum(["sick", "casual"]).optional(),
        reasonType: z.enum(["today_no_punch", "rejected_leave", "unauthorized_absence"]).optional(),
        dateFromIso: z.string().optional(),
        dateToIso: z.string().optional(),
        entryDates: z.array(z.string().min(1)).optional(),
      }),
    )
    .min(1),
});

export const dynamic = "force-dynamic";

export const GET = withActiveSession(async (req, user) => {
  if (!roleRequiresAbsenceExplanationGate(user.role)) {
    const res = NextResponse.json({
      success: true,
      groups: [],
      requiresExplanation: false,
    });
    setAbsenceGateCookie(res, false);
    return res;
  }

  try {
    const forceRefresh = req.headers.get("x-absence-gate-refresh") === "1";
    const gateCookie = req.cookies.get(ABSENCE_GATE_COOKIE)?.value;

    if (!forceRefresh && !isAbsenceGateCookieActive(gateCookie)) {
      const employee = await resolveAttendanceEmployee(user);
      if (employee?.employeeId) {
        const cached = getCachedAbsenceGroups(employee.employeeId);
        if (cached) {
          const res = NextResponse.json({
            success: true,
            groups: cached,
            requiresExplanation: cached.length > 0,
          });
          await applyAbsenceGateCookie(res, user);
          return res;
        }

        setCachedAbsenceGroups(employee.employeeId, []);
        const res = NextResponse.json({
          success: true,
          groups: [],
          requiresExplanation: false,
        });
        setAbsenceGateCookie(res, false);
        return res;
      }
    }

    const groups = await getPendingAbsenceGroupsForUser(user, { forceRefresh });
    const res = NextResponse.json({
      success: true,
      groups,
      requiresExplanation: groups.length > 0,
    });
    await applyAbsenceGateCookie(res, user);
    return res;
  } catch (error) {
    console.error("[absence-explanation GET]", error);
    const message = toApiErrorMessage(error, "Failed to load absence explanations");
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
});

export const POST = withActiveSession(async (req, user) => {
  if (!roleRequiresAbsenceExplanationGate(user.role)) {
    return NextResponse.json(
      { success: false, message: "Not applicable for your role" },
      { status: 403 },
    );
  }

  try {
    const employee = await resolveAttendanceEmployee(user);
    if (!employee?.attendanceSpreadsheetId) {
      return NextResponse.json(
        { success: false, message: "Employee attendance record not found" },
        { status: 404 },
      );
    }

    const body = await req.json();
    const parsed = submitSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: parsed.error.issues[0]?.message ?? "Invalid request" },
        { status: 400 },
      );
    }

    await submitAbsenceExplanations({
      employee,
      submissions: parsed.data.submissions,
    });

    invalidateAbsenceExplanationCache(employee.employeeId);
    const groups = await getPendingAbsenceGroupsForUser(user, { forceRefresh: true });

    const res = NextResponse.json({
      success: true,
      message: "Absence explanation submitted",
      requiresExplanation: groups.length > 0,
      groups,
    });
    await applyAbsenceGateCookie(res, user, { forceRefresh: true });
    return res;
  } catch (error) {
    console.error("[absence-explanation POST]", error);
    const message = toApiErrorMessage(error, "Failed to submit absence explanation");
    return NextResponse.json({ success: false, message }, { status: 400 });
  }
});
