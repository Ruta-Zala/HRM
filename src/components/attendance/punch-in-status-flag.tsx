"use client";

import Link from "next/link";
import { LogIn } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { useTodayAttendance } from "@/hooks/use-today-attendance";
import { cn } from "@/lib/utils";

export function PunchInBanner({ className }: { className?: string }) {
  return (
    <div
      role="status"
      className={cn(
        "flex items-start gap-3 rounded-xl border border-amber-200/90 bg-amber-50 px-4 py-3 dark:border-amber-800/60 dark:bg-amber-950/40",
        className,
      )}
    >
      <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/50">
        <LogIn className="size-4 text-amber-700 dark:text-amber-300" aria-hidden />
      </div>
      <div className="min-w-0 flex-1 space-y-1">
        <p className="text-sm font-semibold text-amber-950 dark:text-amber-50">Punch in not done</p>
        <p className="text-sm leading-relaxed text-amber-900/85 dark:text-amber-100/85">
          You haven&apos;t punched in for today yet. Start your day to begin tracking work hours.
        </p>
        <Link
          href="/employee/punch"
          className="inline-flex text-sm font-medium text-amber-800 underline-offset-2 hover:underline dark:text-amber-200"
        >
          Go to punch desk
        </Link>
      </div>
    </div>
  );
}

export function PunchInStatusFlag({
  variant = "chip",
  className,
}: {
  variant?: "chip" | "banner";
  className?: string;
}) {
  const { today, loading } = useTodayAttendance();

  if (loading || today?.hasPunchedIn) return null;

  if (variant === "banner") {
    return <PunchInBanner className={className} />;
  }

  return (
    <Link href="/employee/punch" className={cn("shrink-0", className)}>
      <Badge variant="warning" className="gap-1.5 px-2.5 py-1">
        <LogIn className="size-3.5" aria-hidden />
        Punch in pending
      </Badge>
    </Link>
  );
}
