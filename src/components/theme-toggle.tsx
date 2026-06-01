"use client";

import { Button } from "@/components/ui/button";

/** Theme toggle placeholder — full toggle UI is disabled until hydration-safe wiring is restored. */
export function ThemeToggle() {
  return (
    <Button variant="ghost" size="sm" className="h-9 w-9 p-0" aria-label="Theme">
      <span className="size-4" />
    </Button>
  );
}
