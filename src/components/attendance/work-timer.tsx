"use client";

import { formatDuration, formatDurationHms } from "@/lib/attendance/time";
import { IDEAL_BREAK_HOURS, IDEAL_WORKING_HOURS } from "@/lib/attendance/constants";
import { cn } from "@/lib/utils";

export function WorkTimer({
  workedMs,
  label = "Worked Today",
  showProgress = false,
  idealHours = IDEAL_WORKING_HOURS,
  mode = "work",
  breakAllowanceHours = IDEAL_BREAK_HOURS,
  /** When set, ring progress uses this instead of `workedMs` (e.g. total break used). */
  progressMs,
  className,
}: {
  workedMs: number;
  label?: string;
  showProgress?: boolean;
  idealHours?: number;
  /** `break` shows elapsed break time toward the daily break allowance. */
  mode?: "work" | "break";
  breakAllowanceHours?: number;
  progressMs?: number;
  className?: string;
}) {
  const isBreak = mode === "break";
  const targetHours = isBreak ? breakAllowanceHours : idealHours;
  const idealMs = targetHours * 60 * 60 * 1000;
  const ringMs = progressMs ?? workedMs;
  const progress = Math.min(100, (ringMs / idealMs) * 100);
  const remainingMs = Math.max(0, idealMs - ringMs);
  const displayLabel = isBreak ? (label === "Worked Today" ? "On Break" : label) : label;

  if (!showProgress) {
    return (
      <div className={cn("border-ex-border bg-ex-surface rounded-lg border px-4 py-3", className)}>
        <p className="text-ex-muted text-xs font-medium tracking-wide uppercase">{displayLabel}</p>
        <p className="text-ex-primary mt-1 font-mono text-2xl font-semibold tabular-nums">
          {formatDurationHms(workedMs)}
        </p>
      </div>
    );
  }

  const circumference = 2 * Math.PI * 54;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  return (
    <div className={cn("flex flex-col items-center", className)}>
      <div className="relative size-40">
        <svg className="size-full -rotate-90" viewBox="0 0 120 120" aria-hidden>
          <circle
            cx="60"
            cy="60"
            r="54"
            fill="none"
            stroke="currentColor"
            strokeWidth="8"
            className="text-ex-border"
          />
          <circle
            cx="60"
            cy="60"
            r="54"
            fill="none"
            stroke="currentColor"
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            className={cn(
              "transition-[stroke-dashoffset] duration-1000 ease-out",
              isBreak ? "text-amber-500 dark:text-amber-400" : "text-ex-secondary",
            )}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <p className="text-ex-muted text-[10px] font-semibold tracking-wider uppercase">
            {displayLabel}
          </p>
          <p className="text-ex-primary mt-0.5 font-mono text-lg font-bold tabular-nums">
            {formatDurationHms(workedMs)}
          </p>
          <p className="text-ex-muted mt-1 text-[11px]">
            {isBreak
              ? progress >= 100
                ? `${targetHours}h break used`
                : `${formatDuration(remainingMs)} break left`
              : progress >= 100
                ? `${idealHours}h work done`
                : `${formatDuration(remainingMs)} work left`}
          </p>
          {!isBreak ? (
            <p className="text-ex-muted/80 text-[10px]">
              +{IDEAL_BREAK_HOURS}h break · {idealHours + IDEAL_BREAK_HOURS}h day
            </p>
          ) : (
            <p className="text-ex-muted/80 text-[10px]">
              of {breakAllowanceHours}h break allowance
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
