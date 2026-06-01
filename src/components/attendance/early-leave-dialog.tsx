"use client";

import { Loader2, LogOut } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { EARLY_LEAVE_REASON_MIN_LENGTH } from "@/lib/attendance/constants";
import { formatDuration } from "@/lib/attendance/time";

const QUICK_REASONS = [
  "Personal appointment",
  "Not feeling well",
  "Family emergency",
  "Approved early leave",
] as const;

export function EarlyLeaveDialog({
  open,
  shortfallMs,
  requireEarlyLeaveReason,
  initialDailyUpdate,
  submitting,
  error,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  shortfallMs: number;
  requireEarlyLeaveReason: boolean;
  initialDailyUpdate?: string;
  submitting?: boolean;
  error?: string | null;
  onConfirm: (payload: { earlyLeaveReason?: string; dailyUpdate: string }) => void;
  onCancel: () => void;
}) {
  const [reason, setReason] = useState("");
  const [dailyUpdate, setDailyUpdate] = useState(initialDailyUpdate ?? "");

  if (!open) return null;

  const trimmed = reason.trim();
  const trimmedDailyUpdate = dailyUpdate.trim();
  const tooShort =
    requireEarlyLeaveReason && trimmed.length > 0 && trimmed.length < EARLY_LEAVE_REASON_MIN_LENGTH;
  const hasValidReason =
    !requireEarlyLeaveReason || trimmed.length >= EARLY_LEAVE_REASON_MIN_LENGTH;
  const canSubmit = hasValidReason && trimmedDailyUpdate.length > 0 && !submitting;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    onConfirm({
      earlyLeaveReason: requireEarlyLeaveReason ? trimmed : undefined,
      dailyUpdate: trimmedDailyUpdate,
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="early-leave-title"
    >
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label="Close"
        onClick={submitting ? undefined : onCancel}
      />
      <form
        onSubmit={handleSubmit}
        className="border-ex-border bg-ex-elevated relative z-10 w-full max-w-md rounded-2xl border p-5 shadow-xl sm:p-6"
      >
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/50">
            <LogOut className="size-5 text-amber-700 dark:text-amber-300" aria-hidden />
          </div>
          <div className="min-w-0">
            <h2 id="early-leave-title" className="text-ex-primary text-lg font-semibold">
              Punch out for today?
            </h2>
            <p className="text-ex-muted mt-1 text-sm">
              {requireEarlyLeaveReason ? (
                <>
                  You&apos;re about{" "}
                  <span className="font-semibold text-amber-700 dark:text-amber-400">
                    {formatDuration(shortfallMs)}
                  </span>{" "}
                  short of your daily work target. Please share why you&apos;re punching out early.
                </>
              ) : (
                "Before punch out, quickly note what tasks you completed today."
              )}
            </p>
          </div>
        </div>

        {requireEarlyLeaveReason ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {QUICK_REASONS.map((preset) => (
              <button
                key={preset}
                type="button"
                disabled={submitting}
                className="rounded-full border border-amber-200/90 bg-amber-50/80 px-3 py-1 text-xs font-medium text-amber-900 transition hover:bg-amber-100 disabled:opacity-50 dark:border-amber-800/60 dark:bg-amber-950/50 dark:text-amber-100 dark:hover:bg-amber-900/60"
                onClick={() => setReason(preset)}
              >
                {preset}
              </button>
            ))}
          </div>
        ) : null}

        {requireEarlyLeaveReason ? (
          <div className="mt-4 space-y-2">
            <Label htmlFor="early-leave-reason">Reason for early punch-out</Label>
            <Textarea
              id="early-leave-reason"
              rows={3}
              required
              disabled={submitting}
              placeholder="e.g. doctor appointment, approved half-day..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="resize-none"
            />
            <p className="text-ex-muted text-xs">
              At least {EARLY_LEAVE_REASON_MIN_LENGTH} characters
              {tooShort ? (
                <span className="text-amber-700 dark:text-amber-400">
                  {" "}
                  ({EARLY_LEAVE_REASON_MIN_LENGTH - trimmed.length} more needed)
                </span>
              ) : null}
            </p>
          </div>
        ) : null}

        <div className="mt-4 space-y-2">
          <Label htmlFor="daily-update">What tasks did you complete today?</Label>
          <Textarea
            id="daily-update"
            rows={4}
            required
            disabled={submitting}
            placeholder="Summarize your completed work for today"
            value={dailyUpdate}
            onChange={(e) => setDailyUpdate(e.target.value)}
          />
        </div>

        {error ? (
          <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
            {error}
          </p>
        ) : null}

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" disabled={submitting} onClick={onCancel}>
            Stay clocked in
          </Button>
          <Button type="submit" disabled={!canSubmit} className="gap-2">
            {submitting ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden />
                Punching out…
              </>
            ) : (
              <>
                <LogOut className="size-4" aria-hidden />
                Confirm punch out
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
