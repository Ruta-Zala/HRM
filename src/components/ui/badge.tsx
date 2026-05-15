import { cn } from "@/lib/utils";

const variants = {
  default: "bg-ex-surface text-ex-primary border border-ex-border",
  success: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30",
  warning: "bg-amber-500/15 text-amber-800 dark:text-amber-200 border border-amber-500/30",
  danger: "bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30",
  accent: "bg-ex-accent/20 text-ex-primary border border-ex-accent/40",
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
