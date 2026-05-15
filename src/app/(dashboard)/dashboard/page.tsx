"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const headcountTrend = [
  { month: "Jan", onboarded: 4, attrition: 1 },
  { month: "Feb", onboarded: 2, attrition: 0 },
  { month: "Mar", onboarded: 5, attrition: 2 },
  { month: "Apr", onboarded: 3, attrition: 1 },
  { month: "May", onboarded: 6, attrition: 1 },
  { month: "Jun", onboarded: 4, attrition: 0 },
];

const leaveMix = [
  { type: "Paid", value: 42 },
  { type: "Sick", value: 18 },
  { type: "Casual", value: 28 },
  { type: "Unpaid", value: 6 },
];
const leaveMax = Math.max(...leaveMix.map((r) => r.value), 1);

const approvals = [
  { id: "1", item: "Overtime — Neha Kapoor", owner: "HR queue", status: "Pending" },
  { id: "2", item: "Leave — Rahul Mehta", owner: "Manager", status: "Pending" },
  { id: "3", item: "Complaint — Floor 3 AC", owner: "Facilities", status: "In review" },
];

export default function DashboardPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        title="Executive overview"
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
        <StatCard label="Present today" value="94%" hint="vs. 30-day baseline" />
        <StatCard label="On leave today" value="12" hint="Visible org-wide per policy" />
        <StatCard label="Pending approvals" value="7" hint="Leave + overtime" />
        <StatCard label="Open complaints" value="3" hint="SLA tracked in module" />
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
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
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Leave mix (MTD)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {leaveMix.map((row) => (
              <div key={row.type} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-ex-muted">{row.type}</span>
                  <span className="font-medium tabular-nums text-ex-primary">{row.value}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-ex-surface">
                  <div
                    className="h-full rounded-full bg-ex-secondary"
                    style={{ width: `${(row.value / leaveMax) * 100}%` }}
                  />
                </div>
              </div>
            ))}
            <p className="pt-2 text-xs text-ex-muted">
              Paid / sick / casual / unpaid flows include half-day and full-day with configurable
              approval chains.
            </p>
          </CardContent>
        </Card>
      </section>

      <section>
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
      </section>
    </div>
  );
}
