"use client";

import { AlertCircle, Loader2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ABSENCE_EXPLANATION_MIN_LENGTH } from "@/lib/attendance/constants";
import { setAbsenceGateSessionHint } from "@/lib/attendance/absence-gate-session";
import { apiResponseErrorMessage, parseJsonResponse } from "@/lib/api/json-response";

type LeaveTypeOption = "sick" | "casual";

type PendingAbsenceGroup = {
  id: string;
  reasonType: "today_no_punch" | "rejected_leave" | "unauthorized_absence";
  dateFromIso: string;
  dateToIso: string;
  dateLabel: string;
  leaveTypeOptions?: LeaveTypeOption[];
  entries: Array<{
    dateIso: string;
    leaveType: string;
    leaveRowIndex: number;
    rejectReason: string;
    duration: string;
  }>;
};

function formatLeaveTypeLabel(leaveType: string): string {
  const labels: Record<string, string> = {
    paid: "Paid",
    casual: "Casual",
    sick: "Sick",
    birthday: "Birthday",
    unpaid: "Unpaid",
    today: "Today",
    unauthorized: "Unauthorized absence",
  };
  return labels[leaveType] ?? leaveType;
}

function reasonTitle(group: PendingAbsenceGroup): string {
  if (group.reasonType === "today_no_punch") {
    return "You have not punched in today";
  }
  if (group.reasonType === "rejected_leave") {
    return group.dateFromIso === group.dateToIso
      ? "Leave was rejected and you were absent"
      : "Leave was rejected and you were absent (multiple days)";
  }
  if (group.dateFromIso === group.dateToIso) {
    return "Absent without a leave request";
  }
  return "Absent without a leave request (multiple days)";
}

function reasonDescription(group: PendingAbsenceGroup): string {
  if (group.reasonType === "today_no_punch") {
    if ((group.leaveTypeOptions?.length ?? 0) > 0) {
      return "You have not punched in yet. Select sick or casual leave if you are absent today, or explain why you have not punched in.";
    }
    return "Please explain why you have not punched in yet before accessing the rest of the site.";
  }
  if (group.reasonType === "rejected_leave") {
    return group.dateFromIso === group.dateToIso
      ? "Your leave request was rejected for this day and attendance was not recorded."
      : `Your leave request was rejected and you were absent from ${group.dateLabel}.`;
  }
  if ((group.leaveTypeOptions?.length ?? 0) > 0) {
    return group.dateFromIso === group.dateToIso
      ? "You were absent without a leave request. Select sick or casual leave (if available) and submit a reason for HR approval."
      : `You were absent from ${group.dateLabel} without a leave request. Select sick or casual leave (if available this quarter) and submit a reason for HR approval.`;
  }
  if (group.dateFromIso === group.dateToIso) {
    return "You were absent on this working day without submitting a leave request.";
  }
  return `You were absent from ${group.dateLabel} without submitting a leave request.`;
}

async function fetchPendingGroups(): Promise<{
  groups: PendingAbsenceGroup[];
  error: string | null;
}> {
  const res = await fetch("/api/attendance/absence-explanation", { credentials: "include" });
  const parsed = await parseJsonResponse<{
    success?: boolean;
    groups?: PendingAbsenceGroup[];
    message?: string;
  }>(res);

  if (parsed.invalid || parsed.empty || !res.ok || !parsed.data?.success) {
    return {
      groups: [],
      error: apiResponseErrorMessage(res, parsed, "Failed to load pending absences"),
    };
  }

  return { groups: parsed.data.groups ?? [], error: null };
}

export function AbsenceExplanationPanel({
  onSubmitted,
  onPendingChange,
}: {
  onSubmitted?: () => void;
  onPendingChange?: (pendingCount: number) => void;
}) {
  const [groups, setGroups] = useState<PendingAbsenceGroup[]>([]);
  const [explanations, setExplanations] = useState<Record<string, string>>({});
  const [leaveTypes, setLeaveTypes] = useState<Record<string, LeaveTypeOption | "">>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Keep parent callbacks in refs so the mount fetch does not re-run when
  // parents pass inline functions (which would otherwise loop: fetch → setState
  // → new callback → effect deps change → fetch again).
  const onPendingChangeRef = useRef(onPendingChange);
  const onSubmittedRef = useRef(onSubmitted);
  useEffect(() => {
    onPendingChangeRef.current = onPendingChange;
    onSubmittedRef.current = onSubmitted;
  });

  const applyGroups = useCallback((items: PendingAbsenceGroup[]) => {
    setGroups(items);
    setAbsenceGateSessionHint(items.length > 0);
    onPendingChangeRef.current?.(items.length);
    setExplanations((current) => {
      const next = { ...current };
      for (const item of items) {
        if (next[item.id] == null) next[item.id] = "";
      }
      return next;
    });
    setLeaveTypes((current) => {
      const next = { ...current };
      for (const item of items) {
        const options = item.leaveTypeOptions ?? [];
        if (options.length === 0) {
          next[item.id] = "";
          continue;
        }
        const selected = next[item.id];
        if (selected && options.includes(selected)) continue;
        // Default past unauthorized absences to the first available type.
        // Leave today's no-punch empty so "forgot to punch" stays optional.
        next[item.id] = item.reasonType === "unauthorized_absence" ? (options[0] ?? "") : "";
      }
      return next;
    });
  }, []);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const result = await fetchPendingGroups();
      if (cancelled) return;
      setError(result.error);
      applyGroups(result.groups);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [applyGroups]);

  const allValid =
    groups.length > 0 &&
    groups.every((group) => {
      const text = (explanations[group.id] ?? "").trim();
      if (text.length < ABSENCE_EXPLANATION_MIN_LENGTH) return false;
      const options = group.leaveTypeOptions ?? [];
      // Past unauthorized absences require a leave type when balance exists.
      // Today's no-punch can be explanation-only (forgot to punch) or leave.
      if (group.reasonType !== "unauthorized_absence" || options.length === 0) return true;
      const selected = leaveTypes[group.id];
      return Boolean(selected && options.includes(selected));
    });

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!allValid || submitting) return;

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/attendance/absence-explanation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          submissions: groups.map((group) => {
            const selected = leaveTypes[group.id];
            const options = group.leaveTypeOptions ?? [];
            return {
              groupId: group.id,
              explanation: (explanations[group.id] ?? "").trim(),
              reasonType: group.reasonType,
              dateFromIso: group.dateFromIso,
              dateToIso: group.dateToIso,
              entryDates: group.entries.map((entry) => entry.dateIso),
              ...(selected && options.includes(selected) ? { leaveType: selected } : {}),
            };
          }),
        }),
      });

      const parsed = await parseJsonResponse<{
        success?: boolean;
        message?: string;
        groups?: PendingAbsenceGroup[];
      }>(res);
      if (parsed.invalid || parsed.empty || !res.ok || !parsed.data?.success) {
        setError(apiResponseErrorMessage(res, parsed, "Failed to submit explanation"));
        return;
      }

      // Use groups from POST response — avoid a second GET round-trip.
      applyGroups(parsed.data.groups ?? []);
      setAbsenceGateSessionHint(false);
      onSubmittedRef.current?.();
    } catch (submitError) {
      const message =
        submitError instanceof Error ? submitError.message : "Failed to submit explanation";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <Card className="border-amber-200 dark:border-amber-900/60">
        <CardContent className="text-ex-muted flex items-center justify-center gap-2 py-10 text-sm">
          <Loader2 className="size-4 animate-spin" aria-hidden />
          Checking attendance...
        </CardContent>
      </Card>
    );
  }

  if (groups.length === 0) {
    return null;
  }

  return (
    <Card className="border-amber-200 dark:border-amber-900/60">
      <CardHeader className="space-y-2">
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/50">
            <AlertCircle className="size-5 text-amber-700 dark:text-amber-300" aria-hidden />
          </div>
          <div>
            <CardTitle className="text-lg">Absence explanation required</CardTitle>
            <CardDescription className="mt-1 text-sm leading-relaxed">
              Submit the reason(s) below to unlock the rest of the site. Until then, only this punch
              page is available.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-5">
          {groups.map((group) => {
            const value = explanations[group.id] ?? "";
            const trimmed = value.trim();
            const tooShort = trimmed.length > 0 && trimmed.length < ABSENCE_EXPLANATION_MIN_LENGTH;
            const rejectedEntry = group.entries[0];
            const leaveOptions = group.leaveTypeOptions ?? [];

            return (
              <div
                key={group.id}
                className="border-ex-border bg-ex-elevated space-y-3 rounded-xl border p-4"
              >
                <div>
                  <p className="text-ex-primary text-sm font-semibold">
                    {group.dateLabel} · {reasonTitle(group)}
                  </p>
                  <p className="text-ex-muted mt-1 text-xs">{reasonDescription(group)}</p>
                  {group.reasonType === "rejected_leave" && rejectedEntry ? (
                    <p className="text-ex-muted mt-2 text-xs">
                      {formatLeaveTypeLabel(rejectedEntry.leaveType)} leave
                      {rejectedEntry.duration ? ` · ${rejectedEntry.duration}` : ""}
                      {group.entries.length > 1 ? (
                        <>
                          <br />
                          <span className="font-medium">Days in this period:</span>{" "}
                          {group.entries.length}
                        </>
                      ) : null}
                      {rejectedEntry.rejectReason ? (
                        <>
                          <br />
                          <span className="font-medium">HR rejection reason:</span>{" "}
                          {rejectedEntry.rejectReason}
                        </>
                      ) : null}
                    </p>
                  ) : null}
                  {group.reasonType === "unauthorized_absence" && group.entries.length > 1 ? (
                    <p className="text-ex-muted mt-2 text-xs">
                      {group.entries.length} working day{group.entries.length === 1 ? "" : "s"} in
                      this period.
                    </p>
                  ) : null}
                </div>

                {leaveOptions.length > 0 ? (
                  <div className="space-y-2">
                    <Label htmlFor={`leave-type-${group.id}`}>
                      Leave type
                      {group.reasonType === "today_no_punch" ? " (optional)" : ""}
                    </Label>
                    <Select
                      id={`leave-type-${group.id}`}
                      value={leaveTypes[group.id] ?? ""}
                      onChange={(event) =>
                        setLeaveTypes((current) => ({
                          ...current,
                          [group.id]: event.target.value as LeaveTypeOption | "",
                        }))
                      }
                      disabled={submitting}
                      required={group.reasonType === "unauthorized_absence"}
                    >
                      <option value="">
                        {group.reasonType === "today_no_punch"
                          ? "No leave — I will punch in"
                          : "Select"}
                      </option>
                      {leaveOptions.map((option) => (
                        <option key={option} value={option}>
                          {formatLeaveTypeLabel(option)} leave
                        </option>
                      ))}
                    </Select>
                    <p className="text-ex-muted text-xs">
                      {group.reasonType === "today_no_punch"
                        ? "Choose sick/casual only if you are absent today. Otherwise leave this as “No leave” and punch in after submitting."
                        : "This creates a leave request for HR / Super Admin approval. Sick and casual are limited to 1 each in the current quarter (Jan–Mar, Apr–Jun, Jul–Sep, Oct–Dec); extra days cascade to unpaid."}
                    </p>
                  </div>
                ) : null}

                <div className="space-y-2">
                  <Label htmlFor={`explanation-${group.id}`}>Your explanation</Label>
                  <Textarea
                    id={`explanation-${group.id}`}
                    value={value}
                    onChange={(event) =>
                      setExplanations((current) => ({
                        ...current,
                        [group.id]: event.target.value,
                      }))
                    }
                    placeholder="Provide a clear explanation…"
                    rows={4}
                    disabled={submitting}
                  />
                  {tooShort ? (
                    <p className="text-xs text-amber-700 dark:text-amber-300">
                      At least {ABSENCE_EXPLANATION_MIN_LENGTH} characters required (
                      {trimmed.length}/{ABSENCE_EXPLANATION_MIN_LENGTH}).
                    </p>
                  ) : null}
                </div>
              </div>
            );
          })}

          {error ? (
            <p className="text-destructive text-sm" role="alert">
              {error}
            </p>
          ) : null}

          <div className="flex justify-end">
            <Button type="submit" disabled={!allValid || submitting}>
              {submitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                  Submitting…
                </>
              ) : (
                "Submit explanations"
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
