"use client";

import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";

const tasks = [
  { id: "1", title: "Payroll reconciliation", hours: "3h", status: "Done" },
  { id: "2", title: "Policy doc refresh", hours: "2h", status: "In progress" },
];

export default function DailyTasksPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        title="Daily task input"
        description="Lightweight timesheet-style capture for ICs. Roll up to utilization dashboards."
        actions={<Button size="sm">Add task</Button>}
      />
      <Card>
        <CardHeader>
          <CardTitle>Today&apos;s log</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <Label>What did you work on?</Label>
            <Textarea placeholder="Bullet tasks, meetings, deep work blocks…" />
          </div>
          <Button variant="secondary">Submit day log</Button>
        </CardContent>
      </Card>
      <DataTable
        rows={tasks}
        columns={[
          { key: "title", header: "Task" },
          { key: "hours", header: "Effort" },
          { key: "status", header: "Status" },
        ]}
      />
    </div>
  );
}
