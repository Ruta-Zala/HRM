"use client";

import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

import { CorrectionForm } from "@/components/attendance/correction-form";
import { EarlyLeaveDialog } from "@/components/attendance/early-leave-dialog";
import { PunchDesk } from "@/components/attendance/punch-desk";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { useTodayAttendance } from "@/hooks/use-today-attendance";
import { useAuth } from "@/contexts/auth-provider";
import { canManageEmployees } from "@/lib/auth/roles";
import {
  fetchCorrectionRequests,
  reviewCorrection,
  updateDailyUpdate,
  type CorrectionRequestDto,
} from "@/lib/attendance/client";
import { CORRECTION_STATUS, WORK_MODE, WORK_MODE_OPTIONS } from "@/lib/attendance/constants";

export default function PunchPage() {
  const { user } = useAuth();
  const isHr = user ? canManageEmployees(user.role) : false;
  const { today, loading, error, acting, liveWorkedMs, runAction, refresh } = useTodayAttendance();
  const [showCorrection, setShowCorrection] = useState(false);
  const [corrections, setCorrections] = useState<CorrectionRequestDto[]>([]);
  const [reviewing, setReviewing] = useState<{
    id: string;
    status: "Approved" | "Rejected";
  } | null>(null);
  const [earlyLeaveOpen, setEarlyLeaveOpen] = useState(false);
  const [earlyLeaveError, setEarlyLeaveError] = useState<string | null>(null);
  const [dailyUpdateDraft, setDailyUpdateDraft] = useState<string | null>(null);
  const [dailyUpdateSaving, setDailyUpdateSaving] = useState(false);
  const [dailyUpdateError, setDailyUpdateError] = useState<string | null>(null);
  const [workMode, setWorkMode] = useState<string>(WORK_MODE.FULL_DAY_ONSITE);

  const targetMs = (today?.idealHours ?? 8) * 60 * 60 * 1000;
  const shortfallMs = Math.max(0, targetMs - liveWorkedMs);
  const isLeavingEarly = Boolean(today?.hasPunchedIn && !today?.hasPunchedOut && shortfallMs > 0);

  async function handlePunchOut() {
    setEarlyLeaveError(null);
    setEarlyLeaveOpen(true);
  }

  async function confirmEarlyLeave(payload: { earlyLeaveReason?: string; dailyUpdate: string }) {
    setEarlyLeaveError(null);
    try {
      await runAction("punch-out", payload);
      setDailyUpdateDraft(null);
      setEarlyLeaveOpen(false);
    } catch (err) {
      setEarlyLeaveError(err instanceof Error ? err.message : "Punch out failed");
    }
  }

  async function handleSaveDailyUpdate() {
    if (!today?.date) return;
    const value = (dailyUpdateDraft ?? today.dailyUpdate ?? "").trim();
    if (!value) {
      setDailyUpdateError("Daily update cannot be empty");
      return;
    }
    setDailyUpdateSaving(true);
    setDailyUpdateError(null);
    try {
      const updated = await updateDailyUpdate(today.date, value);
      setDailyUpdateDraft(updated.dailyUpdate ?? null);
      await refresh();
    } catch (err) {
      setDailyUpdateError(err instanceof Error ? err.message : "Failed to update daily update");
    } finally {
      setDailyUpdateSaving(false);
    }
  }

  useEffect(() => {
    if (!isHr) return;
    void fetchCorrectionRequests()
      .then(setCorrections)
      .catch(() => {});
  }, [isHr]);

  async function handleReview(id: string, status: "Approved" | "Rejected") {
    setReviewing({ id, status });
    try {
      await reviewCorrection(id, status);
      setCorrections(await fetchCorrectionRequests());
      await refresh();
    } finally {
      setReviewing(null);
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="space-y-1">
        <h1 className="text-ex-primary text-2xl font-bold tracking-tight">Punch desk</h1>
        <p className="text-ex-muted text-sm">
          Your daily check-in — one tap to start, one tap to finish.
        </p>
      </div>

      {error ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </p>
      ) : null}

      {!today?.hasPunchedIn ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Work mode</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Select
              value={workMode}
              onChange={(e) => setWorkMode(e.target.value)}
              disabled={acting || loading}
            >
              {WORK_MODE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </Select>
            <p className="text-ex-muted text-xs">
              This mode will be saved in today&apos;s attendance row.
            </p>
          </CardContent>
        </Card>
      ) : null}

      <PunchDesk
        userName={user?.name}
        today={today}
        loading={loading}
        acting={acting}
        liveWorkedMs={liveWorkedMs}
        onPunchIn={() => void runAction("punch-in", { workMode })}
        onPunchOut={() => void handlePunchOut()}
        onBreakStart={() => void runAction("break-start")}
        onBreakEnd={() => void runAction("break-end")}
        onRequestCorrection={today?.hasPunchedIn ? () => setShowCorrection((v) => !v) : undefined}
      />

      <EarlyLeaveDialog
        key={`${today?.date ?? "today"}-${earlyLeaveOpen ? "open" : "closed"}`}
        open={earlyLeaveOpen}
        shortfallMs={shortfallMs}
        requireEarlyLeaveReason={isLeavingEarly}
        initialDailyUpdate={today?.dailyUpdate ?? ""}
        submitting={acting}
        error={earlyLeaveError}
        onConfirm={(payload) => void confirmEarlyLeave(payload)}
        onCancel={() => {
          if (!acting) {
            setEarlyLeaveOpen(false);
            setEarlyLeaveError(null);
          }
        }}
      />

      {today?.hasPunchedIn ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Daily update</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <textarea
              value={dailyUpdateDraft ?? today?.dailyUpdate ?? ""}
              onChange={(e) => setDailyUpdateDraft(e.target.value)}
              placeholder="Add completed work for this day"
              rows={4}
              className="border-ex-border bg-ex-elevated w-full rounded-md border px-3 py-2 text-sm"
              disabled={dailyUpdateSaving}
            />
            {dailyUpdateError ? (
              <p className="text-sm text-red-600 dark:text-red-400">{dailyUpdateError}</p>
            ) : null}
            <div className="flex justify-end">
              <Button
                size="sm"
                onClick={() => void handleSaveDailyUpdate()}
                disabled={
                  dailyUpdateSaving || !(dailyUpdateDraft ?? today?.dailyUpdate ?? "").trim()
                }
              >
                {dailyUpdateSaving ? (
                  <>
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                    Saving...
                  </>
                ) : (
                  "Save update"
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {showCorrection && today?.hasPunchedIn ? (
        <CorrectionForm
          date={today.date}
          onSuccess={() => setShowCorrection(false)}
          onCancel={() => setShowCorrection(false)}
        />
      ) : null}

      {isHr && corrections.some((c) => c.status === CORRECTION_STATUS.PENDING) ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pending correction requests</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {corrections
              .filter((c) => c.status === CORRECTION_STATUS.PENDING)
              .map((c) => (
                <div
                  key={c.id}
                  className="border-ex-border bg-ex-surface/50 flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="text-sm">
                    <p className="text-ex-primary font-medium">
                      {c.employeeName} · {c.date} · {c.field}
                    </p>
                    <p className="text-ex-muted">
                      {c.originalValue || "—"} → {c.requestedValue}
                    </p>
                    <p className="text-ex-muted mt-1">{c.reason}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      disabled={reviewing !== null}
                      onClick={() => void handleReview(c.id, "Approved")}
                    >
                      {reviewing?.id === c.id && reviewing.status === "Approved" ? (
                        <>
                          <Loader2 className="size-4 animate-spin" aria-hidden />
                          Approving…
                        </>
                      ) : (
                        "Approve"
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={reviewing !== null}
                      onClick={() => void handleReview(c.id, "Rejected")}
                    >
                      {reviewing?.id === c.id && reviewing.status === "Rejected" ? (
                        <>
                          <Loader2 className="size-4 animate-spin" aria-hidden />
                          Rejecting…
                        </>
                      ) : (
                        "Reject"
                      )}
                    </Button>
                  </div>
                </div>
              ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
