"use client";

import Link from "next/link";
import { CalendarDays, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
// import {
//   Area,
//   AreaChart,
//   CartesianGrid,
//   ResponsiveContainer,
//   Tooltip,
//   XAxis,
//   YAxis,
// } from "recharts";
import { AttendanceWidget } from "@/components/attendance/attendance-widget";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
// import { DataTable } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/auth-provider";
import { canManageEmployees } from "@/lib/auth/roles";
import { parseLeaveDisplayDate } from "@/lib/attendance/leave-range-display";
import { formatIsoDate } from "@/lib/attendance/time";
import { COMPANY_HOLIDAYS_2026, type CompanyHoliday } from "@/lib/company-holidays";
import { cn } from "@/lib/utils";

// const headcountTrend = [
//   { month: "Jan", onboarded: 4, attrition: 1 },
//   { month: "Feb", onboarded: 2, attrition: 0 },
//   { month: "Mar", onboarded: 5, attrition: 2 },
//   { month: "Apr", onboarded: 3, attrition: 1 },
//   { month: "May", onboarded: 6, attrition: 1 },
//   { month: "Jun", onboarded: 4, attrition: 0 },
// ];

// const leaveMix = [
//   { type: "Paid", value: 42 },
//   { type: "Sick", value: 18 },
//   { type: "Casual", value: 28 },
//   { type: "Unpaid", value: 6 },
// ];
// const leaveMax = Math.max(...leaveMix.map((r) => r.value), 1);

// const approvals = [
//   { id: "1", item: "Overtime — Neha Kapoor", owner: "HR queue", status: "Pending" },
//   { id: "2", item: "Leave — Rahul Mehta", owner: "Manager", status: "Pending" },
//   { id: "3", item: "Complaint — Floor 3 AC", owner: "Facilities", status: "In review" },
// ];

type OnLeaveEmployee = {
  id: string;
  employeeSheetRow: number;
  employeeId: string;
  employeeName: string;
  leaveType: string;
  duration: string;
  reason: string;
  date: string;
};

function displayDate(value: string): string {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

function employeeInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function leaveDateLabel(value: string): string {
  const parts = value
    .split(" - ")
    .map((part) => parseLeaveDisplayDate(part))
    .filter((date): date is Date => Boolean(date));
  if (parts.length === 0) return value;

  const formatter = new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  if (parts.length === 1) return formatter.format(parts[0]);
  return `${formatter.format(parts[0])} – ${formatter.format(parts.at(-1)!)}`;
}

function LeaveEmployeeCard({
  employee,
  birthday = false,
  showDetails = true,
}: {
  employee: OnLeaveEmployee;
  birthday?: boolean;
  showDetails?: boolean;
}) {
  const className = cn(
    "group flex items-center gap-3 px-4 py-3.5 transition",
    showDetails && "hover:bg-ex-surface",
  );
  const content = (
    <>
      <div
        className={
          birthday
            ? "flex size-10 shrink-0 items-center justify-center rounded-full bg-pink-500/15 text-xs font-bold text-pink-700 dark:text-pink-300"
            : "bg-ex-secondary/15 text-ex-secondary flex size-10 shrink-0 items-center justify-center rounded-full text-xs font-bold"
        }
      >
        {employeeInitials(employee.employeeName)}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-ex-primary group-hover:text-ex-secondary truncate text-sm font-semibold transition">
          {employee.employeeName}
        </p>
        <p className="text-ex-muted mt-0.5 text-xs">{leaveDateLabel(employee.date)}</p>
      </div>
      {showDetails ? (
        <span className="text-ex-muted group-hover:text-ex-secondary text-base transition">→</span>
      ) : null}
    </>
  );

  return showDetails ? (
    <Link href="/leave/approvals" className={className}>
      {content}
    </Link>
  ) : (
    <div className={className}>{content}</div>
  );
}

function holidayDateParts(holiday: CompanyHoliday): {
  day: string;
  weekday: string;
  month: string;
  monthIndex: number;
} {
  const date = new Date(`${holiday.date}T00:00:00`);
  return {
    day: String(date.getDate()).padStart(2, "0"),
    weekday: new Intl.DateTimeFormat("en-IN", { weekday: "short" }).format(date),
    month: new Intl.DateTimeFormat("en-IN", { month: "short" }).format(date),
    monthIndex: date.getMonth(),
  };
}

function UpcomingHolidayItem({ holiday }: { holiday: CompanyHoliday }) {
  const date = holidayDateParts(holiday);
  const isLeave = holiday.type === "leave";

  return (
    <div className="border-ex-border bg-ex-surface/35 group flex min-w-0 items-center gap-3 rounded-xl border px-4 py-4">
      <div
        className={cn(
          "flex size-12 shrink-0 flex-col items-center justify-center rounded-xl",
          isLeave
            ? "border-ex-chip-info-border bg-ex-chip-info-bg text-ex-chip-info-fg"
            : "border-ex-chip-accent-border bg-ex-chip-accent-bg text-ex-chip-accent-fg",
        )}
      >
        <span className="text-base leading-none font-bold">{date.day}</span>
        <span className="mt-1 text-[10px] leading-none font-semibold uppercase">{date.month}</span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-ex-primary truncate text-sm font-semibold">{holiday.name}</p>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-ex-muted text-xs">{date.weekday}</span>
          <span className="text-ex-muted/50 text-xs">•</span>
          <span
            className={cn(
              "inline-flex items-center gap-1 text-xs font-medium",
              isLeave ? "text-ex-chip-info-fg" : "text-ex-chip-accent-fg",
            )}
          >
            {isLeave ? <CalendarDays className="size-3" /> : <Sparkles className="size-3" />}
            {isLeave ? "Company leave" : "Celebration"}
          </span>
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const canManageLeave = user ? canManageEmployees(user.role) : false;
  const [leaveDate, setLeaveDate] = useState(formatIsoDate());
  const [onLeave, setOnLeave] = useState<OnLeaveEmployee[]>([]);
  const [onLeaveLoading, setOnLeaveLoading] = useState(true);
  const [onLeaveError, setOnLeaveError] = useState<string | null>(null);
  const [companyHolidays, setCompanyHolidays] = useState<CompanyHoliday[]>(COMPANY_HOLIDAYS_2026);
  const holidayYear = 2026;
  const birthdayLeaveEmployees = onLeave.filter(
    (employee) => employee.leaveType.toLowerCase() === "birthday",
  );
  const otherLeaveEmployees = onLeave.filter(
    (employee) => employee.leaveType.toLowerCase() !== "birthday",
  );
  const upcomingHolidays = [...companyHolidays]
    .filter((holiday) => holiday.date >= formatIsoDate())
    .sort((left, right) => left.date.localeCompare(right.date));

  useEffect(() => {
    if (!user?.sheetRow) return;

    let cancelled = false;
    const onLeaveUrl = canManageLeave
      ? `/api/dashboard/on-leave?date=${encodeURIComponent(leaveDate)}`
      : "/api/dashboard/on-leave";
    void fetch(onLeaveUrl, {
      cache: "no-store",
    })
      .then(async (response) => {
        const data = (await response.json()) as {
          success?: boolean;
          message?: string;
          employees?: OnLeaveEmployee[];
        };
        if (!response.ok || !data.success) {
          throw new Error(data.message ?? "Failed to load employees on leave");
        }
        return data.employees ?? [];
      })
      .then((employees) => {
        if (cancelled) return;
        setOnLeave(employees);
        setOnLeaveError(null);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setOnLeave([]);
        setOnLeaveError(
          error instanceof Error ? error.message : "Failed to load employees on leave",
        );
      })
      .finally(() => {
        if (!cancelled) setOnLeaveLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [canManageLeave, leaveDate, user?.sheetRow]);

  useEffect(() => {
    let cancelled = false;
    void fetch(`/api/company-holidays?year=${holidayYear}`, { cache: "no-store" })
      .then(async (response) => {
        const data = (await response.json()) as {
          success?: boolean;
          holidays?: CompanyHoliday[];
        };
        if (!response.ok || !data.success) {
          throw new Error("Failed to load company holidays");
        }
        return data.holidays ?? [];
      })
      .then((holidays) => {
        if (!cancelled) setCompanyHolidays(holidays);
      })
      .catch(() => {
        // Keep the seeded holiday list when the remote sheet is temporarily unavailable.
      });

    return () => {
      cancelled = true;
    };
  }, [holidayYear]);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Executive Overview"
        description="Live signals across people, attendance, leave, and service requests. Data shown is sample scaffolding wired for charts and tables."
        actions={
          <>
            <Button variant="outline" size="sm">
              Export PDF
            </Button>
            <Button size="sm" variant="secondary">
              New report
            </Button>
          </>
        }
      />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {/* <StatCard label="Present today" value="94%" hint="vs. 30-day baseline" /> */}
        <StatCard
          label={canManageLeave && leaveDate !== formatIsoDate() ? "On leave" : "On leave today"}
          value={onLeaveLoading ? "…" : String(onLeave.length)}
          hint={displayDate(canManageLeave ? leaveDate : formatIsoDate())}
        />
        {/* <StatCard label="Pending approvals" value="7" hint="Leave + overtime" /> */}
        {/* <StatCard label="Open complaints" value="3" hint="SLA tracked in module" /> */}
      </section>

      <section className="grid gap-4 lg:grid-cols-3 lg:items-stretch">
        <Card className="flex h-full w-full flex-col overflow-hidden">
          <CardHeader className="bg-ex-surface/40 flex flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="bg-ex-accent/15 text-ex-accent flex size-10 items-center justify-center rounded-xl">
                <CalendarDays className="size-5" />
              </div>
              <div>
                <CardTitle>Upcoming holidays</CardTitle>
                <p className="text-ex-muted mt-0.5 text-sm">
                  Company leave days and celebrations coming next
                </p>
              </div>
            </div>
            {upcomingHolidays.length > 0 ? (
              <Badge variant="accent" className="shrink-0 whitespace-nowrap">
                {upcomingHolidays.length} upcoming
              </Badge>
            ) : null}
          </CardHeader>
          <CardContent className="flex flex-1 flex-col p-4">
            {upcomingHolidays.length === 0 ? (
              <div className="border-ex-border flex h-60 flex-col items-center justify-center rounded-xl border border-dashed px-5 text-center">
                <p className="text-ex-primary text-sm font-medium">No upcoming holidays</p>
                <p className="text-ex-muted mt-1 text-xs">
                  New company leave days and celebrations will appear here.
                </p>
              </div>
            ) : (
              <div className="h-60 space-y-3 overflow-y-auto pr-1">
                {upcomingHolidays.map((holiday) => (
                  <UpcomingHolidayItem key={holiday.id} holiday={holiday} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="flex h-full flex-col overflow-hidden lg:col-span-2">
          <CardHeader className="bg-ex-surface/40 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-ex-secondary/15 text-ex-secondary flex size-11 items-center justify-center rounded-xl text-lg font-semibold">
                {onLeaveLoading ? "…" : onLeave.length}
              </div>
              <div>
                <CardTitle>Employees on leave</CardTitle>
                <p className="text-ex-muted mt-1 text-sm">
                  {displayDate(canManageLeave ? leaveDate : formatIsoDate())}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {!onLeaveLoading ? (
                <>
                  <Badge variant={onLeave.length > 0 ? "warning" : "default"}>
                    {onLeave.length} on leave
                  </Badge>
                  {canManageLeave ? (
                    <Badge variant={birthdayLeaveEmployees.length > 0 ? "accent" : "default"}>
                      {birthdayLeaveEmployees.length} birthday
                    </Badge>
                  ) : null}
                </>
              ) : null}
              {canManageLeave ? (
                <Input
                  type="date"
                  value={leaveDate}
                  onChange={(event) => {
                    setOnLeaveLoading(true);
                    setLeaveDate(event.target.value);
                  }}
                  className="w-full sm:w-44"
                  aria-label="Select leave date"
                />
              ) : null}
            </div>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col p-5">
            {onLeaveError ? (
              <div className="flex h-60 items-center">
                <p className="w-full rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
                  {onLeaveError}
                </p>
              </div>
            ) : onLeaveLoading ? (
              <div className="grid h-60 gap-3 md:grid-cols-2 xl:grid-cols-3">
                {[0, 1, 2].map((item) => (
                  <div
                    key={item}
                    className="border-ex-border bg-ex-surface h-full min-h-32 animate-pulse rounded-xl border"
                  />
                ))}
              </div>
            ) : onLeave.length === 0 ? (
              <div className="border-ex-border bg-ex-surface/40 flex h-60 flex-col items-center justify-center rounded-xl border border-dashed px-6 text-center">
                <div className="bg-ex-elevated text-ex-muted mx-auto flex size-12 items-center justify-center rounded-full text-xl">
                  ✓
                </div>
                <p className="text-ex-primary mt-3 font-medium">Everyone is available</p>
                <p className="text-ex-muted mt-1 text-sm">
                  No accepted leave records for{" "}
                  {displayDate(canManageLeave ? leaveDate : formatIsoDate())}.
                </p>
              </div>
            ) : (
              <div className="h-60 space-y-6 overflow-y-auto pr-1">
                {birthdayLeaveEmployees.length > 0 ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-ex-primary font-semibold">Birthday leave</p>
                        <p className="text-ex-muted text-sm">
                          Employees celebrating their birthday
                        </p>
                      </div>
                      <Badge variant="accent">{birthdayLeaveEmployees.length}</Badge>
                    </div>
                    <div className="divide-ex-border border-ex-border divide-y overflow-hidden rounded-xl border">
                      {birthdayLeaveEmployees.map((employee) => (
                        <LeaveEmployeeCard
                          key={employee.id}
                          employee={employee}
                          birthday
                          showDetails={canManageLeave}
                        />
                      ))}
                    </div>
                  </div>
                ) : null}

                {otherLeaveEmployees.length > 0 ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-ex-primary font-semibold">
                          {canManageLeave ? "Other leave" : "On leave today"}
                        </p>
                        <p className="text-ex-muted text-sm">
                          {canManageLeave
                            ? "Paid, sick, casual, and unpaid leave"
                            : "Employees who are unavailable today"}
                        </p>
                      </div>
                      <Badge variant="default">{otherLeaveEmployees.length}</Badge>
                    </div>
                    <div className="divide-ex-border border-ex-border divide-y overflow-hidden rounded-xl border">
                      {otherLeaveEmployees.map((employee) => (
                        <LeaveEmployeeCard
                          key={employee.id}
                          employee={employee}
                          showDetails={canManageLeave}
                        />
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <AttendanceWidget />
        {/* <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Onboarding vs attrition</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={headcountTrend} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
                <defs>
                  <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--ex-secondary)" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="var(--ex-secondary)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="g2" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--ex-accent)" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="var(--ex-accent)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--ex-border)" vertical={false} />
                <XAxis dataKey="month" tickLine={false} axisLine={false} />
                <YAxis tickLine={false} axisLine={false} width={32} />
                <Tooltip
                  contentStyle={{
                    borderRadius: 12,
                    borderColor: "var(--ex-border)",
                    background: "var(--ex-elevated)",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="onboarded"
                  stroke="var(--ex-secondary)"
                  fill="url(#g1)"
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="attrition"
                  stroke="var(--ex-accent)"
                  fill="url(#g2)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card> */}

        {/* <Card>
          <CardHeader>
            <CardTitle>Leave mix (MTD)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {leaveMix.map((row) => (
              <div key={row.type} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-ex-muted">{row.type}</span>
                  <span className="text-ex-primary font-medium tabular-nums">{row.value}</span>
                </div>
                <div className="bg-ex-surface h-2 overflow-hidden rounded-full">
                  <div
                    className="bg-ex-secondary h-full rounded-full"
                    style={{ width: `${(row.value / leaveMax) * 100}%` }}
                  />
                </div>
              </div>
            ))}
            <p className="text-ex-muted pt-2 text-xs">
              Paid / sick / casual / unpaid flows include half-day and full-day with configurable
              approval chains.
            </p>
          </CardContent>
        </Card> */}
      </section>

      {/* <section>
        <Card>
          <CardHeader>
            <CardTitle>Approval queue</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <DataTable
              rows={approvals}
              columns={[
                { key: "item", header: "Item" },
                { key: "owner", header: "Routed to" },
                {
                  key: "status",
                  header: "Status",
                  render: (r) => <Badge variant="warning">{r.status}</Badge>,
                },
              ]}
            />
          </CardContent>
        </Card>
      </section> */}
    </div>
  );
}
