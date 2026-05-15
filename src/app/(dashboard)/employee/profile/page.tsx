"use client";

import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

export default function EmployeeProfilePage() {
  return (
    <div className="space-y-8">
      <PageHeader
        title="Employee profile & documents"
        description="Central record for statutory fields, education, guardians, experience, increments, and uploads. Wire uploads to Google Drive and attach signed PDFs."
        actions={
          <>
            <Button variant="outline" size="sm">
              Sync from Drive
            </Button>
            <Button size="sm" variant="secondary">
              Save changes
            </Button>
          </>
        }
      />
      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Core identity</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label>Full name</Label>
              <Input defaultValue="Neha Kapoor" />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Address</Label>
              <Textarea rows={3} defaultValue="221B Baker Street, Bengaluru" />
            </div>
            <div className="space-y-2">
              <Label>PAN</Label>
              <Input placeholder="AAAAA9999A" />
            </div>
            <div className="space-y-2">
              <Label>Aadhaar (masked)</Label>
              <Input placeholder="XXXX XXXX 4210" />
            </div>
            <div className="space-y-2">
              <Label>Birthday</Label>
              <Input type="date" />
            </div>
            <div className="space-y-2">
              <Label>Joining date</Label>
              <Input type="date" />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Input defaultValue="Senior Engineer" />
            </div>
            <div className="space-y-2">
              <Label>Last increment</Label>
              <Input type="month" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Family & education</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Parent / guardian</Label>
              <Input placeholder="Name & contact" />
            </div>
            <div className="space-y-2">
              <Label>Marksheet / degree upload</Label>
              <Input type="file" />
            </div>
            <div className="space-y-2">
              <Label>Prior experience summary</Label>
              <Textarea rows={4} placeholder="Companies, tenure, highlights" />
            </div>
            <div className="space-y-2">
              <Label>Tech skills</Label>
              <Textarea rows={4} placeholder="Next.js, Postgres, HR policies…" />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
