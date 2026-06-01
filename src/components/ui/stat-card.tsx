import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  hint,
  className,
}: {
  label: string;
  value: string;
  hint?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "border-ex-border bg-ex-elevated hover:border-ex-secondary/20 rounded-xl border p-4 shadow-sm transition dark:shadow-none",
        className,
      )}
    >
      <p className="text-ex-muted text-xs font-medium tracking-wide uppercase">{label}</p>
      <p className="text-ex-primary mt-2 text-2xl font-semibold tabular-nums">{value}</p>
      {hint ? <p className="text-ex-muted mt-1 text-xs">{hint}</p> : null}
    </div>
  );
}
