import { forwardRef, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      "min-h-[100px] w-full rounded-lg border border-ex-border bg-ex-bg px-3 py-2 text-sm text-ex-primary placeholder:text-ex-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ex-ring dark:bg-ex-surface",
      className,
    )}
    {...props}
  />
));
Textarea.displayName = "Textarea";
