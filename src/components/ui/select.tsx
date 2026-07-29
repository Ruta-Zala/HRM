import { forwardRef, type SelectHTMLAttributes } from "react";
import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => (
    <div className={cn("relative w-full", className)}>
      <select
        ref={ref}
        className="border-ex-border bg-ex-bg text-ex-primary focus-visible:ring-ex-ring dark:bg-ex-surface h-10 w-full appearance-none rounded-lg border pr-10 pl-3 text-sm focus-visible:ring-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        className="text-ex-muted pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2"
        aria-hidden
      />
    </div>
  ),
);
Select.displayName = "Select";
