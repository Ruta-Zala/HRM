"use client";

import { PageHeader } from "@/components/ui/page-header";
import { DataTable } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const rows = [
  { id: "1", who: "Neha Kapoor", type: "Paid · half PM", chain: "Manager → HR", state: "Pending" },
  { id: "2", who: "Rahul Mehta", type: "Sick · full", chain: "HR", state: "Approved" },
];

export default function LeaveApprovalsPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        title="Approval chain"
        description="Paid, sick, casual, and unpaid flows can each define approvers, SLAs, and email + in-app notifications on approve/reject."
        actions={<Button variant="outline">Edit routing rules</Button>}
      />
      <DataTable
        rows={rows}
        columns={[
          { key: "who", header: "Employee" },
          { key: "type", header: "Request" },
          { key: "chain", header: "Chain" },
          {
            key: "state",
            header: "State",
            render: (r) => (
              <Badge variant={r.state === "Approved" ? "success" : "warning"}>{r.state}</Badge>
            ),
          },
        ]}
      />
    </div>
  );
}
