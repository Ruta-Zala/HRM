"use client";

import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/data-table";

const punches = [
  { id: "1", day: "2026-05-14", in: "09:04", out: "18:12", note: "On site" },
  { id: "2", day: "2026-05-13", in: "09:22", out: "18:30", note: "Late start — approved" },
];

export default function PunchPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        title="Punch in / out"
        description="Geo/Wi‑Fi aware punches with audit trail. Pair with auto-absent rules when no punch is recorded by cut-off."
        actions={
          <>
            <Button variant="outline" size="sm">
              Request correction
            </Button>
            <Button size="sm" variant="secondary">
              Punch in now
            </Button>
          </>
        }
      />
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Today</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm text-ex-muted">Status</p>
            <Badge variant="success">Checked in · 09:04</Badge>
            <p className="pt-2 text-xs text-ex-muted">
              Slack optional: confirm punch via slash command for field teams.
            </p>
          </CardContent>
        </Card>
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Recent punches</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <DataTable
              rows={punches}
              columns={[
                { key: "day", header: "Date" },
                { key: "in", header: "In" },
                { key: "out", header: "Out" },
                { key: "note", header: "Note" },
              ]}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
