"use client";

import { cn } from "@/lib/utils";

export function UnreadBadge({ count, className }: { count: number; className?: string }) {
  if (count <= 0) return null;

  const label = count > 99 ? "99+" : String(count);

  return (
    <span
      className={cn(
        "bg-ex-secondary inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] leading-none font-semibold text-white",
        className,
      )}
      aria-label={`${count} unread notifications`}
    >
      {label}
    </span>
  );
}
