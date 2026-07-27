import { cn } from "@/lib/utils";

const variants = {
  default: "bg-ex-surface text-ex-primary border border-ex-border",
  success: "border border-ex-chip-success-border bg-ex-chip-success-bg text-ex-chip-success-fg",
  warning: "border border-ex-chip-warning-border bg-ex-chip-warning-bg text-ex-chip-warning-fg",
  danger: "border border-ex-chip-danger-border bg-ex-chip-danger-bg text-ex-chip-danger-fg",
  accent: "border border-ex-chip-accent-border bg-ex-chip-accent-bg text-ex-chip-accent-fg",
};

export function Badge({
  className,
  variant = "default",
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { variant?: keyof typeof variants }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium",
        variants[variant],
        className,
      )}
      {...props}
    />
  );
}
