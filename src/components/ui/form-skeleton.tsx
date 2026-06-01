import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type FormSkeletonProps = {
  /** Visible loading message for screen readers. */
  label?: string;
  /** Skeleton field count inside the card. */
  fields?: number;
  /** Grid columns on sm+ breakpoints. */
  columns?: 1 | 2;
  /** Show skeleton action buttons below the card. */
  showActions?: boolean;
  /** Show skeleton card title. */
  showTitle?: boolean;
  className?: string;
};

function FieldSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("space-y-2", className)}>
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-10 w-full rounded-lg" />
    </div>
  );
}

export function FormSkeleton({
  label = "Loading form…",
  fields = 6,
  columns = 2,
  showActions = true,
  showTitle = true,
  className,
}: FormSkeletonProps) {
  return (
    <div role="status" aria-busy="true" aria-label={label} className={cn("space-y-4", className)}>
      <span className="sr-only">{label}</span>

      <Card>
        {showTitle ? (
          <CardHeader>
            <Skeleton className="h-5 w-40" />
          </CardHeader>
        ) : null}
        <CardContent>
          <div className={cn("grid gap-4", columns === 2 && "sm:grid-cols-2")}>
            {Array.from({ length: fields }).map((_, index) => (
              <FieldSkeleton key={index} />
            ))}
          </div>
        </CardContent>
      </Card>

      {showActions ? (
        <div className="flex flex-wrap gap-2">
          <Skeleton className="h-10 w-32 rounded-lg" />
          <Skeleton className="h-10 w-24 rounded-lg" />
        </div>
      ) : null}
    </div>
  );
}
