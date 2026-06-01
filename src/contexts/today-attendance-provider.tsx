"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

import {
  fetchTodayAttendance,
  postAttendanceAction,
  type AttendanceActionPayload,
  type TodayAttendance,
} from "@/lib/attendance/client";
import { computeLiveWorkedMsFromFields } from "@/lib/attendance/time";

type TodayAttendanceContextValue = {
  today: TodayAttendance | null;
  loading: boolean;
  error: string | null;
  acting: boolean;
  tick: number;
  liveWorkedMs: number;
  refresh: () => Promise<void>;
  runAction: (
    action: "punch-in" | "punch-out" | "break-start" | "break-end",
    payload?: AttendanceActionPayload,
  ) => Promise<void>;
};

const TodayAttendanceContext = createContext<TodayAttendanceContextValue | null>(null);

function useTodayAttendanceState(): TodayAttendanceContextValue {
  const [today, setToday] = useState<TodayAttendance | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [acting, setActing] = useState(false);
  const [tick, setTick] = useState(0);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const data = await fetchTodayAttendance();
      setToday(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load attendance");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const data = await fetchTodayAttendance();
        if (cancelled) return;
        setToday(data);
        setError(null);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load attendance");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!today?.hasPunchedIn || today.hasPunchedOut) return;
    const id = window.setInterval(() => setTick((t) => t + 1), 1000);
    return () => window.clearInterval(id);
  }, [today?.hasPunchedIn, today?.hasPunchedOut]);

  const runAction = useCallback(
    async (
      action: "punch-in" | "punch-out" | "break-start" | "break-end",
      payload?: AttendanceActionPayload,
    ) => {
      setActing(true);
      setError(null);
      try {
        const updated = await postAttendanceAction(action, payload);
        setToday(updated);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Action failed");
        throw err;
      } finally {
        setActing(false);
      }
    },
    [],
  );

  const liveWorkedMs = today
    ? computeLiveWorkedMsFromFields({
        date: today.date,
        workMode: today.workMode,
        punchIn: today.punchIn,
        punchOut: today.punchOut,
        totalBreakTime: today.totalBreakTime,
        breakStart: today.breakStart,
        breakEnd: today.breakEnd,
      })
    : 0;

  void tick;

  return {
    today,
    loading,
    error,
    acting,
    tick,
    liveWorkedMs,
    refresh,
    runAction,
  };
}

export function TodayAttendanceProvider({ children }: { children: React.ReactNode }) {
  const value = useTodayAttendanceState();
  return (
    <TodayAttendanceContext.Provider value={value}>{children}</TodayAttendanceContext.Provider>
  );
}

export function useTodayAttendance(): TodayAttendanceContextValue {
  const context = useContext(TodayAttendanceContext);
  if (!context) {
    throw new Error("useTodayAttendance must be used within TodayAttendanceProvider");
  }
  return context;
}
