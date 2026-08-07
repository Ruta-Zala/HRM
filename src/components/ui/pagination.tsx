import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { SheetPagination } from "@/types/sheet";

export const DEFAULT_PAGE_SIZE = 10;

export function Pagination({
  pagination,
  onPageChange,
  className,
  itemLabel = "employees",
}: {
  pagination: SheetPagination;
  onPageChange: (page: number) => void;
  className?: string;
  itemLabel?: string;
}) {
  const { page, totalPages, total, pageSize = DEFAULT_PAGE_SIZE } = pagination;

  if (totalPages <= 1 && total <= pageSize) return null;

  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  const pages = getPageNumbers(page, totalPages);

  return (
    <div
      className={cn(
        "border-ex-border flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
    >
      <p className="text-ex-muted text-center text-sm sm:text-left">
        {total === 0 ? "No records" : `Showing ${start}–${end} of ${total} ${itemLabel}`}
      </p>

      <div className="flex flex-wrap items-center justify-center gap-1">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPageChange(1)}
          aria-label="First page"
          className="px-2"
        >
          <ChevronsLeft className="size-4" />
        </Button>

        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          aria-label="Previous page"
          className="px-2 sm:px-3"
        >
          <ChevronLeft className="size-4" />
          <span className="hidden sm:inline">Previous</span>
        </Button>

        <div className="flex items-center gap-0.5 sm:gap-1">
          {pages.map((p, i) =>
            p === "…" ? (
              <span
                key={`ellipsis-${i}`}
                className="text-ex-muted inline-flex h-8 min-w-7 items-center justify-center px-1 text-sm sm:min-w-8 sm:px-2"
                aria-hidden
              >
                …
              </span>
            ) : (
              <button
                key={p}
                type="button"
                onClick={() => onPageChange(p)}
                className={cn(
                  "inline-flex h-8 min-w-7 cursor-pointer items-center justify-center rounded-lg px-1.5 text-sm font-medium transition sm:min-w-8 sm:px-2",
                  p === page
                    ? "bg-ex-secondary text-white"
                    : "text-ex-muted hover:bg-ex-surface hover:text-ex-primary",
                )}
                aria-label={`Page ${p}`}
                aria-current={p === page ? "page" : undefined}
              >
                {p}
              </button>
            ),
          )}
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          aria-label="Next page"
          className="px-2 sm:px-3"
        >
          <span className="hidden sm:inline">Next</span>
          <ChevronRight className="size-4" />
        </Button>

        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={page >= totalPages}
          onClick={() => onPageChange(totalPages)}
          aria-label="Last page"
          className="px-2"
        >
          <ChevronsRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}

function getPageNumbers(current: number, total: number): (number | "…")[] {
  if (total <= 0) return [];
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  const selected = new Set<number>([1, total, current]);

  if (current - 1 > 1) selected.add(current - 1);
  if (current + 1 < total) selected.add(current + 1);

  if (current <= 2) {
    selected.add(2);
    selected.add(3);
  }
  if (current >= total - 1) {
    selected.add(total - 1);
    selected.add(total - 2);
  }

  const sorted = [...selected].filter((n) => n >= 1 && n <= total).sort((a, b) => a - b);

  const result: (number | "…")[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const n = sorted[i]!;
    if (i > 0 && n - sorted[i - 1]! > 1) {
      result.push("…");
    }
    result.push(n);
  }
  return result;
}
