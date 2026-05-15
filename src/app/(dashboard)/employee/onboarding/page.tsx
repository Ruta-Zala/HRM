"use client";

import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";

export default function OnboardingPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        title="Onboarding & offboarding"
        description="Checklists, asset assignments, and exit interviews. Hook these steps to Google Drive document packs and Slack channels."
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>New hire checklist</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <Label>Candidate / employee name</Label>
              <Input placeholder="Full legal name" />
            </div>
            <div className="space-y-2">
              <Label>Joining date</Label>
              <Input type="date" />
            </div>
            <div className="space-y-2">
              <Label>Role & department</Label>
              <Input placeholder="e.g. Analyst — Finance" />
            </div>
            <div className="space-y-2">
              <Label>Notes for HR</Label>
              <Textarea placeholder="Equipment, access, induction calendar…" />
            </div>
            <Button className="w-full sm:w-auto">Save draft</Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Offboarding</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <Label>Employee</Label>
              <Select defaultValue="">
                <option value="" disabled>
                  Select employee
                </option>
                <option>Neha Kapoor</option>
                <option>Rahul Mehta</option>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Last working day</Label>
              <Input type="date" />
            </div>
            <div className="space-y-2">
              <Label>Reason</Label>
              <Select defaultValue="voluntary">
                <option value="voluntary">Voluntary</option>
                <option value="performance">Performance</option>
                <option value="restructure">Restructure</option>
              </Select>
            </div>
            <Button variant="outline" className="w-full sm:w-auto">
              Generate clearance PDF
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
