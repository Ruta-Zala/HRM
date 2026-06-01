import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type = "text", ...props }, ref) => (
    <input
      ref={ref}
      type={type}
      className={cn(
        "border-ex-border bg-ex-bg placeholder:text-ex-muted focus-visible:ring-ex-ring dark:bg-ex-surface flex h-10 w-full rounded-lg border px-3 text-sm shadow-inner focus-visible:ring-2 focus-visible:outline-none",
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = "Input";
