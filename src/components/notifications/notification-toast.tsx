"use client";

import Link from "next/link";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export type NotificationToastItem = {
  id: string;
  title: string;
  body: string;
  href?: string;
};

export function NotificationToastStack({
  items,
  onDismiss,
}: {
  items: NotificationToastItem[];
  onDismiss: (id: string) => void;
}) {
  if (items.length === 0) return null;

  return (
    <div className="pointer-events-none fixed top-4 right-4 z-[100] flex w-[min(100vw-2rem,24rem)] flex-col gap-2">
      {items.map((item) => (
        <div
          key={item.id}
          className={cn(
            "border-ex-border bg-ex-elevated pointer-events-auto rounded-xl border p-4 shadow-lg",
          )}
          role="status"
          aria-live="polite"
        >
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-ex-primary text-sm font-semibold">{item.title}</p>
              <p className="text-ex-muted mt-1 text-sm">{item.body}</p>
              {item.href ? (
                <Link
                  href={item.href}
                  className="text-ex-accent mt-2 inline-block text-sm font-medium hover:underline"
                  onClick={() => onDismiss(item.id)}
                >
                  View
                </Link>
              ) : null}
            </div>
            <button
              type="button"
              aria-label="Dismiss notification"
              onClick={() => onDismiss(item.id)}
              className="text-ex-muted hover:text-ex-primary shrink-0 rounded-md p-1 transition"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
