import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type = "text", ...props }, ref) => (
    <input
      ref={ref}
      type={type}
      className={cn(
        "flex h-10 w-full rounded-lg border border-ex-border bg-ex-bg px-3 text-sm shadow-inner placeholder:text-ex-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ex-ring dark:bg-ex-surface",
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = "Input";
