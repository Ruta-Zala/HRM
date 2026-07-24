import { NextResponse } from "next/server";

import { withActiveSession } from "@/lib/auth/api-guard";
import { canManageEmployees } from "@/lib/auth/roles";
import { canonicalizeWorkMode } from "@/lib/attendance/constants";
import {
  getAttendanceSpreadsheetIdFromRow,
  resolveAttendanceSpreadsheetIdForRow,
} from "@/lib/attendance/employee";
import { sheetRowToForm } from "@/lib/employee";
import { listCompanyHolidays } from "@/lib/company-holiday-sheets";
import { listLeaveApplications } from "@/lib/attendance/leave-approvals";
import { LEAVE_STATUS } from "@/lib/attendance/leave-status";
import { getMonthAttendance } from "@/lib/google/attendance-sheets";
import { EMPLOYEE_SHEET_RANGE, readSheet } from "@/lib/google/sheets";
import { formatGoogleApiClientMessage } from "@/lib/google/drive-auth";
import {
  aggregatePayroll,
  calculateEmployeePayroll,
  DEFAULT_LOYALTY_PERCENT,
  DEFAULT_LWF,
  DEFAULT_PROFESSIONAL_TAX,
  getDaysInMonth,
  listScheduledWorkingDates,
} from "@/lib/payroll";
import { filterDatesForEmployment, wasEmployedDuringPeriod } from "@/lib/payroll/employment";
import {
  buildAcceptedLeaveAttendanceOverlays,
  localDateIso,
  mergeAttendanceWithApprovedLeaves,
} from "@/lib/payroll/leave-attendance";
import {
  findEffectiveSalaryForPeriodFromRecords,
  listSalaryHistoryRecords,
} from "@/lib/salary-slips/sheets";
import { mapSalaryAdvanceDeductionsForPeriod } from "@/lib/salary-advances";

export const GET = withActiveSession(async (req, user) => {
  if (!canManageEmployees(user.role)) {
    return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const year = Number(searchParams.get("year"));
    const month = Number(searchParams.get("month"));

    if (!Number.isFinite(year) || year < 2000 || year > 2100) {
      return NextResponse.json({ success: false, message: "Invalid year" }, { status: 400 });
    }
    if (!Number.isFinite(month) || month < 1 || month > 12) {
      return NextResponse.json({ success: false, message: "Invalid month" }, { status: 400 });
    }

    const [employeeSheet, holidays, salaryHistory, advanceDeductions] = await Promise.all([
      readSheet(EMPLOYEE_SHEET_RANGE),
      listCompanyHolidays(year),
      listSalaryHistoryRecords(),
      mapSalaryAdvanceDeductionsForPeriod(year, month),
    ]);

    if (!employeeSheet.length) {
      return NextResponse.json({
        success: true,
        period: { year, month, workingDays: 0, scheduledDates: [] },
        summary: aggregatePayroll([]),
        deductions: {
          pt: { payable: 0, employeeCount: 0 },
          lwf: { payable: 0, employeeCount: 0 },
          loyalty: { payable: 0, employeeCount: 0 },
          unpaidLeave: { payable: 0, employeeCount: 0 },
          salaryAdvance: { payable: 0, employeeCount: 0 },
        },
        employees: [],
      });
    }

    const headers = employeeSheet[0] as string[];
    const scheduledDates = listScheduledWorkingDates(year, month, holidays);
    const workingDays = scheduledDates.length;
    const periodStart = `${year}-${String(month).padStart(2, "0")}-01`;
    const periodEnd = `${year}-${String(month).padStart(2, "0")}-${String(getDaysInMonth(year, month)).padStart(2, "0")}`;

    const employees: Array<{
      id: string;
      employeeSheetRow: number;
      employeeId: string;
      name: string;
      designation: string;
      skippedReason?: string;
      payroll: ReturnType<typeof calculateEmployeePayroll> | null;
    }> = [];

    const payableRows: ReturnType<typeof calculateEmployeePayroll>[] = [];

    for (let i = 1; i < employeeSheet.length; i += 1) {
      const sheetRow = i + 1;
      const row = employeeSheet[i] ?? [];
      const form = sheetRowToForm(headers, row);
      if (!form.name.trim()) continue;

      // Only include people employed during this payroll month (by joining / last working day).
      if (
        !wasEmployedDuringPeriod({
          joiningDate: form.joiningDate,
          lastWorkingDay: form.lastWorkingDay,
          periodStart,
          periodEnd,
        })
      ) {
        continue;
      }

      const employeeScheduledDates = filterDatesForEmployment(
        scheduledDates,
        form.joiningDate,
        form.lastWorkingDay,
      );
      if (employeeScheduledDates.length === 0) continue;

      const history = findEffectiveSalaryForPeriodFromRecords(salaryHistory, {
        employeeSheetRow: sheetRow,
        periodStart,
        periodEnd,
      });
      const salaryFromForm = Number(String(form.salary ?? "").replace(/,/g, ""));
      const monthlySalary =
        history?.basic ?? (Number.isFinite(salaryFromForm) ? salaryFromForm : 0);

      if (!monthlySalary || monthlySalary <= 0) {
        employees.push({
          id: String(sheetRow),
          employeeSheetRow: sheetRow,
          employeeId: form.employeeId,
          name: form.name,
          designation: form.position,
          skippedReason: "No salary configured for this period",
          payroll: null,
        });
        continue;
      }

      const attendanceByDate = new Map<string, { workMode?: string; status?: string }>();

      // Prefer the stored Employees-sheet ID (same workbook punch uses). Avoid a Drive
      // accessibility check per employee — that was exhausting Sheets/Drive quota and
      // silently leaving Attend Days at 0 when loads failed.
      let attendanceSpreadsheetId =
        form.attendanceSpreadsheetId?.trim() || getAttendanceSpreadsheetIdFromRow(headers, row);

      if (!attendanceSpreadsheetId) {
        attendanceSpreadsheetId = await resolveAttendanceSpreadsheetIdForRow({
          headers,
          row,
          sheetRow,
          employeeId: form.employeeId.trim(),
          employeeName: form.name.trim() || "Employee",
          documentsFolderId: form.documentsFolderId,
          birthdayDate: form.birthdayDate,
          createIfMissing: false,
        });
      }

      const loadMonthRows = async (spreadsheetId: string) => {
        const rows = await getMonthAttendance(spreadsheetId, year, month - 1);
        attendanceByDate.clear();
        for (const attendance of rows) {
          if (!attendance.date) continue;
          attendanceByDate.set(attendance.date, {
            workMode: canonicalizeWorkMode(attendance.workMode ?? ""),
            status: attendance.status,
            punchIn: attendance.punchIn,
            punchOut: attendance.punchOut,
          });
        }
        return rows.length;
      };

      if (attendanceSpreadsheetId) {
        try {
          const loaded = await loadMonthRows(attendanceSpreadsheetId);
          if (loaded === 0 && form.documentsFolderId.trim()) {
            const folderResolved = await resolveAttendanceSpreadsheetIdForRow({
              headers,
              row,
              sheetRow,
              employeeId: form.employeeId.trim(),
              employeeName: form.name.trim() || "Employee",
              documentsFolderId: form.documentsFolderId,
              birthdayDate: form.birthdayDate,
              createIfMissing: false,
              preferFolderSearch: true,
            });
            if (folderResolved && folderResolved !== attendanceSpreadsheetId) {
              attendanceSpreadsheetId = folderResolved;
              await loadMonthRows(attendanceSpreadsheetId);
            }
          }
        } catch (error) {
          console.error(`Payroll attendance load failed for row ${sheetRow}`, error);
          try {
            const folderResolved = await resolveAttendanceSpreadsheetIdForRow({
              headers,
              row,
              sheetRow,
              employeeId: form.employeeId.trim(),
              employeeName: form.name.trim() || "Employee",
              documentsFolderId: form.documentsFolderId,
              birthdayDate: form.birthdayDate,
              createIfMissing: false,
              preferFolderSearch: true,
            });
            if (folderResolved) {
              attendanceSpreadsheetId = folderResolved;
              await loadMonthRows(attendanceSpreadsheetId);
            }
          } catch (retryError) {
            console.error(`Payroll attendance folder retry failed for row ${sheetRow}`, retryError);
          }
        }

        if (attendanceSpreadsheetId) {
          try {
            const leaveApplications = await listLeaveApplications({
              employeeId: form.employeeId,
              employeeName: form.name,
              attendanceSpreadsheetId,
              statusFilter: LEAVE_STATUS.ACCEPTED,
            });
            const overlays = buildAcceptedLeaveAttendanceOverlays(leaveApplications).filter(
              (overlay) => overlay.dateIso >= periodStart && overlay.dateIso <= periodEnd,
            );
            const merged = mergeAttendanceWithApprovedLeaves(attendanceByDate, overlays);
            attendanceByDate.clear();
            for (const [date, value] of merged) {
              attendanceByDate.set(date, {
                workMode: canonicalizeWorkMode(value.workMode ?? ""),
                status: value.status,
                punchIn: value.punchIn,
                punchOut: value.punchOut,
              });
            }
          } catch (error) {
            console.error(`Payroll leave bucket load failed for row ${sheetRow}`, error);
          }
        }
      }

      // Do not treat blank future days as unpaid, but keep days that already have
      // attendance or an approved leave (e.g. leave booked for tomorrow).
      // For a whole future payroll month (planning), use the full schedule and
      // assume present on days without a punch yet so projected pay + advance show.
      const asOfIso = localDateIso();
      const periodIsFuture = periodStart > asOfIso;
      const dueScheduledDates = periodIsFuture
        ? employeeScheduledDates
        : employeeScheduledDates.filter((date) => date <= asOfIso || attendanceByDate.has(date));

      if (periodIsFuture) {
        for (const date of dueScheduledDates) {
          if (!attendanceByDate.has(date)) {
            attendanceByDate.set(date, {
              workMode: "Full Day Onsite",
              status: "Working",
            });
          }
        }
      }

      const payroll = calculateEmployeePayroll({
        monthlySalary,
        loyaltyPercent:
          history && history.loyaltyBonus > 0 ? history.loyaltyBonus : DEFAULT_LOYALTY_PERCENT,
        professionalTax:
          history && history.professionalTax > 0
            ? history.professionalTax
            : DEFAULT_PROFESSIONAL_TAX,
        lwf: DEFAULT_LWF,
        salaryAdvance: advanceDeductions.get(sheetRow) ?? 0,
        workingDays,
        scheduledDates: dueScheduledDates,
        attendanceByDate,
      });

      payableRows.push(payroll);
      employees.push({
        id: String(sheetRow),
        employeeSheetRow: sheetRow,
        employeeId: form.employeeId,
        name: form.name,
        designation: form.position,
        payroll,
      });
    }

    const summary = aggregatePayroll(payableRows);

    return NextResponse.json({
      success: true,
      period: {
        year,
        month,
        workingDays,
        scheduledDates,
        leaveHolidaysExcluded: holidays.filter((h) => h.type === "leave").map((h) => h.date),
      },
      summary,
      deductions: {
        pt: {
          payable: summary.totalProfessionalTax,
          employeeCount: summary.employeesWithPt,
        },
        lwf: {
          payable: summary.totalLwf,
          employeeCount: summary.employeesWithLwf,
        },
        loyalty: {
          payable: summary.totalLoyalty,
          employeeCount: summary.employeesWithLoyalty,
        },
        unpaidLeave: {
          payable: summary.totalUnpaidLeaveAmount,
          employeeCount: summary.employeesWithUnpaid,
        },
        salaryAdvance: {
          payable: summary.totalSalaryAdvance,
          employeeCount: summary.employeesWithAdvance,
        },
      },
      employees,
    });
  } catch (error) {
    const message = formatGoogleApiClientMessage(error) || "Failed to calculate payroll";
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
});
