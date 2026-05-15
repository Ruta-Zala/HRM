"use client";

import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const rows = [
  { id: "1", who: "Neha Kapoor", hours: "3h", approver: "Manager", state: "Pending" },
  { id: "2", who: "Rahul Mehta", hours: "1.5h", approver: "HR", state: "Approved" },
];

export default function OvertimePage() {
  return (
    <div className="space-y-8">
      <PageHeader
        title="Overtime approvals"
        description="Configurable approval chain (manager → HR → finance). Notifications fire on submit and decision."
        actions={<Button size="sm">Log overtime</Button>}
      />
      <Card>
        <CardHeader>
          <CardTitle>Queue</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <DataTable
            rows={rows}
            columns={[
              { key: "who", header: "Employee" },
              { key: "hours", header: "OT" },
              { key: "approver", header: "Next approver" },
              {
                key: "state",
                header: "State",
                render: (r) => (
                  <Badge variant={r.state === "Approved" ? "success" : "warning"}>{r.state}</Badge>
                ),
              },
            ]}
          />
        </CardContent>
      </Card>
    </div>
  );
}
