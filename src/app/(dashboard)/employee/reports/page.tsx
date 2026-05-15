"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const utilization = [
  { squad: "Core HR", delivery: 82, ops: 64 },
  { squad: "Payroll", delivery: 74, ops: 58 },
  { squad: "Eng", delivery: 88, ops: 40 },
];

export default function ReportsPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        title="Custom reports & charts"
        description="Composable metrics for leadership reviews. Export to Excel via Drive-backed templates."
        actions={
          <>
            <Button variant="outline" size="sm">
              Schedule email
            </Button>
            <Button size="sm" variant="secondary">
              Build report
            </Button>
          </>
        }
      />
      <Card>
        <CardHeader>
          <CardTitle>Delivery vs operations load</CardTitle>
        </CardHeader>
        <CardContent className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={utilization} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--ex-border)" vertical={false} />
              <XAxis dataKey="squad" tickLine={false} axisLine={false} />
              <YAxis tickLine={false} axisLine={false} width={36} />
              <Tooltip
                contentStyle={{
                  borderRadius: 12,
                  borderColor: "var(--ex-border)",
                  background: "var(--ex-elevated)",
                }}
              />
              <Legend />
              <Bar dataKey="delivery" fill="var(--ex-secondary)" radius={[6, 6, 0, 0]} />
              <Bar dataKey="ops" fill="var(--ex-accent)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
