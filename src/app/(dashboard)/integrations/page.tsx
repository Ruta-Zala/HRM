"use client";

import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const links = [
  {
    title: "Google Drive",
    desc: "Connect personal Gmail for document uploads (required for My Drive).",
    href: "/integrations/google-drive",
  },
  {
    title: "Slack",
    desc: "Bot token for approvals, announcements, and optional profile photo capture.",
    href: "/integrations/slack",
  },
  {
    title: "Media uploads",
    desc: "S3-compatible or Drive-backed storage for marksheets, IDs, and avatars.",
    href: "/integrations/media",
  },
];

export default function IntegrationsHubPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        title="Integrations"
        description="Wire Exhibyte HRM to Drive, Slack, and object storage. Keys stay server-side via environment variables."
      />
      <div className="grid gap-4 md:grid-cols-3">
        {links.map((l) => (
          <Card key={l.href} className="flex flex-col">
            <CardHeader>
              <CardTitle className="text-base">{l.title}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col justify-between gap-4">
              <p className="text-ex-muted text-sm">{l.desc}</p>
              <Link href={l.href}>
                <Button variant="outline" size="sm" type="button">
                  Open
                </Button>
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
