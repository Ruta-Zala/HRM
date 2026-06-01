"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-provider";
import { AppHeader } from "@/components/layout/app-header";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { TodayAttendanceProvider } from "@/contexts/today-attendance-provider";
import { SupportBot } from "@/components/support/support-bot";

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      // #region agent log
      fetch("http://127.0.0.1:7279/ingest/f049b175-207b-4058-92d9-83f5639a1829", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "41e469" },
        body: JSON.stringify({
          sessionId: "41e469",
          runId: "pre-fix",
          hypothesisId: "H6",
          location: "dashboard-shell.tsx:useEffect",
          message: "dashboard shell redirecting to /login (no user)",
          data: { loading, path: typeof window !== "undefined" ? window.location.pathname : "" },
          timestamp: Date.now(),
        }),
      }).catch(() => {});
      // #endregion
      router.replace("/login");
    }
  }, [loading, user, router]);

  if (loading || !user) {
    return (
      <div className="bg-ex-bg flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="border-ex-border border-t-ex-secondary size-10 animate-spin rounded-full border-2" />
          <p className="text-ex-muted text-sm">Loading workspace…</p>
        </div>
      </div>
    );
  }

  return (
    <TodayAttendanceProvider>
      <div className="bg-ex-bg flex min-h-screen">
        <AppSidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <AppHeader />
          <main className="flex-1 space-y-8 p-4 pb-10 lg:p-8">{children}</main>
          <SupportBot />
        </div>
      </div>
    </TodayAttendanceProvider>
  );
}
