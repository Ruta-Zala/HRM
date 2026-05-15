"use client";

import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

export default function LeaveDeskPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        title="Leave desk"
        description="Apply for paid, sick, casual, or unpaid leave with half-day or full-day options. Pending vs used balances update in real time after approvals."
        actions={<Button size="sm">New request</Button>}
      />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Composer</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Leave type</Label>
              <Select defaultValue="paid">
                <option value="paid">Paid</option>
                <option value="sick">Sick</option>
                <option value="casual">Casual</option>
                <option value="unpaid">Unpaid</option>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Duration</Label>
              <Select defaultValue="full">
                <option value="full">Full day</option>
                <option value="half_am">Half day · morning</option>
                <option value="half_pm">Half day · afternoon</option>
              </Select>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Reason</Label>
              <Textarea rows={3} placeholder="Context for approvers" />
            </div>
            <Button className="sm:col-span-2 w-fit" variant="secondary">
              Submit for approval
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Balances</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-ex-muted">Pending</span>
              <Badge>3.5 days</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-ex-muted">Used (YTD)</span>
              <Badge variant="accent">11 days</Badge>
            </div>
            <p className="text-xs text-ex-muted">
              Auto-absent: if no punch by configured cut-off, attendance marks absent unless leave is
              approved for that window.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
