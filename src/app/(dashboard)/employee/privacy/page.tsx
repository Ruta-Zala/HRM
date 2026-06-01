"use client";

import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/data-table";

const today = [
  { id: "1", name: "Rahul Mehta", kind: "Sick leave" },
  { id: "2", name: "Asha Verma", kind: "Casual" },
];

export default function PrivacyLeavesPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        title="Leave visibility & privacy"
        description="Other users cannot see applied or historical leave details beyond their scope. Everyone can see who is on leave today for coordination."
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Who is on leave today</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <DataTable
              rows={today}
              columns={[
                { key: "name", header: "Colleague" },
                {
                  key: "kind",
                  header: "Leave type",
                  render: (r) => <Badge variant="accent">{r.kind}</Badge>,
                },
              ]}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Privacy controls</CardTitle>
          </CardHeader>
          <CardContent className="text-ex-muted space-y-3 text-sm">
            <p>
              <strong className="text-ex-primary">Hidden from peers:</strong> future dated leave,
              half-day details, medical notes, and approval chain comments.
            </p>
            <p>
              <strong className="text-ex-primary">Visible to HR / Super Admin:</strong> full audit
              including attachments and conversation history.
            </p>
            <p>
              <strong className="text-ex-primary">Automation:</strong> daily digest posts only
              anonymized counts to managers unless policy marks a team as transparent.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
