"use client";

import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";

const rows = [
  { id: "1", title: "Leave approved", channel: "Email + In-app", when: "Just now" },
  { id: "2", title: "Overtime pending", channel: "Slack DM", when: "09:12" },
  { id: "3", title: "Birthday · Neha", channel: "Slack #general", when: "Scheduled" },
];

export default function NotificationsPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        title="Notification center"
        description="Unified inbox for HR workflows. Pair with email transport and Slack webhooks configured under Integrations."
      />
      <Card>
        <CardHeader>
          <CardTitle>Latest</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <DataTable
            rows={rows}
            columns={[
              { key: "title", header: "Item" },
              {
                key: "channel",
                header: "Channel",
                render: (r) => <Badge variant="accent">{r.channel}</Badge>,
              },
              { key: "when", header: "When" },
            ]}
          />
        </CardContent>
      </Card>
    </div>
  );
}
