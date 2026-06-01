"use client";

import Link from "next/link";

import { PunchInBanner } from "@/components/attendance/punch-in-status-flag";
import { WorkTimer } from "@/components/attendance/work-timer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  IDEAL_BREAK_HOURS,
  IDEAL_SHIFT_HOURS,
  IDEAL_WORKING_HOURS,
} from "@/lib/attendance/constants";
import { formatDuration } from "@/lib/attendance/time";
import { useTodayAttendance } from "@/hooks/use-today-attendance";

export function AttendanceWidget() {
  const { today, loading, liveWorkedMs } = useTodayAttendance();

  const remainingMs = Math.max(0, IDEAL_WORKING_HOURS * 60 * 60 * 1000 - liveWorkedMs);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle>Today&apos;s attendance</CardTitle>
        <Link href="/employee/punch">
          <Button variant="outline" size="sm" type="button">
            Punch
          </Button>
        </Link>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <p className="text-ex-muted text-sm">Loading attendance…</p>
        ) : !today?.hasPunchedIn ? (
          <PunchInBanner />
        ) : (
          <>
            <dl className="grid gap-2 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-ex-muted">Punch In</dt>
                <dd className="text-ex-primary font-medium">{today.punchIn || "—"}</dd>
              </div>
              <div>
                <dt className="text-ex-muted">Current Break</dt>
                <dd className="text-ex-primary font-medium">{today.onBreak ? "Yes" : "No"}</dd>
              </div>
              <div>
                <dt className="text-ex-muted">Work goal</dt>
                <dd className="text-ex-primary font-medium">
                  {IDEAL_WORKING_HOURS}h work + {IDEAL_BREAK_HOURS}h break
                </dd>
              </div>
              <div>
                <dt className="text-ex-muted">Work left</dt>
                <dd className="text-ex-primary font-medium">
                  {today.hasPunchedOut ? "—" : formatDuration(remainingMs)}
                </dd>
              </div>
              <div>
                <dt className="text-ex-muted">Break used</dt>
                <dd className="text-ex-primary font-medium">
                  {today.breakAllowanceFormatted ?? `0h / ${IDEAL_BREAK_HOURS}h`}
                </dd>
              </div>
              <div>
                <dt className="text-ex-muted">Typical day</dt>
                <dd className="text-ex-primary font-medium">{IDEAL_SHIFT_HOURS}h total</dd>
              </div>
            </dl>
            <WorkTimer workedMs={liveWorkedMs} />
            {today.status ? <p className="text-ex-muted text-xs">Status: {today.status}</p> : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}
