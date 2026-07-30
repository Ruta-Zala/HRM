import { cn } from "@/lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("bg-ex-border/60 animate-pulse rounded-full", className)} />;
}

const DEFAULT_TABLE_SKELETON_COLS = 5;
const DEFAULT_TABLE_SKELETON_ROWS = 6;
const SKELETON_CELL_WIDTHS = ["w-24", "w-32", "w-20", "w-28", "w-24", "w-28", "w-20"] as const;

export function TableSkeleton({
  columnCount = DEFAULT_TABLE_SKELETON_COLS,
  rowCount = DEFAULT_TABLE_SKELETON_ROWS,
  className,
}: {
  columnCount?: number;
  rowCount?: number;
  className?: string;
} = {}) {
  const cols = Math.max(1, columnCount);

  return (
    <div
      className={cn(
        "border-ex-border bg-ex-elevated overflow-hidden rounded-xl border shadow-sm dark:shadow-none",
        className,
      )}
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="bg-ex-surface">
            <tr>
              {Array.from({ length: cols }).map((_, colIndex) => (
                <th key={colIndex} className="px-4 py-3">
                  <Skeleton className="h-3 w-16" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-ex-border divide-y">
            {Array.from({ length: rowCount }).map((_, rowIndex) => (
              <tr key={rowIndex}>
                {Array.from({ length: cols }).map((_, colIndex) => (
                  <td key={colIndex} className="px-4 py-3">
                    <Skeleton
                      className={cn(
                        "h-4",
                        SKELETON_CELL_WIDTHS[colIndex % SKELETON_CELL_WIDTHS.length],
                      )}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
