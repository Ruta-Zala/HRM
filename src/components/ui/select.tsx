import { forwardRef, type SelectHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export const Select = forwardRef<
  HTMLSelectElement,
  SelectHTMLAttributes<HTMLSelectElement>
>(({ className, children, ...props }, ref) => (
  <select
    ref={ref}
    className={cn(
      "flex h-10 w-full rounded-lg border border-ex-border bg-ex-bg px-3 text-sm text-ex-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ex-ring dark:bg-ex-surface",
      className,
    )}
    {...props}
  >
    {children}
  </select>
));
Select.displayName = "Select";
