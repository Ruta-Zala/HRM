"use client";

import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import type { UserRole } from "@/types/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function LoginPage() {
  const searchParams = useSearchParams();
  const fromRaw = searchParams.get("from") ?? "/dashboard";
  const from =
    fromRaw.startsWith("/") && !fromRaw.startsWith("//") ? fromRaw : "/dashboard";
  const [email, setEmail] = useState("hr@exhibyte.local");
  const [password, setPassword] = useState("demo");
  const [role, setRole] = useState<UserRole | "">("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      // #region agent log
      fetch("http://127.0.0.1:7279/ingest/f049b175-207b-4058-92d9-83f5639a1829", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "41e469" },
        body: JSON.stringify({
          sessionId: "41e469",
          runId: "pre-fix",
          hypothesisId: "H1",
          location: "login/page.tsx:onSubmit:start",
          message: "login submit",
          data: {
            emailDomain: email.includes("@") ? email.split("@")[1] : "invalid",
            roleEmpty: role === "",
          },
          timestamp: Date.now(),
        }),
      }).catch(() => { });
      // #endregion
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          email,
          password,
          role: role || undefined,
        }),
      });

      // #region agent log
      fetch("http://127.0.0.1:7279/ingest/f049b175-207b-4058-92d9-83f5639a1829", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "41e469" },
        body: JSON.stringify({
          sessionId: "41e469",
          runId: "pre-fix",
          hypothesisId: "H2",
          location: "login/page.tsx:onSubmit:afterFetch",
          message: "login response",
          data: { status: res.status, ok: res.ok },
          timestamp: Date.now(),
        }),
      }).catch(() => { });
      // #endregion

      const data = await res.json();
      // #region agent log
      fetch("http://127.0.0.1:7279/ingest/f049b175-207b-4058-92d9-83f5639a1829", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "41e469" },
        body: JSON.stringify({
          sessionId: "41e469",
          runId: "pre-fix",
          hypothesisId: "H3",
          location: "login/page.tsx:onSubmit:afterJson",
          message: "parsed body",
          data: {
            ok: !!data?.ok,
            hasUser: !!data?.user,
            userRole: data?.user?.role ?? null,
          },
          timestamp: Date.now(),
        }),
      }).catch(() => { });
      // #endregion
      if (!res.ok) {
        setError(data?.error ?? "Sign-in failed");
        return;
      }
      const target = from;
      // #region agent log
      fetch("http://127.0.0.1:7279/ingest/f049b175-207b-4058-92d9-83f5639a1829", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "41e469" },
        body: JSON.stringify({
          sessionId: "41e469",
          runId: "post-fix",
          hypothesisId: "H7",
          location: "login/page.tsx:onSubmit:beforeFullNav",
          message: "full page assign so AuthProvider remounts with cookie",
          data: { target: target.slice(0, 80) },
          timestamp: Date.now(),
        }),
      }).catch(() => { });
      // #endregion
      window.location.assign(target);
    } catch (error: any) {
      // #region agent log
      fetch("http://127.0.0.1:7279/ingest/f049b175-207b-4058-92d9-83f5639a1829", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "41e469" },
        body: JSON.stringify({
          sessionId: "41e469",
          runId: "pre-fix",
          hypothesisId: "H5",
          location: "login/page.tsx:onSubmit:catch",
          message: "login error",
          data: { errName: error?.name ?? "unknown", errMsg: String(error?.message ?? "").slice(0, 120) },
          timestamp: Date.now(),
        }),
      }).catch(() => { });
      // #endregion
      setError(error?.message ?? "An unexpected error occurred");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-ex-bg px-4 py-12">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-ex-secondary/15 via-transparent to-transparent"
      />
      <Card className="relative z-10 w-full max-w-md border-ex-border shadow-lg dark:shadow-none">
        <CardHeader className="space-y-4 text-center">
          <div className="mx-auto relative size-16 overflow-hidden rounded-2xl bg-white ring-1 ring-ex-border dark:bg-ex-surface">
            <Image
              src="https://exhibytesolution.com/wp-content/uploads/2023/06/cropped-Exhibyte_Logo_Black_Logo-removebg-preview-1.png"
              alt="Exhibyte Solutions"
              fill
              className="object-contain p-2 dark:invert"
              sizes="64px"
              priority
            />
          </div>
          <div>
            <CardTitle className="text-xl">Sign in to HRM Admin</CardTitle>
            <CardDescription className="text-ex-muted">
              Exhibyte Solutions internal workspace
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={(e) => void onSubmit(e)}>
            <div className="space-y-2 text-left">
              <Label htmlFor="email">Work email</Label>
              <Input
                id="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2 text-left">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            {/* <div className="space-y-2 text-left">
              <Label htmlFor="role">Role override (demo)</Label>
              <Select
                id="role"
                value={role}
                onChange={(e) => setRole(e.target.value as UserRole | "")}
              >
                <option value="">Use account default</option>
                <option value="super_admin">Super Admin</option>
                <option value="hr">HR</option>
                <option value="employee">Employee</option>
              </Select>
              <p className="text-xs text-ex-muted">
                Demo accounts: <code className="text-ex-secondary">admin@exhibyte.local</code>,{" "}
                <code className="text-ex-secondary">hr@exhibyte.local</code>,{" "}
                <code className="text-ex-secondary">employee@exhibyte.local</code> — password{" "}
                <code className="text-ex-secondary">demo</code>.
              </p>
            </div> */}
            {error ? (
              <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-700 dark:text-rose-300">
                {error}
              </p>
            ) : null}
            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? "Signing in…" : "Continue"}
            </Button>
          </form>
          {/* <p className="mt-6 text-center text-xs text-ex-muted">
            By continuing you agree to internal data handling policies.{" "}
            <Link href="/employee/privacy" className="text-ex-secondary underline-offset-4 hover:underline">
              Leave visibility
            </Link>
          </p> */}
        </CardContent>
      </Card>
    </div>
  );
}
