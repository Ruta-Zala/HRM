import Link from "next/link";
import type { ComponentType } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

/** Document/letter type tile — the "pick a type" step shown before any form. */
export function DocumentTypeCard({
  title,
  description,
  href,
  icon: Icon,
}: {
  title: string;
  description: string;
  href: string;
  icon: ComponentType<{ className?: string }>;
}) {
  return (
    <Card className="flex flex-col">
      <CardHeader>
        <div className="bg-ex-secondary/10 text-ex-secondary mb-2 flex size-9 items-center justify-center rounded-lg">
          <Icon className="size-5" />
        </div>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col justify-between gap-4">
        <p className="text-ex-muted text-sm">{description}</p>
        <Link href={href}>
          <Button variant="outline" size="sm" type="button">
            Open
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}
