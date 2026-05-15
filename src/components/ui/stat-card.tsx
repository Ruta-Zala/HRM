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
        "rounded-xl border border-ex-border bg-ex-elevated p-4 shadow-sm dark:shadow-none",
        className,
      )}
    >
      <p className="text-xs font-medium uppercase tracking-wide text-ex-muted">{label}</p>
      <p className="mt-2 text-2xl font-semibold tabular-nums text-ex-primary">{value}</p>
      {hint ? <p className="mt-1 text-xs text-ex-muted">{hint}</p> : null}
    </div>
  );
}
