"use client";

import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { apiResponseErrorMessage, parseJsonResponse } from "@/lib/api/json-response";

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginPageFallback />}>
      <LoginPageContent />
    </Suspense>
  );
}

function LoginPageFallback() {
  return (
    <div className="bg-ex-bg flex min-h-screen items-center justify-center px-4 py-12">
      <p className="text-ex-muted text-sm">Loading…</p>
    </div>
  );
}

function LoginPageContent() {
  const searchParams = useSearchParams();
  const fromRaw = searchParams.get("from") ?? "/dashboard";
  const from = fromRaw.startsWith("/") && !fromRaw.startsWith("//") ? fromRaw : "/dashboard";
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ login, password }),
      });

      const parsed = await parseJsonResponse<{ error?: string; ok?: boolean }>(res);
      if (parsed.invalid || parsed.empty) {
        setError(apiResponseErrorMessage(res, parsed, "Sign-in failed"));
        return;
      }
      const data = parsed.data;
      if (!res.ok) {
        setError(data?.error ?? "Sign-in failed");
        return;
      }
      window.location.assign(from);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "An unexpected error occurred";
      setError(message);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="bg-ex-bg relative flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <div
        aria-hidden
        className="from-ex-secondary/8 pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] via-transparent to-transparent"
      />
      <Card className="border-ex-border relative z-10 w-full max-w-md shadow-lg dark:shadow-none">
        <CardHeader className="space-y-4 text-center">
          <div className="ring-ex-border dark:bg-ex-surface relative mx-auto size-16 overflow-hidden rounded-2xl bg-white ring-1">
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
              <Label htmlFor="login">Email or Username</Label>
              <Input
                id="login"
                value={login}
                required
                onChange={(e) => setLogin(e.target.value)}
                placeholder="Enter your username"
              />
            </div>
            <div className="space-y-2 text-left">
              <Label htmlFor="password">Password</Label>
              <PasswordInput
                id="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="Enter your password"
              />
            </div>
            {error ? (
              <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-700 dark:text-rose-300">
                {error}
              </p>
            ) : null}
            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? "Signing in…" : "Continue"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
