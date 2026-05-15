"use client";

import { Pie, PieChart, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";

const split = [
  { name: "Working", value: 182 },
  { name: "On leave", value: 14 },
  { name: "WFH", value: 36 },
];

const COLORS = [
  "var(--ex-secondary)",
  "var(--ex-accent)",
  "var(--ex-chart-4)",
];

export default function LeaveDashboardPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        title="Working vs on-leave"
        description="Live workforce posture for shift planning. Pulls from approved leave + punch presence."
      />
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="In office" value="182" hint="Badge scans + Wi‑Fi" />
        <StatCard label="On approved leave" value="14" />
        <StatCard label="WFH" value="36" />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Today&apos;s distribution</CardTitle>
        </CardHeader>
        <CardContent className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={split} dataKey="value" nameKey="name" innerRadius={60} outerRadius={100}>
                {split.map((_, index) => (
                  <Cell key={String(index)} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  borderRadius: 12,
                  borderColor: "var(--ex-border)",
                  background: "var(--ex-elevated)",
                }}
              />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
