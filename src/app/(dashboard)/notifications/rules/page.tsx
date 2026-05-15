"use client";

import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function NotificationRulesPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        title="Automation rules"
        description="Leave reminders two days before start, birthday posts, increment reminders one month prior, and approval outcomes."
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle>Leave reminders</CardTitle>
            <Badge variant="success">On</Badge>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <Label>Lead time (days)</Label>
              <Input type="number" defaultValue={2} min={0} />
            </div>
            <p className="text-xs text-ex-muted">
              Sends in-app + email. Optional Slack DM via bot token.
            </p>
            <Button variant="outline" size="sm">
              Save
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle>Increment reminders</CardTitle>
            <Badge variant="success">On</Badge>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <Label>Lead time (months)</Label>
              <Input type="number" defaultValue={1} min={0} step={0.5} />
            </div>
            <p className="text-xs text-ex-muted">
              Surfaces to HR calendar and notifies employee manager thread in Slack.
            </p>
            <Button variant="outline" size="sm">
              Save
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle>Birthday notifications</CardTitle>
            <Badge variant="success">On</Badge>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-ex-muted">
            Daily cron posts celebratory card to <code>#social</code> with privacy opt-out per
            employee.
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle>Leave approve / reject</CardTitle>
            <Badge variant="success">On</Badge>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-ex-muted">
            Dual write: transactional email + mirrored in-app notification with deep link back to
            Leave desk.
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
