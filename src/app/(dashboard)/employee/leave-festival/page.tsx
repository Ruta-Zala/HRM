"use client";

import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";

const festivals = [
  { id: "1", name: "Independence Day", date: "2026-08-15", type: "National" },
  { id: "2", name: "Diwali", date: "2026-11-08", type: "Company holiday" },
];

const leaveTypes = [
  { id: "1", name: "Annual recharge", balance: "12 days", policy: "Use-it-or-lose-it by Mar" },
  { id: "2", name: "Casual", balance: "6 days", policy: "1-day notice" },
];

export default function LeaveFestivalPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        title="Leave & festival calendar"
        description="Single source of truth for holidays and leave policies. Feeds notification reminders."
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Festivals & holidays</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <DataTable
              rows={festivals}
              columns={[
                { key: "name", header: "Name" },
                { key: "date", header: "Date" },
                { key: "type", header: "Type" },
              ]}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Leave buckets</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <DataTable
              rows={leaveTypes}
              columns={[
                { key: "name", header: "Program" },
                { key: "balance", header: "Balance" },
                { key: "policy", header: "Policy" },
              ]}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
