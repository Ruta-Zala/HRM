"use client";

import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";

const rows = Array.from({ length: 6 }).map((_, i) => ({
  id: String(i + 1),
  date: `2026-05-${10 + i}`,
  status: i % 4 === 0 ? "Leave" : i % 5 === 0 ? "WFH" : "Present",
  hours: i % 4 === 0 ? "0" : "8.5",
}));

export default function AttendanceMonthlyPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        title="Monthly attendance report"
        description="Reconciles punch data, approved leave, and auto-absent marks. HR can drill into exceptions."
      />
      <Card>
        <CardHeader>
          <CardTitle>May 2026 · Neha Kapoor</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <DataTable
            rows={rows}
            columns={[
              { key: "date", header: "Date" },
              {
                key: "status",
                header: "Status",
                render: (r) => (
                  <Badge
                    variant={
                      r.status === "Present"
                        ? "success"
                        : r.status === "Leave"
                          ? "warning"
                          : "default"
                    }
                  >
                    {r.status}
                  </Badge>
                ),
              },
              { key: "hours", header: "Recorded hours" },
            ]}
          />
        </CardContent>
      </Card>
    </div>
  );
}
