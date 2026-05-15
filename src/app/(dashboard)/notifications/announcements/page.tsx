"use client";

import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";

export default function AnnouncementsPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        title="Announcements & notices"
        description="Publish org-wide notices with scheduling, pinning, and optional Slack broadcast + email."
      />
      <Card>
        <CardHeader>
          <CardTitle>Compose</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2 md:col-span-2">
            <Label>Title</Label>
            <Input placeholder="Town hall recording, policy update…" />
          </div>
          <div className="space-y-2">
            <Label>Audience</Label>
            <Select defaultValue="all">
              <option value="all">Everyone</option>
              <option value="hq">HQ only</option>
              <option value="managers">Managers</option>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Publish at</Label>
            <Input type="datetime-local" />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Body</Label>
            <Textarea rows={6} />
          </div>
          <Button className="md:col-span-2 w-fit" variant="secondary">
            Schedule announcement
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
