"use client";

import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";

const rows = [
  { id: "1", who: "Neha Kapoor", leftAt: "16:10", policy: "Manager approval", state: "Pending" },
  { id: "2", who: "Asha Verma", leftAt: "15:45", policy: "Auto-approved", state: "OK" },
];

export default function EarlyLeavePage() {
  return (
    <div className="space-y-8">
      <PageHeader
        title="Early leave tracking"
        description="Capture early departures, correlate with punch data, and route exceptions to HR."
      />
      <Card>
        <CardHeader>
          <CardTitle>This week</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <DataTable
            rows={rows}
            columns={[
              { key: "who", header: "Employee" },
              { key: "leftAt", header: "Left office" },
              { key: "policy", header: "Policy" },
              {
                key: "state",
                header: "State",
                render: (r) => (
                  <Badge variant={r.state === "OK" ? "success" : "warning"}>{r.state}</Badge>
                ),
              },
            ]}
          />
        </CardContent>
      </Card>
    </div>
  );
}
