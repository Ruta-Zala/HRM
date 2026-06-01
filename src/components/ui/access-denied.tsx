import type { ReactNode } from "react";
import { ShieldX } from "lucide-react";
import { cn } from "@/lib/utils";

export function AccessDenied({
  title = "You cannot access this page",
  description = "You do not have permission to view this content. Contact your administrator if you believe this is a mistake.",
  action,
  className,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn(
        "border-ex-border bg-ex-elevated flex flex-col items-center justify-center rounded-xl border border-dashed px-6 py-16 text-center shadow-sm dark:shadow-none",
        className,
      )}
    >
      <div
        className="bg-ex-surface ring-ex-border mb-4 flex size-14 items-center justify-center rounded-full ring-1"
        aria-hidden
      >
        <ShieldX className="text-ex-muted size-6" />
      </div>
      <h3 className="text-ex-primary text-sm font-semibold">{title}</h3>
      <p className="text-ex-muted mt-1.5 max-w-md text-sm leading-relaxed">{description}</p>
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}
