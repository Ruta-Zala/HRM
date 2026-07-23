import { NextResponse } from "next/server";

import { withActiveSession } from "@/lib/auth/api-guard";
import { canManageEmployees } from "@/lib/auth/roles";
import { sheetRowToForm } from "@/lib/employee";
import { listCompanyHolidays } from "@/lib/company-holiday-sheets";
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
  findEffectiveSalaryForPeriodFromRecords,
  listSalaryHistoryRecords,
} from "@/lib/salary-slips/sheets";

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

    const [employeeSheet, holidays, salaryHistory] = await Promise.all([
      readSheet(EMPLOYEE_SHEET_RANGE),
      listCompanyHolidays(year),
      listSalaryHistoryRecords(),
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
      const attendanceSpreadsheetId = form.attendanceSpreadsheetId?.trim() ?? "";
      if (attendanceSpreadsheetId) {
        try {
          const rows = await getMonthAttendance(attendanceSpreadsheetId, year, month - 1);
          for (const attendance of rows) {
            if (!attendance.date) continue;
            attendanceByDate.set(attendance.date, {
              workMode: attendance.workMode,
              status: attendance.status,
            });
          }
        } catch (error) {
          console.error(`Payroll attendance load failed for row ${sheetRow}`, error);
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
        workingDays,
        scheduledDates: employeeScheduledDates,
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
      },
      employees,
    });
  } catch (error) {
    const message = formatGoogleApiClientMessage(error) || "Failed to calculate payroll";
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
});
